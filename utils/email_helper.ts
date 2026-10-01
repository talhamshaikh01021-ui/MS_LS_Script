import imaps from 'imap-simple';
import { simpleParser } from 'mailparser';
import nodemailer from 'nodemailer';
import { TEST_DATA } from './config.js';

export interface EmailCheckResult {
  welcomeMail: boolean;
  contestMail: boolean;
  loginDetailsMail: boolean;
  details: {
    welcomeSubject?: string;
    contestSubject?: string;
    loginSubject?: string;
  };
}

/**
 * Clean app password (remove spaces)
 */
function cleanPassword(pass: string): string {
  return pass.replace(/\s+/g, '');
}

/**
 * Fetch registration OTP / Activation key from Gmail using Regular Expressions
 * Filters emails to only those received after startTime (with 30s clock skew tolerance),
 * sorts candidate emails across INBOX, Spam, and All Mail newest-first,
 * and extracts the activation key/code using robust regex patterns.
 */
export async function fetchRegistrationOtp(
  email: string,
  appPassword: string,
  startTime: Date,
  maxWaitSec = 20
): Promise<string | null> {
  const config = {
    imap: {
      user: email,
      password: cleanPassword(appPassword),
      host: 'imap.gmail.com',
      port: 993,
      tls: true,
      tlsOptions: { rejectUnauthorized: false },
      authTimeout: 15000
    }
  };

  const startMs = Date.now();
  const timeoutMs = maxWaitSec * 1000;
  const cutoffMs = (startTime instanceof Date ? startTime.getTime() : startMs) - 30000;
  const boxes = ['[Gmail]/Spam', 'INBOX'];

  console.log(`[EmailHelper] Waiting for Confirm Registration email to ${email} (received after ${new Date(cutoffMs).toLocaleTimeString()}, timeout ${maxWaitSec}s)...`);

  while (Date.now() - startMs < timeoutMs) {
    let connection: imaps.ImapSimple | null = null;
    try {
      connection = await imaps.connect(config);
      const candidateMessages: Array<{
        boxName: string;
        msgDate: Date;
        message: any;
        subj: string;
      }> = [];

      for (const boxName of boxes) {
        try {
          await connection.openBox(boxName);
          const messages = await connection.search(['ALL'], {
            bodies: ['HEADER', 'TEXT', ''],
            markSeen: false
          });

          for (const message of messages) {
            const header = message.parts.find(p => p.which === 'HEADER');
            const subj = header?.body?.subject
              ? (Array.isArray(header.body.subject) ? header.body.subject[0] : header.body.subject)
              : '';

            // Check if this is an OTP / verification / registration email
            if (!/confirm/i.test(subj) && !/registration/i.test(subj) && !/otp/i.test(subj) && !/activate/i.test(subj) && !/verif/i.test(subj) && !/mouthshut/i.test(subj) && !/phone/i.test(subj) && !/mobile/i.test(subj)) {
              continue;
            }

            const dateStr = header?.body?.date
              ? (Array.isArray(header.body.date) ? header.body.date[0] : header.body.date)
              : message.attributes?.date;
            const msgDate = new Date(dateStr);

            // Strictly filter out emails received prior to cutoff
            if (isNaN(msgDate.getTime()) || msgDate.getTime() < cutoffMs) {
              continue;
            }

            candidateMessages.push({ boxName, msgDate, message, subj });
          }
        } catch (boxErr: any) {
          // Folder might not be present or temporary error
        }

        // If candidates found in INBOX, no need to check Spam
        if (candidateMessages.length > 0) {
          break;
        }
      }

      // If we found any emails received after cutoff, sort newest first and extract via Regex
      if (candidateMessages.length > 0) {
        candidateMessages.sort((a, b) => b.msgDate.getTime() - a.msgDate.getTime());

        for (const candidate of candidateMessages) {
          const fullBodyPart = candidate.message.parts.find((p: any) => p.which === '');
          const textPart = candidate.message.parts.find((p: any) => p.which === 'TEXT');
          const rawContent = (fullBodyPart && fullBodyPart.body) || (textPart && textPart.body) || '';

          let parsedText = '';
          if (typeof rawContent === 'string' && rawContent.length > 0) {
            const parsed = await simpleParser(rawContent);
            const cleanHtml = (parsed.html || parsed.text || '')
              .replace(/<[^>]+>/g, ' ')
              .replace(/&nbsp;/g, ' ')
              .replace(/\s+/g, ' ');
            parsedText = `${parsed.subject || ''} ${cleanHtml}`;
          } else {
            parsedText = JSON.stringify(fullMsg.parts);
          }

          // Extract activation key / OTP strictly using Regular Expressions:
          // 1. "Your Activation key: XXXXX" or "Activation key: XXXXX"
          const keyMatch = parsedText.match(/(?:your\s+activation\s+key|activation\s+key)\s*:\s*([a-zA-Z0-9]+)/i);
          if (keyMatch && keyMatch[1] && keyMatch[1].length >= 4 && keyMatch[1].toLowerCase() !== 'to') {
            const foundOtp = keyMatch[1].trim();
            console.log(`[EmailHelper] Extracted Activation Key "${foundOtp}" via Regex from "${candidate.subj}" (Sent: ${candidate.msgDate.toLocaleTimeString()}) in [${candidate.boxName}]`);
            connection.end();
            return foundOtp;
          }

          // 2. Link with ?user=...
          const linkMatch = parsedText.match(/activate-user1\.php\?user=([a-zA-Z0-9]+)/i);
          if (linkMatch && linkMatch[1] && linkMatch[1].length >= 4) {
            const foundOtp = linkMatch[1].trim();
            console.log(`[EmailHelper] Extracted Code "${foundOtp}" via URL Regex from activation link in [${candidate.boxName}]`);
            connection.end();
            return foundOtp;
          }

          // 3. "Activation Code: XXXXX" or "Verification Code: XXXXX" or "OTP: XXXXX"
          const codeMatch = parsedText.match(/(?:activation\s+code|verification\s+code|registration\s+code|otp)[\s:]+([a-zA-Z0-9]{4,10})/i);
          if (codeMatch && codeMatch[1]) {
            const foundOtp = codeMatch[1].trim();
            console.log(`[EmailHelper] Extracted Code "${foundOtp}" via Code Regex from [${candidate.boxName}]`);
            connection.end();
            return foundOtp;
          }

          // 4. 4-6 digit numeric OTP
          const numMatch = parsedText.match(/\b\d{4,6}\b/);
          if (numMatch) {
            const foundOtp = numMatch[0].trim();
            console.log(`[EmailHelper] Extracted numeric OTP "${foundOtp}" via Numeric Regex from [${candidate.boxName}]`);
            connection.end();
            return foundOtp;
          }
        }
      }

      connection.end();
    } catch (err: any) {
      console.warn(`[EmailHelper] Polling error: ${err.message}`);
      if (connection) {
        try { connection.end(); } catch (_) {}
      }
    }

    // Wait 2.5 seconds before next polling iteration
    await new Promise(r => setTimeout(r, 2500));
  }

  console.warn(`[EmailHelper] Timed out waiting for Confirm Registration email to ${email}`);
  return null;
}

/**
 * Check if the 3 post-registration emails (Welcome, Contest, Login Details) appeared
 * Searches INBOX, [Gmail]/Spam, and [Gmail]/All Mail
 */
export async function checkRegistrationEmails(
  email: string,
  appPassword: string,
  maxWaitSec = 20
): Promise<EmailCheckResult> {
  const result: EmailCheckResult = {
    welcomeMail: false,
    contestMail: false,
    loginDetailsMail: false,
    details: {}
  };

  const config = {
    imap: {
      user: email,
      password: cleanPassword(appPassword),
      host: 'imap.gmail.com',
      port: 993,
      tls: true,
      tlsOptions: { rejectUnauthorized: false },
      authTimeout: 15000
    }
  };

  console.log(`[EmailHelper] Verifying Welcome, Contest / Write Share Win, and Login Details emails for ${email} (timeout ${maxWaitSec}s)...`);

  const startMs = Date.now();
  const timeoutMs = maxWaitSec * 1000;
  const boxes = ['INBOX', '[Gmail]/Spam', '[Gmail]/All Mail'];

  while (Date.now() - startMs < timeoutMs) {
    let connection: imaps.ImapSimple | null = null;
    try {
      connection = await imaps.connect(config);

      // Try INBOX, Spam, and All Mail (Gmail filters automated emails to Spam)
      for (const boxName of boxes) {
        try {
          await connection.openBox(boxName);
          const searchCriteria = ['ALL'];
          const fetchOptions = { bodies: ['HEADER'], markSeen: false };
          const messages = await connection.search(searchCriteria, fetchOptions);

          for (const msg of messages) {
            const header = msg.parts.find(p => p.which === 'HEADER');
            if (header && header.body && header.body.subject) {
              const subj = Array.isArray(header.body.subject) ? header.body.subject[0] : header.body.subject;
              const sLower = subj.toLowerCase();

              if (sLower.includes('welcome') && !result.welcomeMail) {
                result.welcomeMail = true;
                result.details.welcomeSubject = subj;
                console.log(`[EmailHelper] Found Welcome email: "${subj}" in [${boxName}]`);
              }
              if ((sLower.includes('contest') || sLower.includes('write share') || sLower.includes('win on mouthshut') || sLower.includes('write, share') || sLower.includes('share and win') || sLower.includes('share & win')) && !result.contestMail) {
                result.contestMail = true;
                result.details.contestSubject = subj;
                console.log(`[EmailHelper] Found Write Share Win / Contest email: "${subj}" in [${boxName}]`);
              }
              if ((sLower.includes('login') || sLower.includes('account') || sLower.includes('credential')) && !result.loginDetailsMail) {
                result.loginDetailsMail = true;
                result.details.loginSubject = subj;
                console.log(`[EmailHelper] Found Login Details email: "${subj}" in [${boxName}]`);
              }
            }
          }
        } catch (boxErr: any) {
          console.warn(`[EmailHelper] Could not open box ${boxName}: ${boxErr.message}`);
        }
      }

      connection.end();
    } catch (err: any) {
      console.error(`[EmailHelper] IMAP check error: ${err.message}`);
      if (connection) {
        try { connection.end(); } catch (_) {}
      }
    }

    // If all three emails are found, finish early
    if (result.welcomeMail && result.contestMail && result.loginDetailsMail) {
      console.log(`[EmailHelper] All 3 confirmation emails (Welcome, Write Share Win, Login Details) found!`);
      break;
    }

    if (Date.now() - startMs < timeoutMs) {
      await new Promise(r => setTimeout(r, 2500));
    }
  }

  console.log(`[EmailHelper] Email verification results:`, result);
  return result;
}

export interface SharedReviewEmailResult {
  subject: string;
  reviewUrl: string | null;
  date: Date;
}

/**
 * Fetch shared review email from Gmail using IMAP
 * Filters emails received after startTime (with 30s clock skew tolerance),
 * searches for shared review subject, and extracts the shared review URL.
 */
export async function fetchSharedReviewEmail(
  email: string,
  appPassword: string,
  startTime: Date,
  maxWaitSec = 60,
  senderName?: string
): Promise<SharedReviewEmailResult | null> {
  const config = {
    imap: {
      user: email,
      password: cleanPassword(appPassword),
      host: 'imap.gmail.com',
      port: 993,
      tls: true,
      tlsOptions: { rejectUnauthorized: false },
      authTimeout: 15000
    }
  };

  const startMs = Date.now();
  const timeoutMs = maxWaitSec * 1000;
  const cutoffMs = (startTime instanceof Date ? startTime.getTime() : startMs) - 30000;
  const boxes = ['INBOX', '[Gmail]/Spam'];

  console.log(`[EmailHelper] Waiting for Shared Review email to ${email}${senderName ? ` from ${senderName}` : ''} (received after ${new Date(cutoffMs).toLocaleTimeString()}, timeout ${maxWaitSec}s)...`);

  while (Date.now() - startMs < timeoutMs) {
    let connection: imaps.ImapSimple | null = null;
    try {
      connection = await imaps.connect(config);

      for (const boxName of boxes) {
        try {
          await connection.openBox(boxName);
          const messages = await connection.search(['ALL'], {
            bodies: ['HEADER'],
            markSeen: false
          });

          // Check newest first
          for (let i = messages.length - 1; i >= 0; i--) {
            const message = messages[i];
            const header = message.parts.find(p => p.which === 'HEADER');
            const subj = header?.body?.subject
              ? (Array.isArray(header.body.subject) ? header.body.subject[0] : header.body.subject)
              : '';

            // Check if subject matches shared review
            if (!/shared by/i.test(subj) && !/review.*shared/i.test(subj) && !/share.*review/i.test(subj)) {
              continue;
            }

            // If senderName is specified, verify subject contains senderName
            if (senderName && !subj.toLowerCase().includes(senderName.toLowerCase())) {
              continue;
            }

            const dateStr = header?.body?.date
              ? (Array.isArray(header.body.date) ? header.body.date[0] : header.body.date)
              : message.attributes?.date;
            const msgDate = new Date(dateStr);

            if (isNaN(msgDate.getTime()) || msgDate.getTime() < cutoffMs) {
              continue;
            }

            // Candidate found! Fetch full body for this specific message
            const fullMsgs = await connection.search([['UID', message.attributes.uid]], {
              bodies: [''],
              markSeen: false
            });
            const fullPart = fullMsgs[0]?.parts.find((p: any) => p.which === '');
            const rawContent = fullPart ? fullPart.body : '';
            const parsed = await simpleParser(rawContent);
            const html = parsed.html || '';

            // Extract review links:
            // Find links containing ayur-shampoo or product-reviews / review
            let reviewUrl: string | null = null;
            const allLinks = [...html.matchAll(/href=["']([^"']+)["']/gi)].map(m => m[1]);
            // First priority: link containing ayur-shampoo
            const ayurLink = allLinks.find(l => /ayur-shampoo/i.test(l));
            if (ayurLink) {
              reviewUrl = ayurLink;
            } else {
              // Second priority: link with product-reviews or review
              const revLink = allLinks.find(l => /product-reviews|review/i.test(l) && !l.includes('alert') && !l.includes('facebook') && !l.includes('twitter'));
              if (revLink) reviewUrl = revLink;
            }

            console.log(`[EmailHelper] Found shared review email: "${subj}" (Date: ${msgDate.toLocaleTimeString()}) in [${boxName}]. Review link: ${reviewUrl}`);
            connection.end();
            return {
              subject: subj,
              reviewUrl: reviewUrl,
              date: msgDate
            };
          }
        } catch (boxErr: any) {
          // ignore folder error
        }
      }

      connection.end();
    } catch (err: any) {
      console.warn(`[EmailHelper] Polling error: ${err.message}`);
      if (connection) {
        try { connection.end(); } catch (_) {}
      }
    }

    if (Date.now() - startMs < timeoutMs) {
      await new Promise(r => setTimeout(r, 2000));
    }
  }

  console.warn(`[EmailHelper] Timed out waiting for Shared Review email to ${email}`);
  return null;
}

/**
 * Send Live Status / Regression Report via Nodemailer
 */
export async function sendRegressionEmailReport(
  subject: string,
  htmlContent: string
): Promise<boolean> {
  const senderConfig = TEST_DATA.report_sender_data || TEST_DATA.desktop_test_data;
  const senderEmail = senderConfig.email_id;
  const appPassword = cleanPassword(senderConfig.google_app_password);
  const recipients = TEST_DATA.report_recipients || [senderEmail];

  console.log(`[EmailHelper] Sending regression report from ${senderEmail} to: ${recipients.join(', ')}`);

  const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: senderEmail,
      pass: appPassword
    }
  });

  try {
    const info = await transporter.sendMail({
      from: `"Mouthshut QA" <${senderEmail}>`,
      to: recipients.join(', '),
      subject: subject,
      html: htmlContent
    });
    console.log(`[EmailHelper] Report email sent successfully! MessageId: ${info.messageId}`);
    return true;
  } catch (err: any) {
    console.error(`[EmailHelper] Failed to send report email: ${err.message}`);
    return false;
  }
}

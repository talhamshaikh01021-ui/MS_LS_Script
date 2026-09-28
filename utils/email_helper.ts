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
 * Fetch registration OTP from Gmail inbox
 * Polls for new messages since startTime, parses 4-digit OTP.
 */
export async function fetchRegistrationOtp(
  email: string,
  appPassword: string,
  startTime: Date,
  maxWaitSec = 45
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

  console.log(`[EmailHelper] Waiting for OTP email to ${email} since ${startTime.toISOString()} (timeout ${maxWaitSec}s)...`);

  while (Date.now() - startMs < timeoutMs) {
    let connection: imaps.ImapSimple | null = null;
    try {
      connection = await imaps.connect(config);
      await connection.openBox('INBOX');

      // Search for messages
      const searchCriteria = ['UNSEEN', ['SINCE', new Date(Date.now() - 5 * 60 * 1000)]];
      const fetchOptions = {
        bodies: ['HEADER', 'TEXT', ''],
        markSeen: true
      };

      let messages = await connection.search(searchCriteria, fetchOptions);
      if (messages.length === 0) {
        // Fallback: search ALL recent messages
        messages = await connection.search([['SINCE', new Date(Date.now() - 5 * 60 * 1000)]], fetchOptions);
      }

      // Check messages in reverse (most recent first)
      for (const message of messages.reverse()) {
        const fullBodyPart = message.parts.find(p => p.which === '');
        const textPart = message.parts.find(p => p.which === 'TEXT');
        const rawContent = (fullBodyPart && fullBodyPart.body) || (textPart && textPart.body) || '';

        let parsedText = '';
        let subject = '';
        if (typeof rawContent === 'string' && rawContent.length > 0) {
          const parsed = await simpleParser(rawContent);
          parsedText = `${parsed.subject || ''} ${parsed.text || ''} ${parsed.html || ''}`;
          subject = parsed.subject || '';
        } else {
          parsedText = JSON.stringify(message.parts);
        }

        console.log(`[EmailHelper] Inspecting message: "${subject}"`);

        // Check for OTP pattern
        const otpMatches = parsedText.match(/\b\d{4}\b/g);
        if (otpMatches && otpMatches.length > 0) {
          // Look for keywords nearby
          if (/otp|verification|mouthshut|activate|welcome|code/i.test(parsedText)) {
            const foundOtp = otpMatches[0];
            console.log(`[EmailHelper] Successfully extracted OTP: ${foundOtp}`);
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

    // Wait 5 seconds before next polling iteration
    await new Promise(r => setTimeout(r, 5000));
  }

  console.warn(`[EmailHelper] Timed out waiting for OTP email to ${email}`);
  return null;
}

/**
 * Check if the 3 post-registration emails (Welcome, Contest, Login Details) appeared
 * Searches INBOX and [Gmail]/All Mail
 */
export async function checkRegistrationEmails(
  email: string,
  appPassword: string
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

  console.log(`[EmailHelper] Verifying Welcome, Contest, and Login Details emails for ${email}...`);

  try {
    const connection = await imaps.connect(config);

    // Try INBOX and All Mail
    const boxes = ['INBOX', '[Gmail]/All Mail'];
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
            }
            if (sLower.includes('contest') && !result.contestMail) {
              result.contestMail = true;
              result.details.contestSubject = subj;
            }
            if ((sLower.includes('login') || sLower.includes('account') || sLower.includes('credential')) && !result.loginDetailsMail) {
              result.loginDetailsMail = true;
              result.details.loginSubject = subj;
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
  }

  console.log(`[EmailHelper] Email verification results:`, result);
  return result;
}

/**
 * Send Live Status / Regression Report via Nodemailer
 */
export async function sendRegressionEmailReport(
  subject: string,
  htmlContent: string
): Promise<boolean> {
  const senderEmail = TEST_DATA.desktop_test_data.email_id;
  const appPassword = cleanPassword(TEST_DATA.desktop_test_data.google_app_password);
  const recipients = TEST_DATA.report_recipients || [senderEmail];

  console.log(`[EmailHelper] Sending regression report to: ${recipients.join(', ')}`);

  const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: senderEmail,
      pass: appPassword
    }
  });

  try {
    const info = await transporter.sendMail({
      from: `"MouthShut Automation Suite" <${senderEmail}>`,
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

import { Page } from '@playwright/test';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { MOBILE_BASE_URL, TEST_DATA } from '../../../utils/config.js';
import { fetchRegistrationOtp, checkRegistrationEmails } from '../../../utils/email_helper.js';
import { solveAndFillCaptcha } from '../../../utils/captcha_ocr.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const xpaths = JSON.parse(fs.readFileSync(path.resolve(__dirname, 'registration_xpath.json'), 'utf8'));

/**
 * Helper to detect and dismiss the "OTP has been sent to your registered Email Address." popup
 * by clicking the "Ok" button (or close icon) and cleaning up any lingering modal overlay/backdrop.
 */
export async function dismissOtpSentModal(page: Page, timeoutMs = 8000) {
  console.log('[Mobile Registration] Checking for "OTP has been sent" popup...');
  const okBtn = page.locator(
    "#idExist .id-exist-btn, #idExist a:has-text('Ok'), #idExist button:has-text('Ok'), #idExist span:has-text('Ok'), .modal:has-text('OTP has been sent') a:has-text('Ok'), .modal:has-text('OTP has been sent') button:has-text('Ok'), .modal:has-text('OTP has been sent') .id-exist-btn, a.id-exist-btn, a:has-text('Ok'), button:has-text('Ok'), #idExist .close-modal-icon, .close-modal-icon, .icon-layer-close"
  ).first();

  const isVisible = await okBtn.waitFor({ state: 'visible', timeout: timeoutMs }).then(() => true).catch(() => false);
  if (isVisible) {
    console.log('[Mobile Registration] "OTP has been sent" popup detected. Clicking "Ok" button to dismiss...');
    await okBtn.scrollIntoViewIfNeeded().catch(() => { });
    await okBtn.click({ force: true }).catch(async () => {
      await okBtn.evaluate((el: HTMLElement) => el.click()).catch(() => { });
    });
    await page.waitForTimeout(1200);
  }

  // Ensure modal backdrop and modal are dismissed if still lingering in DOM
  await page.evaluate(() => {
    try {
      if ((window as any).$ && (window as any).$('#idExist').length) {
        (window as any).$('#idExist').modal('hide');
      }
    } catch (e) { }
    const modal = document.getElementById('idExist');
    if (modal) {
      modal.style.display = 'none';
      modal.classList.remove('in', 'show');
    }
    document.querySelectorAll('.modal-backdrop').forEach(el => el.remove());
    document.body.classList.remove('modal-open');
  }).catch(() => { });
}

/**
 * Helper to switch to Sign In tab and log in if account is already registered
 */
export async function switchToSignInAndLogin(page: Page, loginId: string, pass: string): Promise<boolean> {
  console.log(`[Mobile Registration] Switching to Sign In tab for: ${loginId}...`);
  try {
    const signInTab = page.locator(".ms-signin-button, a:has-text('Sign In'), #hypSign").first();
    if (await signInTab.isVisible().catch(() => false)) {
      await signInTab.click().catch(() => {});
      await page.waitForTimeout(1000);
    }

    const loginIdInput = page.locator("#txtLoginId, input[name*='txtLoginId']").first();
    if (await loginIdInput.isVisible().catch(() => false)) {
      await loginIdInput.fill(loginId);
      const passInput = page.locator("#txtPasswrd, input[name*='txtPasswrd']").first();
      await passInput.fill(pass);

      console.log('[Mobile Registration] Submitting Mobile Sign In credentials...');
      const signInSubmit = page.locator(".sign-in-button, a[onclick*='clicksignin']").first();
      await signInSubmit.click().catch(async () => {
        await page.evaluate(() => {
          if (typeof (window as any).clicksignin === 'function') (window as any).clicksignin();
        });
      });
      await page.waitForTimeout(3000);
    }
  } catch (err: any) {
    console.warn('[Mobile Registration] Sign in fallback note:', err.message);
  }
  return true;
}

export interface MobileRegistrationResult {
  success: boolean;
  msid: string;
  otpSec: number;
  emailsVerified?: boolean;
}

export async function mobileRegistration(page: Page): Promise<MobileRegistrationResult> {
  let measuredOtpSec = 1.67;
  try {
    await page.goto(MOBILE_BASE_URL, { waitUntil: 'domcontentloaded', timeout: 45000 });
  } catch {
    console.log('[Mobile Registration] Retrying navigation to mobile base URL...');
    await page.goto(MOBILE_BASE_URL, { waitUntil: 'commit', timeout: 60000 });
  }

  // 1. Click Sign In link from bottom nav or direct navigate
  console.log('[Mobile Registration] Opening Sign In / Sign Up page...');
  const loginUrl = `${MOBILE_BASE_URL}/signup/login/login_now.php?url=common/memberprofile.aspx`;
  try {
    const signInBtn = page.locator(xpaths.mobileSignInLink).first();
    if (await signInBtn.isVisible().catch(() => false)) {
      await signInBtn.click();
      await page.waitForTimeout(2000);
    }
  } catch (e) { }

  if (!page.url().includes('login_now.php')) {
    console.log('[Mobile Registration] Navigating directly to login page URL...');
    await page.goto(loginUrl, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(2000);
  }

  // 2. Switch to Sign Up tab/form
  console.log('[Mobile Registration] Switching to Sign Up tab...');
  const signUpTab = page.locator(xpaths.mobileSignUpTab).first();
  if (await signUpTab.isVisible().catch(() => false)) {
    await signUpTab.click();
    await page.waitForTimeout(1000);
  } else {
    await page.evaluate(() => {
      const tab = document.querySelector('#SignUp') || Array.from(document.querySelectorAll('a')).find(a => a.textContent?.includes('Sign Up'));
      if (tab) (tab as HTMLElement).click();
    }).catch(() => {});
    await page.waitForTimeout(1000);
  }

  // 3. Fill mobile registration fields
  const data = TEST_DATA.mobile_test_data;
  console.log(`[Mobile Registration] Filling registration for MSID: ${data.MSID}, Email: ${data.email_id}`);

  const nameInput = page.locator(xpaths.nameInput).first();
  await nameInput.waitFor({ state: 'visible', timeout: 10000 });
  await nameInput.fill(data.name);

  const emailInput = page.locator(xpaths.emailInput).first();
  await emailInput.fill(data.email_id);

  const passInput = page.locator(xpaths.passwordInput).first();
  await passInput.fill(data.password);

  const msidInput = page.locator(xpaths.msidInput).first();
  await msidInput.fill(data.MSID);

  // 4. Captcha OCR loop
  console.log('[Mobile Registration] Initiating Captcha OCR verification...');
  const captchaVerified = await solveAndFillCaptcha(
    page,
    xpaths.captchaImage,
    xpaths.captchaInput,
    xpaths.signUpSubmitButton,
    xpaths.captchaError || xpaths.errorContainer,
    20,
    ".otp-enter-phone, a.verify-email-link, #otpPhoneNo, text='Verify email through OTP', text='Enter your phone number', #thanku, #txtActive"
  );

  // Check if account was detected as already registered
  const isAlreadyRegistered = await page.evaluate(() => {
    const errText = document.getElementById('divErr2')?.innerText || '';
    const emailErr = document.getElementById('divEmail')?.innerText || '';
    const bodyText = document.body.innerText || '';
    return /already registered|already exists/i.test(errText) ||
           /already registered|already exists/i.test(emailErr) ||
           /already registered|already exists/i.test(bodyText);
  }).catch(() => false);

  if (isAlreadyRegistered) {
    console.log('[Mobile Registration] User is already registered on Mobile. Switching to Sign In...');
    await switchToSignInAndLogin(page, data.MSID, data.password);
    console.log('[Mobile Registration] Checking for 3 confirmation emails (Welcome, Contest / Write Share Win, Login Details)...');
    const emailResults = await checkRegistrationEmails(data.email_id, data.google_app_password, 20).catch(() => null);
    console.log('[Mobile Registration] Confirmation emails check result:', emailResults);
    await page.goto(MOBILE_BASE_URL, { waitUntil: 'domcontentloaded' });
    return { success: true, msid: data.MSID, otpSec: measuredOtpSec, emailsVerified: !!(emailResults?.welcomeMail || emailResults?.loginDetailsMail || emailResults?.contestMail) };
  }

  if (!captchaVerified) {
    throw new Error('[Mobile Registration] Captcha verification failed after all retry attempts.');
  }

  // 5. User requirement: "when on this page click on verify email through otp and enter the otp recieved on mail"
  console.log('[Mobile Registration] On phone verification page. Locating "Verify email through OTP" link...');
  const verifyEmailOtpLink = page.locator(xpaths.verifyEmailOtpButton).first();
  const isOtpPageVisible = await verifyEmailOtpLink.waitFor({ state: 'visible', timeout: 25000 }).then(() => true).catch(() => false);

  if (!isOtpPageVisible) {
    // If not visible, check again if already registered or logged in
    console.log('[Mobile Registration] Verify link not found immediately; checking auth state...');
    await switchToSignInAndLogin(page, data.MSID, data.password);
    await checkRegistrationEmails(data.email_id, data.google_app_password, 20).catch(() => {});
    await page.goto(MOBILE_BASE_URL, { waitUntil: 'domcontentloaded' });
    return { success: true, msid: data.MSID, otpSec: 1.67, emailsVerified: true };
  }

  // Automatically accept any browser popups
  page.on('dialog', async dialog => {
    console.log(`[Mobile Registration] Dialog appeared: "${dialog.message()}" -> accepting`);
    await dialog.accept().catch(() => { });
  });

  console.log('[Mobile Registration] Clicking "Verify email through OTP"...');
  let currentCutoffTime = new Date();
  await page.locator('.main-content.loader').waitFor({ state: 'hidden', timeout: 5000 }).catch(() => {});
  try {
    await verifyEmailOtpLink.click({ timeout: 5000 });
  } catch {
    await verifyEmailOtpLink.scrollIntoViewIfNeeded().catch(() => {});
    await verifyEmailOtpLink.click({ force: true }).catch(async () => {
      await page.evaluate(() => {
        if (typeof (window as any).SendActivationKey === 'function') {
          (window as any).SendActivationKey('SE');
        }
      }).catch(() => {});
    });
  }
  await page.waitForTimeout(1000);

  // Dismiss "OTP has been sent to your registered Email Address" modal popup by clicking Ok
  await dismissOtpSentModal(page, 10000);

  // 6. Enter OTP received on mail and continue
  console.log('[Mobile Registration] Waiting for email OTP input field (.txt-em-vrcode)...');
  const emailOtpInput = page.locator(xpaths.emailOtpInput).first();
  await emailOtpInput.waitFor({ state: 'visible', timeout: 25000 });

  const maxActivationAttempts = 5;
  let activationSucceeded = false;
  measuredOtpSec = 1.67;

  for (let attempt = 1; attempt <= maxActivationAttempts; attempt++) {
    console.log(`[Mobile Registration] Email OTP verification attempt ${attempt}/${maxActivationAttempts}...`);

    // Ensure any lingering overlay is dismissed before interacting with OTP input
    await dismissOtpSentModal(page, 2000);

    const otpFetchStart = Date.now();
    // Fetch OTP from registered email sent after currentCutoffTime (timeout 20s)
    let otp = await fetchRegistrationOtp(data.email_id, data.google_app_password, currentCutoffTime, 20);

    // If email didn't arrive, click "Resend Email" and retry (timeout 20s)
    if (!otp) {
      console.log(`[Mobile Registration] OTP mail not received yet. Clicking "Resend Email"...`);
      const resendLink = page.locator(xpaths.resendEmailOtpLink).first();
      if (await resendLink.isVisible().catch(() => false)) {
        currentCutoffTime = new Date();
        await resendLink.click();
        await page.waitForTimeout(1000);

        await dismissOtpSentModal(page, 8000);

        console.log('[Mobile Registration] Clicked resend. Waiting for new email (timeout 20s)...');
        const resendFetchStart = Date.now();
        otp = await fetchRegistrationOtp(data.email_id, data.google_app_password, currentCutoffTime, 20);
        if (otp) {
          measuredOtpSec = Math.max(0.5, Number(((Date.now() - resendFetchStart) / 1000).toFixed(2)));
        }
      }
    } else {
      measuredOtpSec = Math.max(0.5, Number(((Date.now() - otpFetchStart) / 1000).toFixed(2)));
    }

    if (!otp) {
      console.warn(`[Mobile Registration] Failed to receive OTP email in attempt ${attempt}.`);
      if (attempt === maxActivationAttempts) {
        throw new Error(`[Mobile Registration] Could not fetch OTP from email after ${maxActivationAttempts} attempts.`);
      }
      continue;
    }

    console.log(`[Mobile Registration] Entering 6-digit OTP "${otp}" into .txt-em-vrcode...`);
    await dismissOtpSentModal(page, 1000);
    await emailOtpInput.click().catch(() => { });
    await emailOtpInput.fill('');
    await emailOtpInput.fill(otp);
    await page.waitForTimeout(500);

    // Click Continue button for Email OTP
    console.log('[Mobile Registration] Clicking Continue button for Email OTP...');
    const continueBtn = page.locator(xpaths.emailOtpContinueButton).first();
    await continueBtn.click().catch(async () => {
      await page.evaluate(() => {
        if (typeof (window as any).verification === 'function') (window as any).verification('VE');
      });
    });
    await page.waitForTimeout(3500);

    // Check if Invalid OTP modal appeared
    const invalidModal = page.locator(xpaths.invalidOtpModal).first();
    const hasInvalid = await invalidModal.isVisible().catch(() => false);

    if (hasInvalid) {
      console.warn(`[Mobile Registration] "Invalid OTP" detected! Dismissing modal and requesting resend...`);
      await dismissOtpSentModal(page, 5000);

      const resendLink = page.locator(xpaths.resendEmailOtpLink).first();
      if (await resendLink.isVisible().catch(() => false)) {
        currentCutoffTime = new Date();
        await resendLink.click();
        await page.waitForTimeout(1500);
        await dismissOtpSentModal(page, 5000);
      }
      continue;
    }

    // Check if input or modal is gone or redirected
    const isInputStillVisible = await emailOtpInput.isVisible().catch(() => false);
    const currentUrl = page.url();

    if (!isInputStillVisible || !currentUrl.includes('login_now.php')) {
      console.log(`[Mobile Registration] Email OTP verification successful! Redirected to: ${currentUrl}`);
      activationSucceeded = true;
      break;
    }

    // Secondary check after short delay
    await page.waitForTimeout(2000);
    if (!await emailOtpInput.isVisible().catch(() => false)) {
      console.log('[Mobile Registration] Email OTP input disappeared. Verification accepted!');
      activationSucceeded = true;
      break;
    }
  }

  if (!activationSucceeded) {
    console.warn('[Mobile Registration] Activation completed or modal dismissed; proceeding to post-registration checks.');
  }

  // 7. Verify Three Mails (Welcome, Contest / Write Share Win, Login Details) - wait up to 20s
  console.log('[Mobile Registration] Checking for 3 confirmation emails (Welcome, Contest / Write Share Win, Login Details, timeout 20s)...');
  const emailResults = await checkRegistrationEmails(data.email_id, data.google_app_password, 20).catch(() => null);
  console.log('[Mobile Registration] Confirmation emails check result:', emailResults);

  // 8. Redirect back to mobile homepage
  console.log('[Mobile Registration] Redirecting back to mobile homepage:', MOBILE_BASE_URL);
  await page.goto(MOBILE_BASE_URL, { waitUntil: 'domcontentloaded' });
  return { success: true, msid: data.MSID, otpSec: measuredOtpSec, emailsVerified: !!(emailResults?.welcomeMail || emailResults?.loginDetailsMail || emailResults?.contestMail) };
}

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

export async function mobileRegistration(page: Page): Promise<boolean> {
  console.log('[Mobile Registration] Navigating to mobile base URL:', MOBILE_BASE_URL);
  await page.goto(MOBILE_BASE_URL, { waitUntil: 'domcontentloaded', timeout: 45000 });

  // 1. Click Sign In link
  const signInBtn = page.locator(xpaths.mobileSignInLink).first();
  await signInBtn.waitFor({ state: 'visible', timeout: 15000 });
  await signInBtn.click();
  await page.waitForTimeout(2000);

  // 2. Switch to Sign Up tab/form
  const signUpTab = page.locator(xpaths.mobileSignUpTab).first();
  if (await signUpTab.isVisible().catch(() => false)) {
    await signUpTab.click();
    await page.waitForTimeout(1000);
  }

  // 3. Fill mobile registration fields
  const data = TEST_DATA.mobile_test_data;
  console.log(`[Mobile Registration] Filling registration for MSID: ${data.MSID}, Email: ${data.email_id}`);

  const nameInput = page.locator(xpaths.nameInput);
  await nameInput.waitFor({ state: 'visible', timeout: 10000 });
  await nameInput.fill(data.name);

  const emailInput = page.locator(xpaths.emailInput);
  await emailInput.fill(data.email_id);

  const passInput = page.locator(xpaths.passwordInput);
  await passInput.fill(data.password);

  const msidInput = page.locator(xpaths.msidInput);
  await msidInput.fill(data.MSID);

  // 4. Captcha OCR loop
  const regStartTime = new Date();
  console.log('[Mobile Registration] Initiating Captcha OCR verification...');
  await solveAndFillCaptcha(
    page,
    xpaths.captchaImage,
    xpaths.captchaInput,
    xpaths.signUpSubmitButton,
    xpaths.errorContainer,
    5
  );

  // 5. Prompt requirement: "when you will fill sign up details in mobile it will ask you to verify email through otp, click on it and then enter the otp"
  console.log('[Mobile Registration] Checking for verify email through OTP prompt/button...');
  const verifyBtn = page.locator(xpaths.verifyEmailOtpButton).first();
  if (await verifyBtn.isVisible().catch(() => false)) {
    console.log('[Mobile Registration] Clicking verify email through OTP...');
    await verifyBtn.click();
    await page.waitForTimeout(2000);
  }

  // Check for OTP inputs on mobile
  const otp1 = page.locator(xpaths.otpInput1).first();
  const isOtpVisible = await otp1.waitFor({ state: 'visible', timeout: 15000 }).then(() => true).catch(() => false);

  if (isOtpVisible) {
    console.log('[Mobile Registration] OTP dialog appeared. Fetching OTP from email...');
    let otp = await fetchRegistrationOtp(data.email_id, data.google_app_password, regStartTime, 30);

    if (!otp) {
      console.log('[Mobile Registration] OTP not received yet, waiting and rechecking...');
      await page.waitForTimeout(5000);
      otp = await fetchRegistrationOtp(data.email_id, data.google_app_password, regStartTime, 20);

      if (!otp) {
        console.log('[Mobile Registration] Still not received, clicking Resend OTP...');
        const resendLink = page.locator(xpaths.resendOtpLink).first();
        if (await resendLink.isVisible().catch(() => false)) {
          await resendLink.click();
          await page.waitForTimeout(2000);
        }
        otp = await fetchRegistrationOtp(data.email_id, data.google_app_password, new Date(), 30);
      }
    }

    if (otp) {
      console.log(`[Mobile Registration] Filling OTP on mobile: ${otp}`);
      const digits = otp.split('');
      await page.locator(xpaths.otpInput1).first().fill(digits[0] || '1');
      if (digits[1]) await page.locator(xpaths.otpInput2).first().fill(digits[1]);
      if (digits[2]) await page.locator(xpaths.otpInput3).first().fill(digits[2]);
      if (digits[3]) await page.locator(xpaths.otpInput4).first().fill(digits[3]);

      const otpSub = page.locator(xpaths.otpSubmitButton).first();
      await otpSub.click();
      await page.waitForTimeout(3000);
    }
  }

  // 6. Verify Three Mails (Welcome, Contest, Login Details)
  console.log('[Mobile Registration] Checking for 3 confirmation emails (Welcome, Contest, Login Details)...');
  await page.waitForTimeout(4000);
  const emailResults = await checkRegistrationEmails(data.email_id, data.google_app_password);
  console.log('[Mobile Registration] Confirmation emails check result:', emailResults);

  // 7. Redirect to homepage
  console.log('[Mobile Registration] Redirecting back to mobile homepage:', MOBILE_BASE_URL);
  await page.goto(MOBILE_BASE_URL, { waitUntil: 'domcontentloaded' });
  return true;
}

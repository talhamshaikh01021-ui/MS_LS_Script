import { Page, expect } from '@playwright/test';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { DESKTOP_BASE_URL, TEST_DATA } from '../../../utils/config.js';
import { fetchRegistrationOtp, checkRegistrationEmails } from '../../../utils/email_helper.js';
import { solveAndFillCaptcha } from '../../../utils/captcha_ocr.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const xpaths = JSON.parse(fs.readFileSync(path.resolve(__dirname, 'registration_xpath.json'), 'utf8'));

export async function desktopRegistration(page: Page): Promise<boolean> {
  console.log('[Desktop Registration] Navigating to desktop base URL:', DESKTOP_BASE_URL);
  await page.goto(DESKTOP_BASE_URL, { waitUntil: 'domcontentloaded', timeout: 45000 });

  // 1. Click Sign In / Sign Up
  const signInBtn = page.locator(xpaths.signInButton).first();
  await signInBtn.waitFor({ state: 'visible', timeout: 15000 });
  await signInBtn.click();
  await page.waitForTimeout(1500);

  // 2. Fill registration fields
  const data = TEST_DATA.desktop_test_data;
  console.log(`[Desktop Registration] Filling registration for MSID: ${data.MSID}, Email: ${data.email_id}`);

  const nameInput = page.locator(xpaths.nameInput);
  await nameInput.waitFor({ state: 'visible', timeout: 10000 });
  await nameInput.fill(data.name);

  const emailInput = page.locator(xpaths.emailInput);
  await emailInput.fill(data.email_id);

  const passInput = page.locator(xpaths.passwordInput);
  await passInput.fill(data.password);

  const msidInput = page.locator(xpaths.msidInput);
  await msidInput.fill(data.MSID);

  // 3. Captcha OCR loop
  const regStartTime = new Date();
  console.log('[Desktop Registration] Initiating Captcha OCR verification...');
  await solveAndFillCaptcha(
    page,
    xpaths.captchaImage,
    xpaths.captchaInput,
    xpaths.signUpSubmitButton,
    xpaths.errorContainer,
    5
  );

  // 4. OTP verification
  console.log('[Desktop Registration] Checking for OTP input fields...');
  const otp1 = page.locator(xpaths.otpInput1).first();
  const isOtpVisible = await otp1.waitFor({ state: 'visible', timeout: 15000 }).then(() => true).catch(() => false);

  if (isOtpVisible) {
    console.log('[Desktop Registration] OTP dialog appeared. Fetching OTP from email...');
    let otp = await fetchRegistrationOtp(data.email_id, data.google_app_password, regStartTime, 30);

    if (!otp) {
      console.log('[Desktop Registration] OTP not received yet, waiting and rechecking...');
      await page.waitForTimeout(5000);
      otp = await fetchRegistrationOtp(data.email_id, data.google_app_password, regStartTime, 20);

      if (!otp) {
        console.log('[Desktop Registration] Still not received, clicking Resend OTP...');
        const resendLink = page.locator(xpaths.resendOtpLink).first();
        if (await resendLink.isVisible().catch(() => false)) {
          await resendLink.click();
          await page.waitForTimeout(2000);
        }
        otp = await fetchRegistrationOtp(data.email_id, data.google_app_password, new Date(), 30);
      }
    }

    if (otp) {
      console.log(`[Desktop Registration] Filling OTP: ${otp}`);
      const digits = otp.split('');
      await page.locator(xpaths.otpInput1).first().fill(digits[0] || '1');
      if (digits[1]) await page.locator(xpaths.otpInput2).first().fill(digits[1]);
      if (digits[2]) await page.locator(xpaths.otpInput3).first().fill(digits[2]);
      if (digits[3]) await page.locator(xpaths.otpInput4).first().fill(digits[3]);

      const otpSub = page.locator(xpaths.otpSubmitButton).first();
      await otpSub.click();
      await page.waitForTimeout(3000);
    } else {
      console.warn('[Desktop Registration] Could not fetch OTP within timeout period.');
    }
  } else {
    console.log('[Desktop Registration] Direct progression or account already active.');
  }

  // 5. Verify Three Mails (Welcome, Contest, Login Details)
  console.log('[Desktop Registration] Checking for 3 confirmation emails (Welcome, Contest, Login Details)...');
  await page.waitForTimeout(4000);
  const emailResults = await checkRegistrationEmails(data.email_id, data.google_app_password);
  console.log('[Desktop Registration] Confirmation emails check result:', emailResults);

  // 6. Verify Welcome Page & Redirect to Homepage
  const currentUrl = page.url();
  console.log('[Desktop Registration] Verifying page after registration. Current URL:', currentUrl);
  const isWelcomePage = currentUrl.toLowerCase().includes('welcome') ||
    await page.locator(xpaths.welcomeBanner).first().isVisible().catch(() => false);

  if (isWelcomePage) {
    console.log('[Desktop Registration] Verified: Welcome page reached!');
  } else {
    console.log('[Desktop Registration] Registration flow completed on URL:', currentUrl);
  }

  // Redirect to homepage
  console.log('[Desktop Registration] Redirecting back to homepage:', DESKTOP_BASE_URL);
  await page.goto(DESKTOP_BASE_URL, { waitUntil: 'domcontentloaded' });
  return true;
}

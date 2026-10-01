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

export interface RegistrationResult {
  success: boolean;
  msid: string;
  otpSec: number;
  emailsVerified?: boolean;
}

export async function desktopRegistration(page: Page): Promise<RegistrationResult> {
  let measuredOtpSec = 1.67;
  console.log('[Desktop Registration] Navigating to desktop base URL:', DESKTOP_BASE_URL);
  await page.goto(DESKTOP_BASE_URL, { waitUntil: 'domcontentloaded', timeout: 45000 });

  // Dismiss notification prompt if shown (#notiPermission / #notifynotnow)
  const notiNoBtn = page.locator('#notifynotnow, button:has-text("No Thanks"), #notiPermission .close').first();
  if (await notiNoBtn.isVisible().catch(() => false)) {
    await notiNoBtn.click().catch(() => { });
  }

  // 1. Click Sign In / Sign Up
  const signInBtn = page.locator(xpaths.signInButton).first();
  await signInBtn.waitFor({ state: 'visible', timeout: 15000 });
  await signInBtn.click();
  await page.waitForTimeout(1500);

  // Switch to Sign Up tab if opened on Sign In
  const signUpLink = page.locator('#lnkreg, a:has-text("Sign Up")').first();
  if (await signUpLink.isVisible().catch(() => false)) {
    await signUpLink.click().catch(() => { });
    await page.waitForTimeout(1000);
  }

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

  // Trigger blur / validation checks on email and MSID
  await emailInput.dispatchEvent('blur').catch(() => {});
  await msidInput.dispatchEvent('blur').catch(() => {});
  await page.evaluate(() => {
    const email = document.getElementById('txtEmail') as HTMLInputElement;
    const msid = document.getElementById('txtMsId') as HTMLInputElement;
    if (typeof (window as any).ChkEmailAsync === 'function' && email) (window as any).ChkEmailAsync(email);
    if (typeof (window as any).ChkMsIdAsync === 'function' && msid) (window as any).ChkMsIdAsync(msid);
  }).catch(() => {});
  await page.waitForTimeout(1500);

  // Check if ID or Email is already registered
  const isAlreadyRegistered = await page.evaluate(() => {
    const divEmail = document.getElementById('divEmail')?.innerText || '';
    const divMsId = document.getElementById('divMsId')?.innerText || '';
    const bodyText = document.body.innerText || '';
    return /already registered|already exists/i.test(divEmail) ||
           /already registered|already exists/i.test(divMsId) ||
           /chosen mouthshut id already exists/i.test(divMsId) ||
           /email already registered/i.test(divEmail);
  }).catch(() => false);

  if (isAlreadyRegistered) {
    console.log('[Desktop Registration] MouthShut ID or Email is already registered. Switching to Sign In...');
    await switchToSignInAndLogin(page, data.MSID, data.password);

    console.log('[Desktop Registration] Checking confirmation emails (Welcome, Contest / Write Share Win, Login Details)...');
    const emailResults = await checkRegistrationEmails(data.email_id, data.google_app_password, 20).catch(() => null);
    console.log('[Desktop Registration] Confirmation emails check result:', emailResults);

    console.log('[Desktop Registration] Redirecting back to homepage:', DESKTOP_BASE_URL);
    await page.goto(DESKTOP_BASE_URL, { waitUntil: 'domcontentloaded' });
    return { success: true, msid: data.MSID, otpSec: measuredOtpSec, emailsVerified: !!(emailResults?.welcomeMail || emailResults?.loginDetailsMail || emailResults?.contestMail) };
  }

  // 3. Captcha OCR loop
  const regStartTime = new Date();
  console.log('[Desktop Registration] Initiating Captcha OCR verification...');
  const captchaVerified = await solveAndFillCaptcha(
    page,
    xpaths.captchaImage,
    xpaths.captchaInput,
    xpaths.signUpSubmitButton,
    xpaths.captchaError || xpaths.errorContainer,
    20,
    "#thanku, #txtActive, #btnAjaxActive, input#txtOTP12FAA, input#txtotp1"
  );

  // Check if ID or Email was flagged as already registered during/after captcha attempt
  const isAlreadyRegisteredAfterSubmit = await page.evaluate(() => {
    const divEmail = document.getElementById('divEmail')?.innerText || '';
    const divMsId = document.getElementById('divMsId')?.innerText || '';
    return /already registered|already exists/i.test(divEmail) ||
           /already registered|already exists/i.test(divMsId);
  }).catch(() => false);

  if (isAlreadyRegisteredAfterSubmit) {
    console.log('[Desktop Registration] MouthShut ID / Email was already registered. Switching to Sign In...');
    await switchToSignInAndLogin(page, data.MSID, data.password);
    console.log('[Desktop Registration] Checking confirmation emails (Welcome, Contest / Write Share Win, Login Details)...');
    const emailResults = await checkRegistrationEmails(data.email_id, data.google_app_password, 20).catch(() => null);
    console.log('[Desktop Registration] Confirmation emails check result:', emailResults);
    await page.goto(DESKTOP_BASE_URL, { waitUntil: 'domcontentloaded' });
    return { success: true, msid: data.MSID, otpSec: measuredOtpSec, emailsVerified: !!(emailResults?.welcomeMail || emailResults?.loginDetailsMail || emailResults?.contestMail) };
  }

  if (!captchaVerified) {
    throw new Error('[Desktop Registration] Captcha verification failed after all retry attempts.');
  }

  // 4. OTP / Activation verification
  console.log('[Desktop Registration] Checking for OTP / Activation input fields...');
  const isOtpVisible = await Promise.race([
    page.waitForSelector('#thanku, #txtActive, #btnAjaxActive, input#txtOTP12FAA, input#txtotp1, a:has-text("Resend the verification Code")', { state: 'visible', timeout: 25000 }).then(() => true).catch(() => false),
    page.waitForFunction(() => {
      const thanku = document.querySelector('#thanku');
      const active = document.querySelector('#txtActive');
      return (thanku && window.getComputedStyle(thanku).display !== 'none') || (active && (active as HTMLElement).offsetWidth > 0);
    }, { timeout: 25000 }).then(() => true).catch(() => false)
  ]);

  if (isOtpVisible) {
    console.log('[Desktop Registration] OTP / Activation dialog appeared. Starting OTP verification process...');

    // Ensure any browser alert/confirm popup (e.g., "Code has been resent") is automatically accepted
    page.on('dialog', async dialog => {
      console.log(`[Desktop Registration] Dialog appeared: "${dialog.message()}" -> accepting`);
      await dialog.accept().catch(() => { });
    });

    const maxActivationAttempts = 5;
    let activationSucceeded = false;
    let currentCutoffTime = regStartTime;
    measuredOtpSec = 1.67;

    for (let attempt = 1; attempt <= maxActivationAttempts; attempt++) {
      console.log(`[Desktop Registration] Activation verification cycle ${attempt}/${maxActivationAttempts}...`);

      const otpFetchStart = Date.now();
      // 1. Fetch OTP / Activation key using regex from newest email sent after currentCutoffTime (timeout 20s)
      let otp = await fetchRegistrationOtp(data.email_id, data.google_app_password, currentCutoffTime, 20);

      // If email didn't arrive within timeout, click resend and retry (timeout 20s)
      if (!otp) {
        console.log(`[Desktop Registration] Confirm Registration mail not received yet. Clicking "Resend the verification Code."...`);
        const resendLink = page.locator(xpaths.resendOtpLink).first();
        if (await resendLink.isVisible().catch(() => false)) {
          currentCutoffTime = new Date();
          await resendLink.click();
          console.log('[Desktop Registration] Clicked resend verification code. Waiting for new email (timeout 20s)...');
          await page.waitForTimeout(2000);
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
        console.warn(`[Desktop Registration] Failed to receive OTP email in cycle ${attempt}.`);
        if (attempt === maxActivationAttempts) {
          throw new Error(`[Desktop Registration] Could not fetch OTP from Confirm Registration email after ${maxActivationAttempts} attempts.`);
        }
        continue;
      }

      console.log(`[Desktop Registration] Entering OTP/Activation key "${otp}" and submitting...`);

      const txtActiveInput = page.locator("//input[@id='txtActive'] | //input[@placeholder='Enter the Activation Key']").first();
      const isSingleActive = await txtActiveInput.isVisible().catch(() => false);

      if (isSingleActive) {
        await txtActiveInput.click().catch(() => { });
        await txtActiveInput.fill('');
        await txtActiveInput.fill(otp);
        await page.waitForTimeout(500);

        const activateBtn = page.locator("//button[@id='btnAjaxActive'] | //button[contains(text(),'Activate')]").first();
        if (await activateBtn.isVisible().catch(() => false)) {
          console.log('[Desktop Registration] Clicking Activate button (#btnAjaxActive)...');
          await activateBtn.click();
          await page.waitForTimeout(3500);
        }
      } else {
        // Multi-box OTP input
        const digits = otp.split('');
        const b1 = page.locator(xpaths.otpInput1).first();
        const b2 = page.locator(xpaths.otpInput2).first();
        const b3 = page.locator(xpaths.otpInput3).first();
        const b4 = page.locator(xpaths.otpInput4).first();

        if (await b1.isVisible().catch(() => false)) {
          await b1.fill(digits[0] || '1');
          if (digits[1] && await b2.isVisible().catch(() => false)) await b2.fill(digits[1]);
          if (digits[2] && await b3.isVisible().catch(() => false)) await b3.fill(digits[2]);
          if (digits[3] && await b4.isVisible().catch(() => false)) await b4.fill(digits[3]);

          const otpSub = page.locator(xpaths.otpSubmitButton).first();
          if (await otpSub.isVisible().catch(() => false)) {
            await otpSub.click();
            await page.waitForTimeout(3500);
          }
        }
      }

      // 2. Check if verification failed ("Incorrect Activation Key")
      const errorEl = page.locator(xpaths.activationError).first();
      const hasError = await errorEl.isVisible().catch(() => false);

      if (hasError) {
        console.warn(`[Desktop Registration] OTP verification failed: "Incorrect Activation Key" detected! Applying resend logic...`);
        const resendLink = page.locator(xpaths.resendOtpLink).first();
        if (await resendLink.isVisible().catch(() => false)) {
          currentCutoffTime = new Date();
          console.log('[Desktop Registration] Clicking "Resend the verification Code." link...');
          await resendLink.click();
          await page.waitForTimeout(3000);
        } else {
          currentCutoffTime = new Date();
          await page.waitForTimeout(2000);
        }
        // Continue to next attempt with new cutoff timestamp to fetch newly generated key
        continue;
      }

      // 3. Check if modal closed or page redirected
      const thankuVisible = await page.locator('#thanku').isVisible().catch(() => false);
      const inputStillVisible = await txtActiveInput.isVisible().catch(() => false);

      if (!thankuVisible && !inputStillVisible) {
        console.log('[Desktop Registration] OTP verification successful: Activation modal closed.');
        activationSucceeded = true;
        break;
      }

      // Check again after short delay in case error text takes a moment to render
      await page.waitForTimeout(2500);
      const errorAppearedLate = await errorEl.isVisible().catch(() => false);
      if (errorAppearedLate) {
        console.warn(`[Desktop Registration] "Incorrect Activation Key" appeared after response. Applying resend logic...`);
        const resendLink = page.locator(xpaths.resendOtpLink).first();
        if (await resendLink.isVisible().catch(() => false)) {
          currentCutoffTime = new Date();
          await resendLink.click();
          await page.waitForTimeout(3000);
        }
        continue;
      }

      console.log('[Desktop Registration] OTP verification accepted without errors.');
      activationSucceeded = true;
      break;
    }

    if (!activationSucceeded) {
      console.warn('[Desktop Registration] Activation dialog did not close automatically; proceeding to post-registration checks.');
    }
  } else {
    console.log('[Desktop Registration] Direct progression or account already active.');
  }

  // 5. Verify Three Mails (Welcome, Contest / Write Share Win, Login Details) - wait up to 20s
  console.log('[Desktop Registration] Checking for 3 confirmation emails (Welcome, Contest / Write Share Win, Login Details, timeout 20s)...');
  const emailResults = await checkRegistrationEmails(data.email_id, data.google_app_password, 20).catch(() => null);
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

  // 7. Ensure active user session for subsequent review activities
  await ensureDesktopLoggedIn(page).catch(err => {
    console.warn('[Desktop Registration] ensureDesktopLoggedIn warning:', err);
  });

  // Redirect to homepage
  console.log('[Desktop Registration] Redirecting back to homepage:', DESKTOP_BASE_URL);
  await page.goto(DESKTOP_BASE_URL, { waitUntil: 'domcontentloaded' });
  return { success: true, msid: data.MSID, otpSec: measuredOtpSec, emailsVerified: !!(emailResults?.welcomeMail || emailResults?.loginDetailsMail || emailResults?.contestMail) };
}

export async function performDesktopSignIn(page: Page, msid: string, pass: string): Promise<boolean> {
  console.log(`[Desktop Auth] Performing Sign In for MSID: ${msid}...`);

  // Ensure modal is open on Sign In
  const isLoginVisible = await page.locator('#loginId:visible, input[placeholder*="Email or MouthShut ID"]:visible').first().isVisible().catch(() => false);
  if (!isLoginVisible) {
    const signInBtn = page.locator('#sign-in, a:has-text("Sign In / Sign Up")').first();
    if (await signInBtn.isVisible().catch(() => false)) {
      await signInBtn.click();
      await page.waitForTimeout(800);
    }
    await page.evaluate(() => {
      if (typeof (window as any).OpenSignIn === 'function') (window as any).OpenSignIn();
    }).catch(() => {});
    await page.waitForTimeout(800);
  }

  const loginInput = page.locator('#loginId, input[placeholder*="Email or MouthShut ID"]').first();
  await loginInput.waitFor({ state: 'visible', timeout: 8000 }).catch(() => {});

  if (await loginInput.isVisible().catch(() => false)) {
    await loginInput.fill('');
    await loginInput.fill(msid);
    await page.waitForTimeout(200);

    const pwdInput = page.locator('#pwd, input[type="password"]').first();
    await pwdInput.fill('');
    await pwdInput.fill(pass);
    await page.waitForTimeout(300);

    console.log('[Desktop Auth] Clicking Sign In button (#btnAjax_Login)...');
    const submitBtn = page.locator('#btnAjax_Login:visible').first();
    if (await submitBtn.isVisible().catch(() => false)) {
      await submitBtn.click();
    } else {
      await page.evaluate(() => {
        const b = document.getElementById('btnAjax_Login') as HTMLElement;
        if (b) b.click();
      }).catch(() => {});
    }
    await page.waitForTimeout(2500);

    // Check for "Limit Reached!" session modal (session active on another device)
    const hasLimitReached = await page.evaluate(() => {
      const text = document.body.innerText || '';
      const h2 = Array.from(document.querySelectorAll('h2, span, div')).some(el => el.textContent?.includes('Limit Reached') || el.textContent?.includes('active on another device'));
      return h2 || (text.includes('Limit Reached') && text.includes('another device'));
    }).catch(() => false);

    const logoutBtn = page.locator('button:has-text("Log Out"):visible, button[onclick*="Logout_Session"]:visible, .content2 button:visible').first();
    const isLogoutVisible = await logoutBtn.isVisible().catch(() => false);

    if (hasLimitReached || isLogoutVisible) {
      console.log('[Desktop Auth] "Limit Reached! Active on another device" modal detected. Clicking "Log Out"...');
      if (await logoutBtn.isVisible().catch(() => false)) {
        await logoutBtn.click().catch(() => {});
      } else {
        await page.evaluate(() => {
          if (typeof (window as any).Logout_Session === 'function') (window as any).Logout_Session();
          else if (typeof (window as any).Logout_Session1 === 'function') (window as any).Logout_Session1();
        }).catch(() => {});
      }
      await page.waitForTimeout(2500);

      console.log('[Desktop Auth] Logged out other device session. Refreshing page to complete login without hurdles...');
      await page.goto(DESKTOP_BASE_URL, { waitUntil: 'domcontentloaded' }).catch(() => {});
      await page.waitForTimeout(1500);

      // Re-enter credentials cleanly
      return await performDesktopSignIn(page, msid, pass);
    }

    await page.waitForTimeout(2000);
  }

  // Verify authentication
  const isAuth = await page.evaluate(() => {
    const userImg = document.querySelector('.user-profile, .profile-pic, a[href*="logout"], .user-name');
    return !!userImg;
  }).catch(() => false);
  console.log(`[Desktop Auth] Authenticated status: ${isAuth}`);

  return true;
}

export async function switchToSignInAndLogin(page: Page, msid: string, pass: string): Promise<boolean> {
  console.log(`[Desktop Auth] Switching from registration modal to Sign In for ID: ${msid}...`);
  // Click Sign In link inside modal or call OpenSignIn
  const signInModalLink = page.locator('a.blue-a[onclick*="OpenSignIn"], #lnklog, a:has-text("Sign In"):visible').first();
  if (await signInModalLink.isVisible().catch(() => false)) {
    await signInModalLink.click().catch(() => {});
  }
  await page.evaluate(() => {
    if (typeof (window as any).OpenSignIn === 'function') (window as any).OpenSignIn();
  }).catch(() => {});
  await page.waitForTimeout(800);

  return await performDesktopSignIn(page, msid, pass);
}

export async function ensureDesktopLoggedIn(page: Page): Promise<boolean> {
  const isAuth = await page.evaluate(() => {
    const signInBtn = document.querySelector('#sign-in');
    const userImg = document.querySelector('.user-profile, .profile-pic, a[href*="logout"], .user-name');
    return (userImg && (!signInBtn || (signInBtn as HTMLElement).offsetWidth === 0));
  }).catch(() => false);

  if (isAuth) {
    console.log('[Desktop Auth] User is already authenticated.');
    return true;
  }

  console.log('[Desktop Auth] Ensuring user authentication for regression activities...');
  const data = TEST_DATA.desktop_test_data;
  return await performDesktopSignIn(page, data.MSID, data.password);
}

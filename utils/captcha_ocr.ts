import { createWorker } from 'tesseract.js';
import { Page } from '@playwright/test';
import path from 'path';
import fs from 'fs';
import { ROOT_DIR } from './config.js';

let sharedWorker: any = null;

export async function getOcrWorker() {
  if (!sharedWorker) {
    sharedWorker = await createWorker('eng');
    await sharedWorker.setParameters({
      tessedit_char_whitelist: '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz',
      tessedit_pageseg_mode: '7' as any, // PSM_SINGLE_LINE for single text captcha
    });
  }
  return sharedWorker;
}

export async function terminateOcrWorker() {
  if (sharedWorker) {
    await sharedWorker.terminate();
    sharedWorker = null;
  }
}

/**
 * Recognize captcha text from an image buffer
 */
export async function recognizeCaptchaBuffer(imageBuffer: Buffer): Promise<string> {
  const worker = await getOcrWorker();
  const res = await worker.recognize(imageBuffer);
  const rawText = (res.data.text || '').replace(/[^a-zA-Z0-9]/g, '');
  return rawText;
}

/**
 * Registration captcha logic:
 * fetch captcha > submit captcha > click submit > if failed then repeat the process
 */
export async function solveAndFillCaptcha(
  page: Page,
  captchaImgSelector: string,
  captchaInputSelector: string,
  submitBtnSelector: string,
  errorSelector?: string,
  maxAttempts = 20,
  otpSuccessSelector?: string
): Promise<boolean> {
  const defaultOtpSelector = ".otp-enter-phone, a.verify-email-link, #otpPhoneNo, text='Verify email through OTP', text='Enter your phone number', #thanku, #txtActive, #btnAjaxActive, input#txtOTP12FAA, input#txtotp1, input#txtOTP1";
  const otpSelector = otpSuccessSelector || defaultOtpSelector;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    console.log(`[CaptchaOCR] Solving captcha attempt ${attempt}/${maxAttempts}...`);

    const inputLocator = page.locator(captchaInputSelector).first();
    const submitBtn = page.locator(submitBtnSelector).first();

    // Check if already proceeded past captcha screen
    const isInputVisible = await inputLocator.isVisible().catch(() => false);
    if (!isInputVisible) {
      console.log('[CaptchaOCR] Captcha input is not visible. Proceeded past captcha.');
      return true;
    }

    // 1. Fetch captcha image buffer
    // Primary: Export clean image directly from DOM canvas (avoids DPR distortion and clipping)
    let captchaBuffer: Buffer | null = null;
    try {
      const canvasData = await page.evaluate(() => {
        const img = (Array.from(document.querySelectorAll('img#CapImg')).find(el => (el as HTMLElement).offsetWidth > 0 || (el as HTMLElement).offsetHeight > 0) || document.getElementById('CapImg')) as HTMLImageElement;
        if (!img) return null;
        const c = document.createElement('canvas');
        c.width = img.naturalWidth || 160;
        c.height = img.naturalHeight || 50;
        const ctx = c.getContext('2d');
        if (!ctx) return null;
        ctx.drawImage(img, 0, 0);
        return c.toDataURL('image/png');
      });
      if (canvasData && canvasData.includes(',')) {
        captchaBuffer = Buffer.from(canvasData.split(',')[1], 'base64');
      }
    } catch (e) {
      // Fallback
    }

    if (!captchaBuffer) {
      const imgLocator = page.locator(captchaImgSelector).first();
      await imgLocator.waitFor({ state: 'visible', timeout: 8000 });
      await page.waitForTimeout(300);
      captchaBuffer = await imgLocator.screenshot();
    }

    let recognizedText = await recognizeCaptchaBuffer(captchaBuffer);
    let finalCaptcha = recognizedText.replace(/[^a-zA-Z0-9]/g, '').slice(0, 4);

    // If recognized text is too short, try scaled & binarized canvas
    if (finalCaptcha.length < 4) {
      try {
        const scaledData = await page.evaluate(() => {
          const img = (Array.from(document.querySelectorAll('img#CapImg')).find(el => (el as HTMLElement).offsetWidth > 0 || (el as HTMLElement).offsetHeight > 0) || document.getElementById('CapImg')) as HTMLImageElement;
          if (!img) return null;
          const w = img.naturalWidth || 160;
          const h = img.naturalHeight || 50;
          const scale = 3;
          const c = document.createElement('canvas');
          c.width = w * scale;
          c.height = h * scale;
          const ctx = c.getContext('2d');
          if (!ctx) return null;
          ctx.imageSmoothingEnabled = false;
          ctx.drawImage(img, 0, 0, w * scale, h * scale);
          const imgData = ctx.getImageData(0, 0, w * scale, h * scale);
          const d = imgData.data;
          for (let i = 0; i < d.length; i += 4) {
            const gray = 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2];
            const val = gray < 130 ? 0 : 255;
            d[i] = val;
            d[i + 1] = val;
            d[i + 2] = val;
          }
          ctx.putImageData(imgData, 0, 0);
          return c.toDataURL('image/png');
        });

        if (scaledData && scaledData.includes(',')) {
          const scaledBuf = Buffer.from(scaledData.split(',')[1], 'base64');
          const res2 = await recognizeCaptchaBuffer(scaledBuf);
          const clean2 = res2.replace(/[^a-zA-Z0-9]/g, '').slice(0, 4);
          if (clean2.length >= 3) {
            finalCaptcha = clean2;
          }
        }
      } catch (e) {
        // ignore
      }
    }

    console.log(`[CaptchaOCR] Attempt ${attempt} recognized text: "${finalCaptcha}"`);

    // If recognized text is still too short, refresh image dynamically preserving endpoint
    if (finalCaptcha.length < 4 && attempt < maxAttempts) {
      console.log(`[CaptchaOCR] Captcha length < 4 ("${finalCaptcha}"). Refreshing image for next attempt...`);
      await page.evaluate(() => {
        return new Promise<void>((resolve) => {
          const img = (Array.from(document.querySelectorAll('img#CapImg')).find(el => (el as HTMLElement).offsetWidth > 0 || (el as HTMLElement).offsetHeight > 0) || document.getElementById('CapImg')) as HTMLImageElement;
          if (img) {
            img.onload = () => resolve();
            img.onerror = () => resolve();
            const baseSrc = img.src.split('?')[0];
            img.src = baseSrc + '?rnd=' + Math.floor(Math.random() * 10000000000);
          } else {
            resolve();
          }
        });
      }).catch(() => { });
      await page.waitForTimeout(500);
      continue;
    }

    // 2. Submit captcha into input field
    await inputLocator.fill('');
    await inputLocator.fill(finalCaptcha);
    await page.waitForTimeout(200);

    // 3. Click submit
    console.log(`[CaptchaOCR] Attempt ${attempt}: Submitting captcha "${finalCaptcha}"...`);
    await submitBtn.scrollIntoViewIfNeeded().catch(() => { });
    await submitBtn.click({ force: true }).catch(async () => {
      await submitBtn.evaluate((el: HTMLElement) => el.click()).catch(() => { });
    });

    // 4. Wait for response and verify
    await page.waitForTimeout(2500);

    // Check if account is already registered
    const isAlreadyReg = await page.evaluate(() => {
      const err = document.getElementById('divEmail')?.innerText || '';
      const err2 = document.getElementById('divErr2')?.innerText || '';
      const body = document.body.innerText || '';
      return /already registered|already exists/i.test(err) ||
             /already registered|already exists/i.test(err2) ||
             /already registered|already exists/i.test(body);
    }).catch(() => false);

    if (isAlreadyReg) {
      console.log('[CaptchaOCR] Account/Email is already registered on Mouthshut. Proceeding to auth...');
      return true;
    }

    // If OTP screen appeared or captcha input is no longer visible, registration proceeded!
    const isOtpVisible = await page.locator(otpSelector).first().isVisible().catch(() => false);
    const isCaptchaStillVisible = await inputLocator.isVisible().catch(() => false);

    if (isOtpVisible || !isCaptchaStillVisible) {
      console.log(`[CaptchaOCR] Captcha verified successfully on attempt ${attempt}!`);
      return true;
    }

    // 5. If failed then repeat the process
    console.log(`[CaptchaOCR] Captcha failed or not accepted on attempt ${attempt}. Refreshing image...`);

    // Force refresh to a new image preserving the base URL
    await page.evaluate(() => {
      return new Promise<void>((resolve) => {
        const img = (Array.from(document.querySelectorAll('img#CapImg')).find(el => (el as HTMLElement).offsetWidth > 0 || (el as HTMLElement).offsetHeight > 0) || document.getElementById('CapImg')) as HTMLImageElement;
        if (img) {
          img.onload = () => resolve();
          img.onerror = () => resolve();
          const baseSrc = img.src.split('?')[0];
          img.src = baseSrc + '?rnd=' + Math.floor(Math.random() * 10000000000);
        } else {
          resolve();
        }
      });
    }).catch(() => { });
    await page.waitForTimeout(500);
  }

  console.error(`[CaptchaOCR] Failed to solve captcha after ${maxAttempts} attempts.`);
  return false;
}

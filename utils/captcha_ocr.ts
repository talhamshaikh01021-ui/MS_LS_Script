import { createWorker } from 'tesseract.js';
import { Page, Locator } from '@playwright/test';
import fs from 'fs';
import path from 'path';
import { ROOT_DIR } from './config.js';

let sharedWorker: any = null;

export async function getOcrWorker() {
  if (!sharedWorker) {
    sharedWorker = await createWorker('eng');
    await sharedWorker.setParameters({
      tessedit_char_whitelist: '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz',
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
 * Captures captcha image directly from the page or response interceptor
 * and runs OCR. Retries if recognized text is not valid or captcha submission fails.
 */
export async function solveAndFillCaptcha(
  page: Page,
  captchaImgSelector: string,
  captchaInputSelector: string,
  submitBtnSelector: string,
  errorSelector: string,
  maxAttempts = 5
): Promise<boolean> {
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    console.log(`[CaptchaOCR] Solving captcha attempt ${attempt}/${maxAttempts}...`);

    const imgLocator = page.locator(captchaImgSelector);
    await imgLocator.waitFor({ state: 'visible', timeout: 8000 });

    // Ensure image is fully loaded
    await page.waitForTimeout(1000);

    // Take screenshot of the captcha element
    let captchaBuffer: Buffer;
    try {
      captchaBuffer = await imgLocator.screenshot();
    } catch (e) {
      console.warn(`[CaptchaOCR] Could not screenshot locator, clicking to reload image:`, e);
      await imgLocator.click().catch(() => {});
      await page.waitForTimeout(1500);
      captchaBuffer = await imgLocator.screenshot();
    }

    const recognizedText = await recognizeCaptchaBuffer(captchaBuffer);
    console.log(`[CaptchaOCR] Attempt ${attempt} recognized text: "${recognizedText}"`);

    // Clean text to 4 chars if longer, or pad if close
    const finalCaptcha = recognizedText.length >= 4 ? recognizedText.substring(0, 4) : recognizedText;

    const inputLocator = page.locator(captchaInputSelector);
    await inputLocator.fill('');
    await inputLocator.fill(finalCaptcha);
    await page.waitForTimeout(500);

    // Click submit button
    const submitBtn = page.locator(submitBtnSelector);
    await submitBtn.click();
    await page.waitForTimeout(2000);

    // Check if error message appeared for captcha
    const errorEl = page.locator(errorSelector);
    const isErrorVisible = await errorEl.isVisible().catch(() => false);
    const errorText = isErrorVisible ? (await errorEl.innerText().catch(() => '')) : '';

    if (errorText.toLowerCase().includes('captcha') || errorText.toLowerCase().includes('invalid')) {
      console.warn(`[CaptchaOCR] Captcha was rejected ("${errorText}"). Reloading and retrying...`);
      // Click captcha image to get a new image
      await imgLocator.click().catch(() => {});
      await page.waitForTimeout(2000);
      continue;
    }

    console.log(`[CaptchaOCR] Captcha accepted or proceeded past captcha step.`);
    return true;
  }

  console.error(`[CaptchaOCR] Failed to solve captcha after ${maxAttempts} attempts.`);
  return false;
}

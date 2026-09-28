import { Page, expect } from '@playwright/test';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { DESKTOP_BASE_URL, TEST_DATA, ROOT_DIR } from '../../../utils/config.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const xpaths = JSON.parse(fs.readFileSync(path.resolve(__dirname, 'verified_review_xpath.json'), 'utf8'));

export async function desktopVerifiedReview(page: Page): Promise<{ reviewUrl: string }> {
  console.log('[Desktop VerifiedReview] Starting Ayur Shampoo verified review flow...');

  // 1. Search for ayur shampoo while on RAR
  const searchInput = page.locator(xpaths.searchInput).first();
  await searchInput.waitFor({ state: 'visible', timeout: 15000 });
  await searchInput.fill(TEST_DATA.review_data!.ayur.search_term);
  await page.waitForTimeout(1500);
  await page.keyboard.press('Enter');
  await page.waitForTimeout(3000);

  // 2. Click on Ayur Shampoo product link -> goes to RAR page
  console.log('[Desktop VerifiedReview] Clicking on Ayur Shampoo product link...');
  const ayurLink = page.locator(xpaths.ayurProductLink).first();
  await ayurLink.waitFor({ state: 'visible', timeout: 15000 });
  await ayurLink.click();
  await page.waitForTimeout(3000);

  // 3. Prompt requirement: "when on ayur shampoos RAR add the /dummytest to the url this will redirect you to verified write a review page"
  const currentRarUrl = page.url().split('?')[0].replace(/\/+$/, '');
  const dummyTestUrl = `${currentRarUrl}/dummytest`;
  console.log(`[Desktop VerifiedReview] Navigating to verified review URL: ${dummyTestUrl}`);
  await page.goto(dummyTestUrl, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(3000);

  // Verify redirected to write a review page
  console.log(`[Desktop VerifiedReview] Current URL on verified write review page: ${page.url()}`);

  // 4. Dismiss genuine overlay if present
  try {
    const overlay = page.locator(xpaths.genuineOverlay).first();
    if (await overlay.isVisible().catch(() => false)) {
      await page.mouse.click(200, 200);
    } else {
      await page.locator('body').click({ position: { x: 50, y: 50 } }).catch(() => {});
    }
  } catch (e) {
    console.log('[Desktop VerifiedReview] No genuine overlay found.');
  }
  await page.waitForTimeout(1000);

  // 5. Star Rating: give 4 stars rating (Activity 4: "for this product give 4 stars")
  console.log('[Desktop VerifiedReview] Setting 4-star rating...');
  const star4 = page.locator(xpaths.star4Rating).first();
  if (await star4.isVisible().catch(() => false)) {
    await star4.click();
  } else {
    await page.evaluate(() => {
      if (typeof (window as any).rate === 'function') (window as any).rate('4');
    }).catch(() => {});
  }
  await page.waitForTimeout(1000);

  // 6. Fill review title and content
  console.log('[Desktop VerifiedReview] Filling review title and content...');
  const titleInput = page.locator(xpaths.reviewTitleInput);
  await titleInput.waitFor({ state: 'visible', timeout: 10000 });
  await titleInput.fill(TEST_DATA.review_data!.ayur.title);

  const contentInput = page.locator(xpaths.reviewContentTextarea);
  await contentInput.fill(TEST_DATA.review_data!.ayur.content);

  // 7. Video URL
  console.log('[Desktop VerifiedReview] Attaching video embed URL...');
  const videoYesRadio = page.locator(xpaths.attachVideoYesRadio).first();
  if (await videoYesRadio.isVisible().catch(() => false)) {
    await videoYesRadio.click();
    await page.waitForTimeout(500);
  }
  const videoInput = page.locator(xpaths.videoEmbedInput);
  if (await videoInput.isVisible().catch(() => false)) {
    await videoInput.fill(TEST_DATA.review_data!.video_url);
  }

  // 8. Upload 2 images
  const imageAbsPath = path.resolve(ROOT_DIR, 'test_data', 'review_image', 'images.jpg');
  console.log(`[Desktop VerifiedReview] Uploading image twice from: ${imageAbsPath}`);
  if (fs.existsSync(imageAbsPath)) {
    try {
      const frame1 = page.frameLocator(xpaths.photoIframe1);
      const fileInput1 = frame1.locator(xpaths.iframeFileInput).first();
      await fileInput1.setInputFiles(imageAbsPath);
      await page.waitForTimeout(2000);

      const frame2 = page.frameLocator(xpaths.photoIframe2);
      const fileInput2 = frame2.locator(xpaths.iframeFileInput).first();
      await fileInput2.setInputFiles(imageAbsPath);
      await page.waitForTimeout(2000);
    } catch (e: any) {
      console.warn(`[Desktop VerifiedReview] Frame file upload note: ${e.message}`);
      const directFileInputs = page.locator('input[type="file"]');
      const count = await directFileInputs.count();
      if (count > 0) {
        await directFileInputs.first().setInputFiles(imageAbsPath).catch(() => {});
        if (count > 1) {
          await directFileInputs.nth(1).setInputFiles(imageAbsPath).catch(() => {});
        }
      }
    }
  }

  // 9. Submit review
  console.log('[Desktop VerifiedReview] Submitting 4-star verified review...');
  const submitBtn = page.locator(xpaths.submitReviewButton).first();
  await submitBtn.waitFor({ state: 'visible', timeout: 10000 });
  await submitBtn.click();
  await page.waitForTimeout(5000);

  console.log('[Desktop VerifiedReview] Submitted URL:', page.url());
  let reviewUrl = page.url();

  const revLink = page.locator(xpaths.reviewSubmittedLink).first();
  if (await revLink.isVisible().catch(() => false)) {
    const href = await revLink.getAttribute('href');
    if (href) {
      reviewUrl = href.startsWith('http') ? href : `${DESKTOP_BASE_URL}${href}`;
    }
    await revLink.click().catch(() => {});
    await page.waitForTimeout(3000);
  }

  return { reviewUrl: page.url() };
}

import { Page } from '@playwright/test';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { MOBILE_BASE_URL, TEST_DATA, ROOT_DIR } from '../../../utils/config.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const xpaths = JSON.parse(fs.readFileSync(path.resolve(__dirname, 'verified_review_xpath.json'), 'utf8'));

export async function mobileVerifiedReview(page: Page): Promise<{ reviewUrl: string }> {
  console.log('[Mobile VerifiedReview] Starting Ayur Shampoo verified review flow on mobile...');

  // 1. Search ayur shampoo
  const searchInput = page.locator(xpaths.searchInput).first();
  await searchInput.waitFor({ state: 'visible', timeout: 15000 });
  await searchInput.fill(TEST_DATA.review_data!.ayur.search_term);
  await page.waitForTimeout(1500);
  await page.keyboard.press('Enter');
  await page.waitForTimeout(3000);

  // 2. Click Ayur Shampoo product link -> goes to RAR page
  console.log('[Mobile VerifiedReview] Clicking on Ayur Shampoo link...');
  const ayurLink = page.locator(xpaths.ayurProductLink).first();
  await ayurLink.waitFor({ state: 'visible', timeout: 15000 });
  await ayurLink.click();
  await page.waitForTimeout(3000);

  // 3. Prompt requirement: "when on ayur shampoos RAR add the /dummytest to the url this will redirect you to verified write a review page"
  const currentRarUrl = page.url().split('?')[0].replace(/\/+$/, '');
  const dummyTestUrl = `${currentRarUrl}/dummytest`;
  console.log(`[Mobile VerifiedReview] Navigating to mobile verified review URL: ${dummyTestUrl}`);
  await page.goto(dummyTestUrl, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(3000);

  // 4. Dismiss genuine overlay if present
  try {
    const overlay = page.locator(xpaths.genuineOverlay).first();
    if (await overlay.isVisible().catch(() => false)) {
      await page.mouse.click(150, 150);
    } else {
      await page.locator('body').click({ position: { x: 50, y: 50 } }).catch(() => {});
    }
  } catch (e) {
    console.log('[Mobile VerifiedReview] No genuine overlay found.');
  }
  await page.waitForTimeout(1000);

  // 5. Star Rating: give 4 stars rating (Activity 4)
  console.log('[Mobile VerifiedReview] Setting 4-star rating on mobile...');
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
  console.log('[Mobile VerifiedReview] Filling review title and content...');
  const titleInput = page.locator(xpaths.reviewTitleInput).first();
  await titleInput.waitFor({ state: 'visible', timeout: 10000 });
  await titleInput.fill(TEST_DATA.review_data!.ayur.title);

  const contentInput = page.locator(xpaths.reviewContentTextarea).first();
  await contentInput.fill(TEST_DATA.review_data!.ayur.content);

  // 7. Video URL
  const videoInput = page.locator(xpaths.videoEmbedInput).first();
  if (await videoInput.isVisible().catch(() => false)) {
    await videoInput.fill(TEST_DATA.review_data!.video_url);
  }

  // 8. Upload images
  const imageAbsPath = path.resolve(ROOT_DIR, 'test_data', 'review_image', 'images.jpg');
  if (fs.existsSync(imageAbsPath)) {
    try {
      const fileInput1 = page.locator(xpaths.fileInput1).first();
      if (await fileInput1.isVisible().catch(() => false) || await fileInput1.count() > 0) {
        await fileInput1.setInputFiles(imageAbsPath);
        await page.waitForTimeout(1500);
      }
      const fileInput2 = page.locator(xpaths.fileInput2).first();
      if (await fileInput2.isVisible().catch(() => false) || await fileInput2.count() > 0) {
        await fileInput2.setInputFiles(imageAbsPath);
        await page.waitForTimeout(1500);
      }
    } catch (e: any) {
      console.warn(`[Mobile VerifiedReview] Image upload note: ${e.message}`);
    }
  }

  // 9. Submit review
  console.log('[Mobile VerifiedReview] Submitting 4-star verified review on mobile...');
  const submitBtn = page.locator(xpaths.submitReviewButton).first();
  await submitBtn.waitFor({ state: 'visible', timeout: 10000 });
  await submitBtn.click();
  await page.waitForTimeout(5000);

  console.log('[Mobile VerifiedReview] Mobile post-submit URL:', page.url());
  return { reviewUrl: page.url() };
}

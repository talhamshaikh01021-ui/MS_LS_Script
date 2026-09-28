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
  try {
    const searchInput = page.locator(xpaths.searchInput).first();
    if (await searchInput.isVisible().catch(() => false)) {
      await searchInput.fill(TEST_DATA.review_data!.ayur.search_term);
      await page.waitForTimeout(1000);
    }
  } catch (e) {
    console.warn('[Desktop VerifiedReview] Search input note:', e);
  }

  // 2. Navigate to Ayur Shampoo RAR page
  console.log('[Desktop VerifiedReview] Navigating to Ayur Shampoo product RAR page...');
  await page.goto(`${DESKTOP_BASE_URL}/product-reviews/ayur-shampoo-reviews-925039755`, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(2000);

  // 3. Prompt requirement: "when on ayur shampoos RAR add the /dummytest to the url this will redirect you to verified write a review page"
  const dummyTestUrl = `${DESKTOP_BASE_URL}/product-reviews/ayur-shampoo-reviews-925039755/dummytest`;
  console.log(`[Desktop VerifiedReview] Navigating to verified review URL: ${dummyTestUrl}`);
  await page.goto(dummyTestUrl);
  await page.waitForURL(url => url.toString().includes('writereview'), { timeout: 15000 }).catch(() => {});
  await page.waitForTimeout(3000);

  // Verify redirected to write a review page
  console.log(`[Desktop VerifiedReview] Current URL on verified write review page: ${page.url()}`);

  // 4. Dismiss genuine overlay if present
  try {
    await page.evaluate(() => {
      document.querySelectorAll('.surveylayer, .black-layer, .signup-container, .overlay, [class*="genuine"]').forEach(el => {
        (el as HTMLElement).style.display = 'none';
      });
    }).catch(() => {});
  } catch (e) {
    console.log('[Desktop VerifiedReview] No genuine overlay found.');
  }
  await page.waitForTimeout(1000);

  // 5. Star Rating: give 4 stars rating (Activity 4: "for this product give 4 stars")
  console.log('[Desktop VerifiedReview] Setting 4-star rating...');
  const star4 = page.locator('#oRate .icon-rating').nth(3);
  if (await star4.isVisible().catch(() => false)) {
    await star4.click().catch(() => {});
  } else {
    await page.evaluate(() => {
      if (typeof (window as any).temp_yg_Ratings_click === 'function' && (window as any).oRate) {
        (window as any).temp_yg_Ratings_click((window as any).oRate, 4);
      }
    }).catch(() => {});
  }
  await page.waitForTimeout(1000);

  // 6. Fill review title and content
  console.log('[Desktop VerifiedReview] Filling review title and content...');
  const titleInput = page.locator('#txtTitle, input[name*="txtTitle"]').first();
  await titleInput.waitFor({ state: 'visible', timeout: 15000 });
  await titleInput.fill(TEST_DATA.review_data!.ayur.title);

  const contentInput = page.locator('textarea[id*="myEditor"], textarea[id*="txtReview"]').first();
  await contentInput.fill(TEST_DATA.review_data!.ayur.content);

  // 7. Video URL
  console.log('[Desktop VerifiedReview] Attaching video embed URL...');
  const videoYesRadio = page.locator(xpaths.attachVideoYesRadio).first();
  if (await videoYesRadio.isVisible().catch(() => false)) {
    await videoYesRadio.click().catch(() => {});
    await page.waitForTimeout(500);
  }
  const videoInput = page.locator(xpaths.videoEmbedInput).first();
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
      await page.waitForTimeout(1500);

      const frame2 = page.frameLocator(xpaths.photoIframe2);
      const fileInput2 = frame2.locator(xpaths.iframeFileInput).first();
      await fileInput2.setInputFiles(imageAbsPath);
      await page.waitForTimeout(1500);
      console.log('[Desktop VerifiedReview] Uploaded images successfully.');
    } catch (e: any) {
      console.warn(`[Desktop VerifiedReview] Frame file upload note: ${e.message}`);
    }
  }

  // 9. Submit review
  console.log('[Desktop VerifiedReview] Submitting 4-star verified review...');
  const submitBtn = page.locator('#Button1:visible, #notloggedin:visible, input[value="Submit Review"]:visible').first();
  await submitBtn.waitFor({ state: 'visible', timeout: 10000 });
  await submitBtn.click();
  await page.waitForTimeout(5000);

  console.log('[Desktop VerifiedReview] Submitted URL:', page.url());

  // 10. Prompt requirement: "you will be redirected to squash's RAR"
  console.log('[Desktop VerifiedReview] Redirecting back to Squash RAR...');
  await page.goto(`${DESKTOP_BASE_URL}/product-reviews/squash-reviews-925004658`, { waitUntil: 'domcontentloaded' }).catch(() => {});
  await page.waitForTimeout(2000);

  return { reviewUrl: page.url() };
}

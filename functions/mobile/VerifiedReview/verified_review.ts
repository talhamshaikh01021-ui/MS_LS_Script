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
  try {
    const searchInput = page.locator(xpaths.searchInput).first();
    if (await searchInput.isVisible().catch(() => false)) {
      await searchInput.fill(TEST_DATA.review_data!.ayur.search_term);
      await page.waitForTimeout(1000);
    }
  } catch (e) {
    console.warn('[Mobile VerifiedReview] Search input note:', e);
  }

  // 2. Navigate to Ayur Shampoo RAR page
  console.log('[Mobile VerifiedReview] Navigating to Ayur Shampoo RAR page...');
  await page.goto(`${MOBILE_BASE_URL}/product-reviews/ayur-shampoo-reviews-925039755`, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(2000);

  // 3. Prompt requirement: "when on ayur shampoos RAR add the /dummytest to the url this will redirect you to verified write a review page"
  const dummyTestUrl = `${MOBILE_BASE_URL}/product-reviews/ayur-shampoo-reviews-925039755/dummytest`;
  console.log(`[Mobile VerifiedReview] Navigating to mobile verified review URL: ${dummyTestUrl}`);
  await page.goto(dummyTestUrl);
  await page.waitForURL(url => url.toString().includes('writereview'), { timeout: 15000 }).catch(() => {});
  await page.waitForTimeout(3000);

  // 4. Dismiss genuine overlay if present
  try {
    await page.evaluate(() => {
      document.querySelectorAll('.surveylayer, .black-layer, .signup-container, .overlay, [class*="genuine"]').forEach(el => {
        (el as HTMLElement).style.display = 'none';
      });
    }).catch(() => {});
  } catch (e) {
    console.log('[Mobile VerifiedReview] No genuine overlay found.');
  }
  await page.waitForTimeout(1000);

  // 5. Star Rating: give 4 stars rating (Activity 4)
  console.log('[Mobile VerifiedReview] Setting 4-star rating on mobile...');
  const star4 = page.locator(xpaths.star4Rating).first();
  if (await star4.isVisible().catch(() => false)) {
    await star4.click({ force: true }).catch(() => {});
  } else {
    await page.evaluate(() => {
      if (typeof (window as any).rate === 'function') (window as any).rate('4');
    }).catch(() => {});
  }
  await page.waitForTimeout(1000);

  // 6. Fill review title and content
  console.log('[Mobile VerifiedReview] Filling review title and content...');
  const titleInput = page.locator(xpaths.reviewTitleInput).first();
  await titleInput.waitFor({ state: 'visible', timeout: 15000 });
  await titleInput.fill(TEST_DATA.review_data!.ayur.title, { force: true });

  const contentInput = page.locator(xpaths.reviewContentTextarea).first();
  await contentInput.fill(TEST_DATA.review_data!.ayur.content, { force: true });

  // 7. Video URL
  const videoInput = page.locator(xpaths.videoEmbedInput).first();
  if (await videoInput.isVisible().catch(() => false)) {
    await videoInput.fill(TEST_DATA.review_data!.video_url, { force: true });
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
  const submitBtn = page.locator('#notloggedin:visible, #Button1:visible, input[value="Submit Review"]:visible, input[id*="btnSubmit"]:visible').first();
  await submitBtn.waitFor({ state: 'visible', timeout: 10000 });
  await submitBtn.click();
  await page.waitForTimeout(5000);

  console.log('[Mobile VerifiedReview] Mobile post-submit URL:', page.url());

  // 10. Redirect to squash's RAR as per requirement
  await page.goto(`${MOBILE_BASE_URL}/product-reviews/squash-reviews-925004658`, { waitUntil: 'domcontentloaded' }).catch(() => {});
  await page.waitForTimeout(2000);

  return { reviewUrl: page.url() };
}

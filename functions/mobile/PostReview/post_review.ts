import { Page } from '@playwright/test';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { MOBILE_BASE_URL, TEST_DATA, ROOT_DIR } from '../../../utils/config.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const xpaths = JSON.parse(fs.readFileSync(path.resolve(__dirname, 'post_review_xpath.json'), 'utf8'));

export async function mobilePostReview(page: Page): Promise<{ reviewUrl: string }> {
  console.log('[Mobile PostReview] Starting review submission for Squash on mobile...');

  // 1. Search squash
  await page.goto(MOBILE_BASE_URL, { waitUntil: 'domcontentloaded' });
  try {
    const searchInput = page.locator(xpaths.searchInput).first();
    if (await searchInput.isVisible().catch(() => false)) {
      await searchInput.fill(TEST_DATA.review_data!.squash.search_term);
      await page.waitForTimeout(1000);
    }
  } catch (e) {
    console.warn('[Mobile PostReview] Search input note:', e);
  }

  // 2. Navigate to Squash RAR page
  console.log('[Mobile PostReview] Navigating to Squash RAR page...');
  await page.goto(`${MOBILE_BASE_URL}/product-reviews/squash-reviews-925004658`, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(2000);

  // 3. Click WRITE A REVIEW button
  console.log('[Mobile PostReview] Clicking WRITE A REVIEW button...');
  const writeBtn = page.locator(xpaths.writeReviewButton).first();
  if (await writeBtn.isVisible().catch(() => false)) {
    await writeBtn.click();
  } else {
    await page.goto(`${MOBILE_BASE_URL}/review/writereview_readall.aspx?cid=925004658`);
  }
  await page.waitForURL(url => url.toString().includes('writereview'), { timeout: 15000 }).catch(() => {});
  await page.waitForTimeout(3000);

  // 4. Genuine overlay check: "tap once on the screen because an image will cover the screen"
  console.log('[Mobile PostReview] Dismissing genuine overlay if present...');
  try {
    await page.evaluate(() => {
      document.querySelectorAll('.surveylayer, .black-layer, .signup-container, .overlay, [class*="genuine"]').forEach(el => {
        (el as HTMLElement).style.display = 'none';
      });
    }).catch(() => {});
  } catch (e) {
    console.log('[Mobile PostReview] No genuine overlay to dismiss.');
  }
  await page.waitForTimeout(1000);

  // 5. Star Rating: give two star rating (2 stars)
  console.log('[Mobile PostReview] Setting 2-star rating on mobile...');
  const star2 = page.locator(xpaths.star2Rating).first();
  if (await star2.isVisible().catch(() => false)) {
    await star2.click({ force: true }).catch(() => {});
  } else {
    await page.evaluate(() => {
      if (typeof (window as any).rate === 'function') (window as any).rate('2');
    }).catch(() => {});
  }
  await page.waitForTimeout(1000);

  // 6. Fill review title and content
  console.log('[Mobile PostReview] Filling review title and content...');
  const titleInput = page.locator(xpaths.reviewTitleInput).first();
  await titleInput.waitFor({ state: 'visible', timeout: 15000 });
  await titleInput.fill(TEST_DATA.review_data!.squash.title, { force: true });

  const contentInput = page.locator(xpaths.reviewContentTextarea).first();
  await contentInput.fill(TEST_DATA.review_data!.squash.content, { force: true });

  // 7. Video URL
  const videoInput = page.locator(xpaths.videoEmbedInput).first();
  if (await videoInput.isVisible().catch(() => false)) {
    await videoInput.fill(TEST_DATA.review_data!.video_url, { force: true });
  }

  // 8. Upload maximum 2 images (same image twice)
  const imageAbsPath = path.resolve(ROOT_DIR, 'test_data', 'review_image', 'images.jpg');
  console.log(`[Mobile PostReview] Uploading image twice from: ${imageAbsPath}`);
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
      console.warn(`[Mobile PostReview] Image upload note: ${e.message}`);
    }
  }

  // 9. Submit review
  console.log('[Mobile PostReview] Submitting review...');
  const submitBtn = page.locator('#notloggedin:visible, #Button1:visible, input[value="Submit Review"]:visible, input[id*="btnSubmit"]:visible').first();
  await submitBtn.waitFor({ state: 'visible', timeout: 10000 });
  await submitBtn.click();
  await page.waitForTimeout(5000);

  // Prompt note: "for mobile you will be redirected to review page itself."
  console.log('[Mobile PostReview] Post-submit URL on mobile:', page.url());
  return { reviewUrl: page.url() };
}

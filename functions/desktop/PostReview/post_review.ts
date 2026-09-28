import { Page, expect } from '@playwright/test';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { DESKTOP_BASE_URL, TEST_DATA, ROOT_DIR } from '../../../utils/config.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const xpaths = JSON.parse(fs.readFileSync(path.resolve(__dirname, 'post_review_xpath.json'), 'utf8'));

export async function desktopPostReview(page: Page): Promise<{ reviewUrl: string }> {
  console.log('[Desktop PostReview] Starting review submission for Squash...');

  // 1. Search for squash from homepage
  await page.goto(DESKTOP_BASE_URL, { waitUntil: 'domcontentloaded' });
  const searchInput = page.locator(xpaths.searchInput).first();
  await searchInput.waitFor({ state: 'visible', timeout: 15000 });
  await searchInput.fill(TEST_DATA.review_data!.squash.search_term);
  await page.waitForTimeout(1500);
  await page.keyboard.press('Enter');
  await page.waitForTimeout(3000);

  // 2. Click on relevant search result / squash product
  console.log('[Desktop PostReview] Clicking on squash product link...');
  const squashLink = page.locator(xpaths.squashProductLink).first();
  await squashLink.waitFor({ state: 'visible', timeout: 15000 });
  await squashLink.click();
  await page.waitForTimeout(3000);

  // 3. Click Write a Review button on RAR page
  console.log('[Desktop PostReview] On RAR page, clicking Write a Review...');
  const writeReviewBtn = page.locator(xpaths.writeReviewButton).first();
  await writeReviewBtn.waitFor({ state: 'visible', timeout: 15000 });
  await writeReviewBtn.click();
  await page.waitForTimeout(3000);

  // 4. Genuine overlay check: "tap once on the screen because an image will cover the screen that tells user that keep your review genuine"
  console.log('[Desktop PostReview] Dismissing genuine overlay if present...');
  try {
    const overlay = page.locator(xpaths.genuineOverlay).first();
    if (await overlay.isVisible().catch(() => false)) {
      await page.mouse.click(200, 200);
    } else {
      // Tap once on body to ensure any initial popup is dismissed
      await page.locator('body').click({ position: { x: 50, y: 50 } }).catch(() => {});
    }
  } catch (e) {
    console.log('[Desktop PostReview] No genuine overlay to dismiss.');
  }
  await page.waitForTimeout(1000);

  // 5. Star Rating: give two star rating (2 stars)
  console.log('[Desktop PostReview] Setting 2-star rating...');
  const star2 = page.locator(xpaths.star2Rating).first();
  if (await star2.isVisible().catch(() => false)) {
    await star2.click();
  } else {
    // Fallback: evaluate rate('2') in browser context
    await page.evaluate(() => {
      if (typeof (window as any).rate === 'function') (window as any).rate('2');
    }).catch(() => {});
  }
  await page.waitForTimeout(1000);

  // 6. Fill review title and content
  console.log('[Desktop PostReview] Filling review title and content...');
  const titleInput = page.locator(xpaths.reviewTitleInput);
  await titleInput.waitFor({ state: 'visible', timeout: 10000 });
  await titleInput.fill(TEST_DATA.review_data!.squash.title);

  const contentInput = page.locator(xpaths.reviewContentTextarea);
  await contentInput.fill(TEST_DATA.review_data!.squash.content);

  // 7. Video URL
  console.log('[Desktop PostReview] Attaching video embed URL...');
  const videoYesRadio = page.locator(xpaths.attachVideoYesRadio).first();
  if (await videoYesRadio.isVisible().catch(() => false)) {
    await videoYesRadio.click();
    await page.waitForTimeout(500);
  }
  const videoInput = page.locator(xpaths.videoEmbedInput);
  if (await videoInput.isVisible().catch(() => false)) {
    await videoInput.fill(TEST_DATA.review_data!.video_url);
  }

  // 8. Upload maximum 2 images (same image twice)
  const imageAbsPath = path.resolve(ROOT_DIR, 'test_data', 'review_image', 'images.jpg');
  console.log(`[Desktop PostReview] Uploading image twice from: ${imageAbsPath}`);
  if (fs.existsSync(imageAbsPath)) {
    try {
      // Iframe 1
      const frame1 = page.frameLocator(xpaths.photoIframe1);
      const fileInput1 = frame1.locator(xpaths.iframeFileInput).first();
      await fileInput1.setInputFiles(imageAbsPath);
      await page.waitForTimeout(2000);

      // Iframe 2
      const frame2 = page.frameLocator(xpaths.photoIframe2);
      const fileInput2 = frame2.locator(xpaths.iframeFileInput).first();
      await fileInput2.setInputFiles(imageAbsPath);
      await page.waitForTimeout(2000);
    } catch (e: any) {
      console.warn(`[Desktop PostReview] Frame file upload notice: ${e.message}`);
      // Fallback direct file inputs if not in iframes
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
  console.log('[Desktop PostReview] Submitting review...');
  const submitBtn = page.locator(xpaths.submitReviewButton).first();
  await submitBtn.waitFor({ state: 'visible', timeout: 10000 });
  await submitBtn.click();
  await page.waitForTimeout(5000);

  // 10. Check submitted redirect
  console.log('[Desktop PostReview] Current URL after submit:', page.url());
  let reviewUrl = page.url();

  // On desktop: redirected to "your review is submitted" page -> click "your review" link to go to RR page
  const revLink = page.locator(xpaths.reviewSubmittedLink).first();
  if (await revLink.isVisible().catch(() => false)) {
    const href = await revLink.getAttribute('href');
    if (href) {
      reviewUrl = href.startsWith('http') ? href : `${DESKTOP_BASE_URL}${href}`;
    }
    console.log('[Desktop PostReview] Clicking through to review page:', reviewUrl);
    await revLink.click().catch(() => {});
    await page.waitForTimeout(3000);
  }

  return { reviewUrl: page.url() };
}

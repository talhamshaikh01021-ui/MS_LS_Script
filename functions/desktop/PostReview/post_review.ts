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
  try {
    const searchInput = page.locator(xpaths.searchInput).first();
    if (await searchInput.isVisible().catch(() => false)) {
      await searchInput.fill(TEST_DATA.review_data!.squash.search_term);
      await page.waitForTimeout(1000);
    }
  } catch (e) {
    console.warn('[Desktop PostReview] Search input notice:', e);
  }

  // 2. Navigate to Squash RAR page
  console.log('[Desktop PostReview] Navigating to squash product RAR page...');
  await page.goto(`${DESKTOP_BASE_URL}/product-reviews/squash-reviews-925004658`, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(2000);

  // 3. Click Write a Review button on RAR page
  console.log('[Desktop PostReview] On RAR page, clicking Write a Review...');
  const writeReviewBtn = page.locator("#ctl00_ctl00_ContentPlaceHolderFooter_ContentPlaceHolderBody_customheader_btnwritereview, #ctl00_ctl00_ContentPlaceHolderFooter_ContentPlaceHolderBody_tabs1_btnWritereview_scroll, #ctl00_ctl00_ContentPlaceHolderFooter_linkWriteReview, a[href*='writereview']").first();
  if (await writeReviewBtn.isVisible().catch(() => false)) {
    await writeReviewBtn.click();
  } else {
    await page.goto(`${DESKTOP_BASE_URL}/review/writereview_readall.aspx?cid=925004658`);
  }
  await page.waitForURL(url => url.toString().includes('writereview'), { timeout: 15000 }).catch(() => {});
  await page.waitForTimeout(3000);

  // 4. Genuine overlay check: "tap once on the screen because an image will cover the screen that tells user that keep your review genuine"
  console.log('[Desktop PostReview] Dismissing genuine overlay if present...');
  try {
    await page.evaluate(() => {
      document.querySelectorAll('.surveylayer, .black-layer, .signup-container, .overlay, [class*="genuine"]').forEach(el => {
        (el as HTMLElement).style.display = 'none';
      });
    }).catch(() => {});
  } catch (e) {
    console.log('[Desktop PostReview] No genuine overlay to dismiss.');
  }
  await page.waitForTimeout(1000);

  // 5. Star Rating: give two star rating (2 stars)
  console.log('[Desktop PostReview] Setting 2-star rating...');
  const star2 = page.locator('#oRate .icon-rating').nth(1);
  if (await star2.isVisible().catch(() => false)) {
    await star2.click().catch(() => {});
  } else {
    await page.evaluate(() => {
      if (typeof (window as any).temp_yg_Ratings_click === 'function' && (window as any).oRate) {
        (window as any).temp_yg_Ratings_click((window as any).oRate, 2);
      }
    }).catch(() => {});
  }
  await page.waitForTimeout(1000);

  // 6. Fill review title and content
  console.log('[Desktop PostReview] Filling review title and content...');
  const titleInput = page.locator('#txtTitle, input[name*="txtTitle"]').first();
  await titleInput.waitFor({ state: 'visible', timeout: 15000 });
  await titleInput.fill(TEST_DATA.review_data!.squash.title);

  const contentInput = page.locator('textarea[id*="myEditor"], textarea[id*="txtReview"]').first();
  await contentInput.fill(TEST_DATA.review_data!.squash.content);

  // 7. Video URL
  console.log('[Desktop PostReview] Attaching video embed URL...');
  const videoYesRadio = page.locator(xpaths.attachVideoYesRadio).first();
  if (await videoYesRadio.isVisible().catch(() => false)) {
    await videoYesRadio.click().catch(() => {});
    await page.waitForTimeout(500);
  }
  const videoInput = page.locator(xpaths.videoEmbedInput).first();
  if (await videoInput.isVisible().catch(() => false)) {
    await videoInput.fill(TEST_DATA.review_data!.video_url);
  }

  // 8. Upload maximum 2 images (same image twice)
  const imageAbsPath = path.resolve(ROOT_DIR, 'test_data', 'review_image', 'images.jpg');
  console.log(`[Desktop PostReview] Uploading image twice from: ${imageAbsPath}`);
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
      console.log('[Desktop PostReview] Uploaded 2 review images successfully.');
    } catch (e: any) {
      console.warn(`[Desktop PostReview] Frame file upload notice: ${e.message}`);
    }
  }

  // 9. Submit review
  console.log('[Desktop PostReview] Submitting review...');
  const submitBtn = page.locator('#Button1:visible, #notloggedin:visible, input[value="Submit Review"]:visible').first();
  await submitBtn.waitFor({ state: 'visible', timeout: 10000 });
  await submitBtn.click();
  await page.waitForTimeout(5000);

  // 10. Check submitted redirect
  console.log('[Desktop PostReview] Current URL after submit:', page.url());
  let reviewUrl = page.url();

  const revLink = page.locator("a[href*='/review/']:not([href*='writereview']), a:has-text('your review')").first();
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

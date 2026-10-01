import { Page } from '@playwright/test';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { MOBILE_BASE_URL, TEST_DATA, ROOT_DIR } from '../../../utils/config.js';
import { fillWarExtraFields } from '../../../utils/war_helper.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const xpaths = JSON.parse(fs.readFileSync(path.resolve(__dirname, 'post_review_xpath.json'), 'utf8'));

export async function mobilePostReview(page: Page): Promise<{ reviewUrl: string }> {
  console.log('[Mobile PostReview] Starting review submission for Squash on mobile...');

  // 1. Search squash / navigate to Squash RAR page
  console.log('[Mobile PostReview] Navigating to Squash RAR page...');
  await page.goto(`${MOBILE_BASE_URL}/product-reviews/squash-reviews-925004658`, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(2000);

  // 2. Click WRITE A REVIEW button
  console.log('[Mobile PostReview] Clicking WRITE A REVIEW button...');
  const writeBtn = page.locator("a.wr-btn:has-text('WRITE A REVIEW'), #dvwritereview.wr-btn, a:has-text('WRITE A REVIEW')").first();
  if (await writeBtn.isVisible().catch(() => false)) {
    await writeBtn.click();
  } else {
    await page.goto(`${MOBILE_BASE_URL}/review/writereview.php?cid=925004658`, { waitUntil: 'domcontentloaded' });
  }
  await page.waitForURL(url => url.toString().includes('writereview'), { timeout: 15000 }).catch(() => {});
  await page.waitForTimeout(2000);

  // 3. Genuine overlay check: "tap once on the screen because an image will cover the screen"
  console.log('[Mobile PostReview] Dismissing genuine overlay if present...');
  await page.evaluate(() => {
    document.querySelectorAll('.surveylayer, .black-layer, .overlay, [class*="genuine"]').forEach(el => {
      if (!el.classList.contains('signup-container') && !el.classList.contains('login') && !el.classList.contains('otp')) {
        (el as HTMLElement).style.display = 'none';
      }
    });
  }).catch(() => {});
  await page.waitForTimeout(1000);

  // 4. Upload photos (uploading first so ASP.NET postback does not clear subsequent form entries)
  const imageAbsPath = path.resolve(ROOT_DIR, 'test_data', 'review_image', 'images.jpg');
  if (fs.existsSync(imageAbsPath)) {
    console.log(`[Mobile PostReview] Uploading images from: ${imageAbsPath}`);
    try {
      const fileInput1 = page.locator('#contentBody_filePhoto, input[type="file"]').first();
      if (await fileInput1.count() > 0) {
        console.log('[Mobile PostReview] Uploading image 1...');
        await fileInput1.setInputFiles(imageAbsPath);
        await page.waitForLoadState('domcontentloaded').catch(() => {});
        await page.waitForTimeout(2500);
      }

      // Re-dismiss overlay if reappeared after postback
      await page.evaluate(() => {
        document.querySelectorAll('.surveylayer, .black-layer, .overlay, [class*="genuine"]').forEach(el => {
          if (!el.classList.contains('signup-container') && !el.classList.contains('login') && !el.classList.contains('otp')) {
            (el as HTMLElement).style.display = 'none';
          }
        });
      }).catch(() => {});

      const fileInput2 = page.locator('#contentBody_filePhoto2').first();
      if (await fileInput2.count() > 0) {
        console.log('[Mobile PostReview] Uploading image 2...');
        await fileInput2.setInputFiles(imageAbsPath);
        await page.waitForLoadState('domcontentloaded').catch(() => {});
        await page.waitForTimeout(2500);
      }
    } catch (e: any) {
      console.warn(`[Mobile PostReview] Image upload note: ${e.message}`);
    }
  }

  // Ensure overlay is dismissed
  await page.evaluate(() => {
    document.querySelectorAll('.surveylayer, .black-layer, .overlay, [class*="genuine"]').forEach(el => {
      if (!el.classList.contains('signup-container') && !el.classList.contains('login') && !el.classList.contains('otp')) {
        (el as HTMLElement).style.display = 'none';
      }
    });
  }).catch(() => {});

  // 5. Star Rating: give two star rating (2 stars)
  console.log('[Mobile PostReview] Setting 2-star rating on mobile...');
  const star2Locator = page.locator('#contentBody_dvrating .icon-star-rating, .prod-tap-star .icon-star-rating, span.icon-star-rating').nth(1);
  await star2Locator.waitFor({ state: 'visible', timeout: 15000 }).catch(() => {});
  await star2Locator.scrollIntoViewIfNeeded().catch(() => {});
  if (await star2Locator.isVisible().catch(() => false)) {
    await star2Locator.click({ force: true }).catch(() => {});
  }
  await page.evaluate(() => {
    const stars = document.querySelectorAll('#contentBody_dvrating .icon-star-rating, .prod-tap-star .icon-star-rating, span.icon-star-rating');
    if (stars[1]) {
      if (typeof (window as any).setProductRating === 'function') {
        (window as any).setProductRating(stars[1]);
      }
      if (typeof (window as any).rate === 'function') {
        (window as any).rate('2');
      }
    }
    const hid = (document.getElementById('contentBody_hidProductRating') || document.getElementById('hidProductRating')) as HTMLInputElement;
    if (hid) hid.value = '2';
    const rec = (document.getElementById('contentBody_hdnRecommendation1') || document.getElementById('hdnRecommendation1')) as HTMLInputElement;
    if (rec) rec.value = '0';
  }).catch(() => {});
  await page.waitForTimeout(1000);

  // 6. Fill review title and content
  console.log('[Mobile PostReview] Filling review title and content...');
  const titleInput = page.locator(xpaths.reviewTitleInput).first();
  await titleInput.waitFor({ state: 'visible', timeout: 15000 });
  await titleInput.fill(TEST_DATA.review_data!.squash.title, { force: true });

  const contentInput = page.locator(xpaths.reviewContentTextarea).first();
  await contentInput.fill(TEST_DATA.review_data!.squash.content, { force: true });

  // 7. Video URL: select video radio "Yes" first, then fill embedded video URL
  console.log('[Mobile PostReview] Enabling video embed and filling URL...');
  const vidYesRadio = page.locator('#vidYes, .videoYes, input[value="yes"]').first();
  if (await vidYesRadio.isVisible().catch(() => false) || await vidYesRadio.count() > 0) {
    await vidYesRadio.click({ force: true }).catch(() => {});
    await page.waitForTimeout(500);
  }

  const videoInput = page.locator('#txtEmbed, input[placeholder*="embedded video"]').first();
  if (await videoInput.isVisible().catch(() => false) || await videoInput.count() > 0) {
    await videoInput.fill(TEST_DATA.review_data!.video_url, { force: true });
  }

  // 8. Dynamic dropdowns and extra input fields
  await fillWarExtraFields(page);

  // 8g. Ensure 2-star rating is strictly selected before submitting
  const isRatingSelected = await page.evaluate(() => {
    const stars = document.querySelectorAll('#contentBody_dvrating .icon-star-rating, .prod-tap-star .icon-star-rating, span.icon-star-rating');
    const star2Filled = stars[1]?.classList.contains('filled-star');
    const hidVal = ((document.getElementById('contentBody_hidProductRating') || document.getElementById('hidProductRating')) as HTMLInputElement)?.value;
    return star2Filled && hidVal === '2';
  }).catch(() => false);

  if (!isRatingSelected) {
    console.log('[Mobile PostReview] 2-star rating was not set. Forcing 2-star rating selection now before submit...');
    const star2 = page.locator('#contentBody_dvrating .icon-star-rating, .prod-tap-star .icon-star-rating, span.icon-star-rating').nth(1);
    await star2.scrollIntoViewIfNeeded().catch(() => {});
    await star2.click({ force: true }).catch(() => {});
    await page.evaluate(() => {
      const stars = document.querySelectorAll('#contentBody_dvrating .icon-star-rating, .prod-tap-star .icon-star-rating, span.icon-star-rating');
      if (stars[1]) {
        if (typeof (window as any).setProductRating === 'function') {
          (window as any).setProductRating(stars[1]);
        }
        if (typeof (window as any).rate === 'function') {
          (window as any).rate('2');
        }
      }
      const hid = (document.getElementById('contentBody_hidProductRating') || document.getElementById('hidProductRating')) as HTMLInputElement;
      if (hid) hid.value = '2';
      const rec = (document.getElementById('contentBody_hdnRecommendation1') || document.getElementById('hdnRecommendation1')) as HTMLInputElement;
      if (rec) rec.value = '0';
    }).catch(() => {});
    await page.waitForTimeout(500);
  }

  // 9. Submit review
  console.log('[Mobile PostReview] Submitting review...');
  const submitBtn = page.locator('#btnSubmit_nologin:visible, #Button1:visible, input[id*="btnSubmit"]:visible, .wr-submit-btn:visible').first();
  await submitBtn.waitFor({ state: 'visible', timeout: 10000 });
  await submitBtn.click();
  await page.waitForTimeout(4000);

  // If redirected to login due to autosaved review draft, complete login
  if (page.url().includes('login_now.php')) {
    console.log('[Mobile PostReview] Login prompt detected for autosaved review. Logging in...');
    const loginIdInp = page.locator('#txtLoginId, input[name*="txtLoginId"]').first();
    if (await loginIdInp.isVisible().catch(() => false)) {
      await loginIdInp.fill(TEST_DATA.mobile_test_data.MSID);
      await page.locator('#txtPasswrd, input[name*="txtPasswrd"]').first().fill(TEST_DATA.mobile_test_data.password);
      await page.locator('.sign-in-button, a[onclick*="clicksignin"]').first().click();
      await page.waitForLoadState('domcontentloaded').catch(() => {});
      await page.waitForTimeout(4000);
    }
  }

  // Check for "your review" link if redirected to thank you page
  const revLink = page.locator("a:has-text('your review'), a:has-text('Your Review'), a[href*='/review/']").first();
  if (await revLink.isVisible().catch(() => false)) {
    const href = await revLink.getAttribute('href');
    if (href && href.includes('/review/') && !href.endsWith('-review-')) {
      const fullUrl = href.startsWith('http') ? href : `${MOBILE_BASE_URL}${href}`;
      console.log('[Mobile PostReview] Navigating to created review URL:', fullUrl);
      await page.goto(fullUrl, { waitUntil: 'domcontentloaded' }).catch(() => {});
      await page.waitForTimeout(2000);
    }
  }

  // Prompt note: "for mobile you will be redirected to review page itself."
  console.log('[Mobile PostReview] Post-submit URL on mobile:', page.url());
  return { reviewUrl: page.url() };
}

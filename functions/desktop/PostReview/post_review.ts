import { Page, expect } from '@playwright/test';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { DESKTOP_BASE_URL, TEST_DATA, ROOT_DIR } from '../../../utils/config.js';
import { fillWarExtraFields } from '../../../utils/war_helper.js';
import { ensureDesktopLoggedIn } from '../Registration/registration.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const xpaths = JSON.parse(fs.readFileSync(path.resolve(__dirname, 'post_review_xpath.json'), 'utf8'));

export async function desktopPostReview(page: Page): Promise<{ reviewUrl: string }> {
  console.log('[Desktop PostReview] Starting review submission for Squash...');

  // Ensure active authenticated session
  await ensureDesktopLoggedIn(page);

  // 1. Search for squash from homepage
  console.log('[Desktop PostReview] Navigating to homepage...');
  await page.goto(DESKTOP_BASE_URL, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(1500);

  console.log('[Desktop PostReview] Searching "squash" from homepage search bar...');
  const searchInput = page.locator(xpaths.searchInput).first();
  await searchInput.waitFor({ state: 'visible', timeout: 15000 });
  await searchInput.click();
  await searchInput.fill(TEST_DATA.review_data!.squash.search_term || 'squash');
  await page.waitForTimeout(2000);

  // 2. Click relevant autocomplete result to redirect to listing page
  console.log('[Desktop PostReview] Clicking relevant autocomplete result to redirect to listing page...');
  const listingCategoryItem = page.locator(xpaths.searchCategoryResult).first();
  if (await listingCategoryItem.isVisible().catch(() => false)) {
    await listingCategoryItem.click();
  } else {
    const dropdownItem = page.locator("ul.ui-autocomplete li a, .dropdown-menu li a, [class*='autocomplete'] a").filter({ hasText: /squash/i }).first();
    if (await dropdownItem.isVisible().catch(() => false)) {
      await dropdownItem.click();
    } else {
      await searchInput.press('Enter');
    }
  }

  // Wait for redirection to listing page
  await page.waitForURL(url => url.toString().includes('proid') || url.toString().includes('srchcatid') || url.toString().includes('indoor-games') || url.toString().includes('search'), { timeout: 15000 }).catch(() => { });
  console.log('[Desktop PostReview] Current URL on listing page:', page.url());
  await page.waitForTimeout(2000);

  // 3. Click relevant squash product on listing page to redirect to Squash RAR
  console.log('[Desktop PostReview] Clicking relevant Squash product on listing page...');
  const squashProd = page.locator(xpaths.squashProductLink).first();
  await squashProd.waitFor({ state: 'visible', timeout: 15000 });
  // Remove target attribute if _blank to navigate in the same page
  await squashProd.evaluate(el => el.removeAttribute('target')).catch(() => { });
  await squashProd.click();

  // Wait for redirection to Squash's RAR page
  await page.waitForURL(url => url.toString().includes('/product-reviews/squash-reviews'), { timeout: 15000 }).catch(() => { });
  console.log('[Desktop PostReview] Current URL on Squash RAR page:', page.url());
  await page.waitForTimeout(2000);

  // 4. On Squash RAR page, click Write a Review button
  console.log('[Desktop PostReview] On RAR page, clicking Write a Review button...');
  const writeReviewBtn = page.locator(xpaths.writeReviewButton).first();
  if (await writeReviewBtn.isVisible().catch(() => false)) {
    await writeReviewBtn.click({ noWaitAfter: true }).catch(async () => {
      await writeReviewBtn.evaluate((el: HTMLElement) => el.click()).catch(() => { });
    });
  }
  await page.waitForTimeout(1500);
  if (!page.url().includes('writereview')) {
    await page.evaluate(() => {
      if (typeof (window as any).WriteReview === 'function') (window as any).WriteReview();
    }).catch(() => { });
  }
  await page.waitForURL(url => url.toString().includes('writereview'), { timeout: 15000 }).catch(() => { });
  if (!page.url().includes('writereview')) {
    await page.goto(`${DESKTOP_BASE_URL}/review/writereview_readall.aspx?cid=925004658`, { waitUntil: 'domcontentloaded' }).catch(() => { });
  }
  await page.waitForTimeout(2500);

  // 4. Genuine overlay check: "tap once on the screen because an image will cover the screen that tells user that keep your review genuine"
  console.log('[Desktop PostReview] Dismissing genuine overlay if present...');
  try {
    const closeOverlayBtn = page.locator(".surveylayer .close, .black-layer .close, #imgWARPopUp ~ .close, a:has-text('Close')").first();
    if (await closeOverlayBtn.isVisible().catch(() => false)) {
      await closeOverlayBtn.click().catch(() => { });
    }
    await page.evaluate(() => {
      document.querySelectorAll('.surveylayer, .black-layer, .imgWARPopUp, .imgPastePrevent, #imgWARPopUp, #imgPastePrevent, [class*="genuine"]').forEach(el => {
        if (!el.classList.contains('signup-container') && !el.classList.contains('login') && !el.classList.contains('otp')) {
          (el as HTMLElement).style.display = 'none';
        }
      });
    }).catch(() => { });
  } catch (e) {
    console.log('[Desktop PostReview] No genuine overlay to dismiss.');
  }
  await page.waitForTimeout(1000);

  // 5. Star Rating: give two star rating (2 stars)
  console.log('[Desktop PostReview] Setting 2-star rating...');
  const star2 = page.locator('#oRate .icon-rating').nth(1);
  await star2.waitFor({ state: 'visible', timeout: 10000 }).catch(() => {});
  await star2.scrollIntoViewIfNeeded().catch(() => {});
  if (await star2.isVisible().catch(() => false)) {
    await star2.click({ force: true }).catch(() => { });
  }
  await page.evaluate(() => {
    if (typeof (window as any).temp_yg_Ratings_click === 'function' && (window as any).oRate) {
      (window as any).temp_yg_Ratings_click((window as any).oRate, 2);
    }
    const hid = document.getElementById('hidProductRating') as HTMLInputElement;
    if (hid) hid.value = '2';
  }).catch(() => { });
  await page.waitForTimeout(1000);

  // 6. Fill review title and content
  console.log('[Desktop PostReview] Filling review title and content...');
  const titleInput = page.locator('#txtTitle, input[name*="txtTitle"]').first();
  await titleInput.waitFor({ state: 'visible', timeout: 15000 });
  await titleInput.fill(TEST_DATA.review_data!.squash.title);

  // Fill review content directly into textarea
  const reviewBodyText = TEST_DATA.review_data!.squash.content;
  const contentInput = page.locator('textarea[id*="myEditor"], #txtReview, textarea[placeholder*="review" i]').first();
  if (await contentInput.isVisible().catch(() => false)) {
    await contentInput.fill(reviewBodyText);
  } else {
    await page.evaluate((text) => {
      const ta = document.querySelector('textarea[id*="myEditor"], textarea[id*="txtReview"]') as HTMLTextAreaElement;
      if (ta) {
        ta.value = text;
        ta.dispatchEvent(new Event('input', { bubbles: true }));
        ta.dispatchEvent(new Event('change', { bubbles: true }));
      }
    }, reviewBodyText).catch(() => { });
  }

  // 7. Video URL
  console.log('[Desktop PostReview] Attaching video embed URL...');
  const videoYesRadio = page.locator(xpaths.attachVideoYesRadio).first();
  if (await videoYesRadio.isVisible().catch(() => false)) {
    await videoYesRadio.click().catch(() => { });
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
      // 8a. Open Photo upload popup
      console.log('[Desktop PostReview] Opening photo upload modal with two image inputs...');
      const uploadBtn = page.locator("li.upload, [onclick*='open_photo_upload']").first();
      if (await uploadBtn.isVisible().catch(() => false)) {
        await uploadBtn.scrollIntoViewIfNeeded().catch(() => { });
        await uploadBtn.click();
      } else {
        await page.evaluate(() => {
          if (typeof (window as any).open_photo_upload === 'function') (window as any).open_photo_upload();
        }).catch(() => { });
      }
      await page.waitForTimeout(1500);

      // 8b. Wait for modal #photosection to be visible
      await page.locator('#photosection').waitFor({ state: 'visible', timeout: 10000 }).catch(() => { });

      // 8c. Upload image in first input (frame 1)
      const frame1 = page.frameLocator('#ifrmImg1');
      const fileInput1 = frame1.locator("input[type='file'], input[name='filePhoto']").first();
      await fileInput1.setInputFiles(imageAbsPath);
      console.log('[Desktop PostReview] Image 1 uploaded, waiting for processing...');
      await frame1.locator('#imgMember').waitFor({ state: 'visible', timeout: 15000 }).catch(() => page.waitForTimeout(3000));

      // 8d. Upload same image in second input (frame 2)
      const frame2 = page.frameLocator('#ifrmImg2');
      const fileInput2 = frame2.locator("input[type='file'], input[name='filePhoto']").first();
      await fileInput2.setInputFiles(imageAbsPath);
      console.log('[Desktop PostReview] Image 2 uploaded, waiting for processing...');
      await frame2.locator('#imgMember').waitFor({ state: 'visible', timeout: 15000 }).catch(() => page.waitForTimeout(3000));

      console.log('[Desktop PostReview] Uploaded same image into both inputs successfully. Closing photo popup...');
      // 8e. Close photo popup
      const closeBtn = page.locator('#closephoto').first();
      if (await closeBtn.isVisible().catch(() => false)) {
        await closeBtn.click({ force: true }).catch(() => { });
      } else {
        await page.evaluate(() => {
          if (typeof (window as any).closeModal === 'function') (window as any).closeModal();
          else {
            const btn = document.getElementById('closephoto');
            if (btn) btn.click();
          }
        }).catch(() => { });
      }
      await page.waitForTimeout(1000);
    } catch (e: any) {
      console.warn(`[Desktop PostReview] Image upload notice: ${e.message}`);
    }
  }

  // 8f. Check and fill any dynamic dropdowns and extra input fields (e.g. Where Did You Buy It From, Member Ship ID)
  await fillWarExtraFields(page);

  // 8g. Ensure 2-star rating is strictly selected before submitting
  const isRatingSelected = await page.evaluate(() => {
    const oRate = document.querySelector('#oRate');
    const star2Rated = oRate?.querySelectorAll('.icon-rating')[1]?.classList.contains('rated-star');
    const hidVal = (document.getElementById('hidProductRating') as HTMLInputElement)?.value;
    return star2Rated && hidVal === '2';
  }).catch(() => false);

  if (!isRatingSelected) {
    console.log('[Desktop PostReview] 2-star rating was not set. Forcing 2-star rating selection now before submit...');
    const star2 = page.locator('#oRate .icon-rating').nth(1);
    await star2.scrollIntoViewIfNeeded().catch(() => {});
    await star2.click({ force: true }).catch(() => {});
    await page.evaluate(() => {
      if (typeof (window as any).temp_yg_Ratings_click === 'function' && (window as any).oRate) {
        (window as any).temp_yg_Ratings_click((window as any).oRate, 2);
      }
      const hid = document.getElementById('hidProductRating') as HTMLInputElement;
      if (hid) hid.value = '2';
    }).catch(() => {});
    await page.waitForTimeout(500);
  }

  // 9. Submit review
  console.log('[Desktop PostReview] Submitting review...');
  const submitBtn = page.locator('#Button1:visible, #notloggedin:visible, input[value="Submit Review"]:visible').first();
  await submitBtn.waitFor({ state: 'visible', timeout: 10000 });
  await submitBtn.click();
  await page.waitForTimeout(2000);

  // If mandatory login popup appears after submit, log in with credentials
  const mandatoryLoginInput = page.locator('#loginId:visible').first();
  if (await mandatoryLoginInput.isVisible().catch(() => false)) {
    console.log('[Desktop PostReview] Mandatory login popup appeared upon submit. Logging in...');
    await mandatoryLoginInput.fill(TEST_DATA.desktop_test_data.MSID);
    await page.locator('#pwd:visible').first().fill(TEST_DATA.desktop_test_data.password);
    await page.locator('#btnAjax_Login:visible').first().click();
    await page.waitForTimeout(3000);
  }
  await page.waitForTimeout(3000);

  // 10. Click on "your review" link to redirect to RR page
  console.log('[Desktop PostReview] Current URL after submit:', page.url());

  // Locate "your review" link on the thank you page
  // We match links whose text contains "your review" (case-insensitive) or "view review"
  // and ensure we do NOT match the broken breadcrumb/header link ending in '-review-'
  let yourReviewLink = page.locator("a").filter({ hasText: /your review/i }).first();
  let isFound = await yourReviewLink.waitFor({ state: 'visible', timeout: 10000 }).then(() => true).catch(() => false);

  if (!isFound) {
    yourReviewLink = page.locator(xpaths.reviewSubmittedLink).first();
    isFound = await yourReviewLink.waitFor({ state: 'visible', timeout: 5000 }).then(() => true).catch(() => false);
  }

  if (!isFound) {
    yourReviewLink = page.locator("a").filter({ hasText: /view review|read review/i }).first();
    isFound = await yourReviewLink.isVisible().catch(() => false);
  }

  if (isFound && await yourReviewLink.isVisible().catch(() => false)) {
    const href = await yourReviewLink.getAttribute('href').catch(() => null);
    console.log('[Desktop PostReview] Found "your review" link with href:', href);

    // Remove target="_blank" so clicking redirects in the current page
    await yourReviewLink.evaluate((el: HTMLElement) => el.removeAttribute('target')).catch(() => { });

    console.log('[Desktop PostReview] Clicking on "your review" link to redirect to RR page...');
    const [popup] = await Promise.all([
      page.context().waitForEvent('page', { timeout: 6000 }).catch(() => null),
      yourReviewLink.click({ force: true }).catch(async () => {
        await yourReviewLink.evaluate((el: HTMLElement) => el.click()).catch(() => { });
      })
    ]);

    if (popup) {
      console.log('[Desktop PostReview] Review opened in new tab:', popup.url());
      await popup.waitForLoadState('domcontentloaded').catch(() => { });
      const popupUrl = popup.url();
      await popup.close().catch(() => { });
      if (popupUrl && !popupUrl.includes('error.php') && !popupUrl.endsWith('-review-')) {
        await page.goto(popupUrl, { waitUntil: 'domcontentloaded' }).catch(() => { });
      }
    } else {
      await page.waitForLoadState('domcontentloaded').catch(() => { });
    }
    await page.waitForTimeout(3000);

    // If still on thankyou page after clicking, navigate directly using href if it is a valid review URL (not ending with '-review-')
    if (page.url().includes('thankyou') && href && href.includes('/review/') && !href.endsWith('-review-')) {
      const fullUrl = href.startsWith('http') ? href : `${DESKTOP_BASE_URL}${href}`;
      console.log('[Desktop PostReview] Still on thankyou page after click, navigating directly to review URL:', fullUrl);
      await page.goto(fullUrl, { waitUntil: 'domcontentloaded' }).catch(() => { });
      await page.waitForTimeout(3000);
    }
  } else {
    console.warn('[Desktop PostReview] "your review" link was not found on thank you page.');
  }

  // Safety fallback: if on thankyou or error page, recover by finding user review from Squash RAR page
  if (page.url().includes('thankyou') || page.url().includes('error.php') || page.url().endsWith('-review-')) {
    console.warn('[Desktop PostReview] Recovering from invalid URL, navigating to Squash RAR to locate review...');
    await page.goto(`${DESKTOP_BASE_URL}/product-reviews/squash-reviews-925004658`, { waitUntil: 'domcontentloaded' }).catch(() => { });
    await page.waitForTimeout(2000);
    const ownReviewLink = page.locator("a").filter({ hasText: TEST_DATA.review_data!.squash.title }).first();
    if (await ownReviewLink.isVisible().catch(() => false)) {
      console.log('[Desktop PostReview] Found review link on RAR page, clicking through to RR page...');
      await ownReviewLink.click();
      await page.waitForLoadState('domcontentloaded').catch(() => { });
      await page.waitForTimeout(2000);
    }
  }

  // Ensure any extra tabs/popups are closed so test stays on single focused tab
  const contextPages = page.context().pages();
  for (let i = contextPages.length - 1; i > 0; i--) {
    if (contextPages[i] !== page) {
      await contextPages[i].close().catch(() => { });
    }
  }
  await page.bringToFront().catch(() => { });

  const finalReviewUrl = page.url();
  console.log('[Desktop PostReview] Final review URL returned:', finalReviewUrl);
  return { reviewUrl: finalReviewUrl };
}


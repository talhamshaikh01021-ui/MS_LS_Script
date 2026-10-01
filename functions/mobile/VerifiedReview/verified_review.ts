import { Page } from '@playwright/test';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { MOBILE_BASE_URL, TEST_DATA, ROOT_DIR } from '../../../utils/config.js';
import { fillWarExtraFields } from '../../../utils/war_helper.js';
import { fetchRegistrationOtp } from '../../../utils/email_helper.js';
import { mobileReviewActions } from '../ReviewActions/review_actions.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const xpaths = JSON.parse(fs.readFileSync(path.resolve(__dirname, 'verified_review_xpath.json'), 'utf8'));

export async function mobileVerifiedReview(page: Page): Promise<{ reviewUrl: string }> {
  console.log('[Mobile VerifiedReview] Starting Ayur Shampoo verified review flow on mobile...');

  // 1. Navigate to Ayur Shampoo RAR page
  console.log('[Mobile VerifiedReview] Navigating to Ayur Shampoo RAR page...');
  await page.goto(`${MOBILE_BASE_URL}/product-reviews/ayur-shampoo-reviews-925039755`, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(2000);

  // 2. User requirement: "when on ayur shampoos RAR add the /dummytest to the url this will redirect you to verified write a review page"
  const dummyTestUrl = `${MOBILE_BASE_URL}/product-reviews/ayur-shampoo-reviews-925039755/dummytest`;
  console.log(`[Mobile VerifiedReview] Navigating to mobile verified review URL: ${dummyTestUrl}`);
  await page.goto(dummyTestUrl);
  await page.waitForURL(url => url.toString().includes('writereview'), { timeout: 15000 }).catch(() => { });
  await page.waitForTimeout(3000);

  // 3. Dismiss genuine overlay if present
  await page.evaluate(() => {
    document.querySelectorAll('.surveylayer, .black-layer, .imgWARPopUp, .imgPastePrevent, #imgWARPopUp, #imgPastePrevent, [class*="genuine"]').forEach(el => {
      if (!el.classList.contains('signup-container') && !el.classList.contains('login') && !el.classList.contains('otp')) {
        (el as HTMLElement).style.display = 'none';
      }
    });
  }).catch(() => { });
  await page.waitForTimeout(1000);

  // 4. Upload images first so postback navigation doesn't reset form fields
  const imageAbsPath = path.resolve(ROOT_DIR, 'test_data', 'review_image', 'images.jpg');
  if (fs.existsSync(imageAbsPath)) {
    try {
      const fileInput1 = page.locator('#contentBody_filePhoto, input[type="file"]').first();
      if (await fileInput1.count() > 0) {
        console.log('[Mobile VerifiedReview] Uploading image 1...');
        await fileInput1.setInputFiles(imageAbsPath);
        await page.waitForLoadState('domcontentloaded').catch(() => { });
        await page.waitForTimeout(2500);
      }

      await page.evaluate(() => {
        document.querySelectorAll('.surveylayer, .black-layer, .overlay, [class*="genuine"]').forEach(el => {
          if (!el.classList.contains('signup-container') && !el.classList.contains('login') && !el.classList.contains('otp')) {
            (el as HTMLElement).style.display = 'none';
          }
        });
      }).catch(() => { });

      const fileInput2 = page.locator('#contentBody_filePhoto2').first();
      if (await fileInput2.count() > 0) {
        console.log('[Mobile VerifiedReview] Uploading image 2...');
        await fileInput2.setInputFiles(imageAbsPath);
        await page.waitForLoadState('domcontentloaded').catch(() => { });
        await page.waitForTimeout(2500);
      }
    } catch (e: any) {
      console.warn(`[Mobile VerifiedReview] Image upload note: ${e.message}`);
    }
  }

  // Ensure overlay is dismissed
  await page.evaluate(() => {
    document.querySelectorAll('.surveylayer, .black-layer, .overlay, [class*="genuine"]').forEach(el => {
      if (!el.classList.contains('signup-container') && !el.classList.contains('login') && !el.classList.contains('otp')) {
        (el as HTMLElement).style.display = 'none';
      }
    });
  }).catch(() => { });

  // 5. Star Rating: give 4 stars rating (Activity 4 requirement: "for this product give 4 stars")
  console.log('[Mobile VerifiedReview] Setting 4-star rating on mobile...');
  const star4Locator = page.locator('#contentBody_dvrating .icon-star-rating, .prod-tap-star .icon-star-rating').nth(3);
  await star4Locator.waitFor({ state: 'visible', timeout: 15000 }).catch(() => { });
  await star4Locator.scrollIntoViewIfNeeded().catch(() => { });
  await star4Locator.click({ force: true }).catch(() => { });

  await page.evaluate(() => {
    const stars = document.querySelectorAll('#contentBody_dvrating .icon-star-rating, .prod-tap-star .icon-star-rating');
    if (stars[3]) {
      if (typeof (window as any).setProductRating === 'function') {
        (window as any).setProductRating(stars[3]);
      }
      if (typeof (window as any).rate === 'function') {
        (window as any).rate('4');
      }
    }
    stars.forEach((s, idx) => {
      if (idx < 4) {
        s.classList.remove('unfilled-star');
        s.classList.add('filled-star');
      } else {
        s.classList.remove('filled-star');
        s.classList.add('unfilled-star');
      }
    });
    const hid = document.getElementById('contentBody_hidProductRating') as HTMLInputElement;
    if (hid) hid.value = '4';
    const rec = document.getElementById('contentBody_hdnRecommendation1') as HTMLInputElement;
    if (rec) rec.value = '1';
  }).catch(() => { });
  await page.waitForTimeout(1000);

  // 6. Fill review title and content
  console.log('[Mobile VerifiedReview] Filling review title and content...');
  const titleInput = page.locator(xpaths.reviewTitleInput).first();
  await titleInput.waitFor({ state: 'visible', timeout: 15000 });
  await titleInput.fill(TEST_DATA.review_data!.ayur.title, { force: true });

  const contentInput = page.locator(xpaths.reviewContentTextarea).first();
  await contentInput.fill(TEST_DATA.review_data!.ayur.content, { force: true });

  // 7. Video URL: select video radio "Yes" first, then fill embedded video URL
  console.log('[Mobile VerifiedReview] Enabling video embed and filling URL...');
  const vidYesRadio = page.locator('#vidYes, .videoYes, input[value="yes"]').first();
  if (await vidYesRadio.isVisible().catch(() => false) || await vidYesRadio.count() > 0) {
    await vidYesRadio.click({ force: true }).catch(() => { });
    await page.waitForTimeout(500);
  }

  const videoInput = page.locator('#txtEmbed, input[placeholder*="embedded video"]').first();
  if (await videoInput.isVisible().catch(() => false) || await videoInput.count() > 0) {
    await videoInput.fill(TEST_DATA.review_data!.video_url, { force: true });
  }

  // 8. Dynamic dropdowns and extra input fields (e.g. Order ID, Contact, Where Did You Buy It From)
  await fillWarExtraFields(page);

  // Auto-accept any browser alert dialogs (such as "An OTP has been sent to your email and mobile number.")
  page.on('dialog', async dialog => {
    console.log(`[Mobile VerifiedReview] Dialog detected: "${dialog.message()}" -> accepting`);
    await dialog.accept().catch(() => { });
  });

  // 8g. Ensure 4-star rating is strictly selected before submitting
  const isRatingSelected = await page.evaluate(() => {
    const stars = document.querySelectorAll('#contentBody_dvrating .icon-star-rating, .prod-tap-star .icon-star-rating');
    const star4Filled = stars[3]?.classList.contains('filled-star');
    const hidVal = (document.getElementById('contentBody_hidProductRating') as HTMLInputElement)?.value;
    return star4Filled && hidVal === '4';
  }).catch(() => false);

  if (!isRatingSelected) {
    console.log('[Mobile VerifiedReview] 4-star rating was not set. Forcing 4-star rating selection now before submit...');
    const star4 = page.locator('#contentBody_dvrating .icon-star-rating, .prod-tap-star .icon-star-rating').nth(3);
    await star4.scrollIntoViewIfNeeded().catch(() => { });
    await star4.click({ force: true }).catch(() => { });
    await page.evaluate(() => {
      const stars = document.querySelectorAll('#contentBody_dvrating .icon-star-rating, .prod-tap-star .icon-star-rating');
      if (stars[3]) {
        if (typeof (window as any).setProductRating === 'function') {
          (window as any).setProductRating(stars[3]);
        }
        if (typeof (window as any).rate === 'function') {
          (window as any).rate('4');
        }
      }
      stars.forEach((s, idx) => {
        if (idx < 4) {
          s.classList.remove('unfilled-star');
          s.classList.add('filled-star');
        } else {
          s.classList.remove('filled-star');
          s.classList.add('unfilled-star');
        }
      });
      const hid = document.getElementById('contentBody_hidProductRating') as HTMLInputElement;
      if (hid) hid.value = '4';
      const rec = document.getElementById('contentBody_hdnRecommendation1') as HTMLInputElement;
      if (rec) rec.value = '1';
    }).catch(() => { });
    await page.waitForTimeout(500);
  }

  // 9. Submit review
  console.log('[Mobile VerifiedReview] Submitting 4-star verified review on mobile...');
  const submitBtn = page.locator('#btnSubmit_nologin:visible, #Button1:visible, input[id*="btnSubmit"]:visible, .wr-submit-btn:visible').first();
  await submitBtn.waitFor({ state: 'visible', timeout: 10000 });
  await submitBtn.click();
  await page.waitForTimeout(2000);

  // 10. Handle Phone Number prompt popup ("6591069152" for mobile)
  const mobilePhone = TEST_DATA.mobile_test_data.phone_number || TEST_DATA.review_data?.ayur.phone_mobile || '6591069152';
  console.log(`[Mobile VerifiedReview] Checking for OTP Verification number popup (target: ${mobilePhone})...`);

  // Ensure popup is visible
  const popupContainer = page.locator(".login:visible, #dvnumber:visible, div:has-text('OTP Verification'):visible, .phone-field:visible").first();
  let isPopupVisible = await popupContainer.waitFor({ state: 'visible', timeout: 6000 }).then(() => true).catch(() => false);

  if (!isPopupVisible) {
    console.log('[Mobile VerifiedReview] Triggering OTP verification popup display explicitly if not already shown...');
    await page.evaluate(() => {
      if ((window as any).$ && (window as any).$('.otp,.login').length) {
        (window as any).$('.otp,.login').show();
        const mb = document.getElementById('modal-bck');
        if (mb) mb.style.display = 'block';
        const dn = document.getElementById('dvnumber');
        if (dn) dn.style.display = 'block';
      }
    }).catch(() => { });
    await page.waitForTimeout(1000);
  }

  const phoneInput = page.locator("#txtphone:visible, input[placeholder*='Mobile Number']:visible, .phone-field:visible, #mobileNumber:visible, input[type='tel']:visible").first();
  const isPhoneVisible = await phoneInput.waitFor({ state: 'visible', timeout: 10000 }).then(() => true).catch(() => false);

  if (isPhoneVisible) {
    console.log(`[Mobile VerifiedReview] Entering phone number "${mobilePhone}" in OTP verification popup...`);
    await phoneInput.fill(mobilePhone);
    await phoneInput.dispatchEvent('input').catch(() => { });
    await phoneInput.dispatchEvent('change').catch(() => { });
    await phoneInput.dispatchEvent('keyup').catch(() => { });
    await page.waitForTimeout(500);

    const otpRequestTime = new Date();
    console.log('[Mobile VerifiedReview] Clicking "Verify" button to submit phone number & request OTP...');
    const sendCodeBtn = page.locator("#mobileVerification:visible, a.verify-btn:visible, button.vernum:visible, button.verify-btn:visible, a:has-text('Verify'):visible").first();
    if (await sendCodeBtn.isVisible().catch(() => false)) {
      await sendCodeBtn.click().catch(() => { });
    } else {
      await page.evaluate(() => {
        const btn = document.getElementById('mobileVerification') as HTMLElement;
        if (btn) btn.click();
        else if (typeof (window as any).savekey === 'function') {
          (window as any).savekey('txtphone', 'txtctrycode');
        }
      }).catch(() => { });
    }
    await page.waitForTimeout(3000);

    // 11. Fetch OTP from registered mail
    console.log(`[Mobile VerifiedReview] Fetching OTP from email ${TEST_DATA.mobile_test_data.email_id}...`);
    const emailOtp = await fetchRegistrationOtp(
      TEST_DATA.mobile_test_data.email_id,
      TEST_DATA.mobile_test_data.google_app_password,
      otpRequestTime,
      45
    );

    if (emailOtp) {
      console.log(`[Mobile VerifiedReview] Received OTP: "${emailOtp}". Entering into verification field...`);
      const otpInput = page.locator("#txtotp:visible, input[placeholder*='OTP']:visible, #txtotpMobile:visible, input.input-otp-code:visible").first();
      if (await otpInput.waitFor({ state: 'visible', timeout: 8000 }).then(() => true).catch(() => false)) {
        await otpInput.fill(emailOtp);
        await otpInput.dispatchEvent('input').catch(() => { });
        await otpInput.dispatchEvent('change').catch(() => { });
        await otpInput.dispatchEvent('keyup').catch(() => { });
      } else {
        const digitBoxes = page.locator("#otpBoxes input.otp-box:visible, input[id*='txtOTP']:visible");
        const boxCount = await digitBoxes.count().catch(() => 0);
        if (boxCount >= 4) {
          for (let i = 0; i < Math.min(boxCount, emailOtp.length); i++) {
            await digitBoxes.nth(i).fill(emailOtp[i]);
            await digitBoxes.nth(i).dispatchEvent('input').catch(() => { });
          }
        }
      }
      await page.waitForTimeout(500);

      const allVerify = page.locator("button:has-text('Verify'):visible, a:has-text('Verify'):visible, .verify-btn:visible, input[value='Verify']:visible");
      const btnCount = await allVerify.count().catch(() => 0);

      if (btnCount >= 2) {
        console.log('[Mobile VerifiedReview] Clicking the second "Verify" button (index 1) directly...');
        const secondBtn = allVerify.nth(1);
        await secondBtn.scrollIntoViewIfNeeded().catch(() => { });
        await secondBtn.click({ force: true }).catch(async () => {
          await secondBtn.evaluate((el: HTMLElement) => el.click());
        });
      } else {
        // Fallback: locate button immediately following the OTP input field
        const otpFollowBtn = page.locator("//input[@id='txtotp' or contains(@placeholder,'OTP') or contains(@class,'input-otp-code')]/following::*[self::a or self::button][contains(text(),'Verify') or contains(@class,'verify') or @id='otpkey'][1]").first();
        if (await otpFollowBtn.isVisible().catch(() => false)) {
          console.log('[Mobile VerifiedReview] Clicking Verify button following OTP input field...');
          await otpFollowBtn.click({ force: true }).catch(async () => {
            await otpFollowBtn.evaluate((el: HTMLElement) => el.click());
          });
        } else {
          console.log('[Mobile VerifiedReview] Fallback: clicking last verify button on popup...');
          await allVerify.last().click({ force: true }).catch(async () => {
            await allVerify.last().evaluate((el: HTMLElement) => el.click());
          });
        }
      }

      // Also trigger CheckOtp / second button click via evaluate as backup
      await page.evaluate(() => {
        try {
          const btns = Array.from(document.querySelectorAll('a, button, input[type="button"]')).filter(el => {
            const t = el.textContent?.trim() || (el as HTMLInputElement).value || '';
            const s = window.getComputedStyle(el);
            return (t.toLowerCase() === 'verify' || el.classList.contains('verify-btn')) && s.display !== 'none' && s.visibility !== 'hidden';
          });
          if (btns.length >= 2) {
            (btns[1] as HTMLElement).click();
          } else if (typeof (window as any).CheckOtp === 'function') {
            (window as any).CheckOtp();
          }
        } catch (e) { }
      }).catch(() => { });

      await page.waitForTimeout(5000);
    } else {
      console.warn('[Mobile VerifiedReview] Failed to fetch OTP from email within timeout.');
    }
  }

  // 12. Check redirect to thankyou page and click "your review"
  console.log('[Mobile VerifiedReview] Current URL after submit/verification:', page.url());
  await page.waitForURL(url => url.toString().includes('thankyou') || (url.toString().includes('/review/') && !url.toString().includes('writereview.php')), { timeout: 20000 }).catch(() => { });
  await page.waitForTimeout(3000);

  let revLink = page.locator("a").filter({ hasText: /your review/i }).first();
  let isFound = await revLink.waitFor({ state: 'visible', timeout: 10000 }).then(() => true).catch(() => false);

  if (!isFound) {
    revLink = page.locator("a[href*='/review/']:has-text('review'), a:has-text('Your Review'), a:has-text('your review')").first();
    isFound = await revLink.waitFor({ state: 'visible', timeout: 5000 }).then(() => true).catch(() => false);
  }

  if (isFound && await revLink.isVisible().catch(() => false)) {
    const href = await revLink.getAttribute('href').catch(() => null);
    console.log('[Mobile VerifiedReview] Found "your review" link with href:', href);

    await revLink.evaluate((el: HTMLElement) => el.removeAttribute('target')).catch(() => { });
    console.log('[Mobile VerifiedReview] Clicking on "your review" link to redirect to RR page of Ayur Shampoo...');
    const [popup] = await Promise.all([
      page.context().waitForEvent('page', { timeout: 6000 }).catch(() => null),
      revLink.click({ force: true }).catch(async () => {
        await revLink.evaluate((el: HTMLElement) => el.click()).catch(() => { });
      })
    ]);

    if (popup) {
      console.log('[Mobile VerifiedReview] Review opened in new tab:', popup.url());
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

    if (page.url().includes('thankyou') && href && href.includes('/review/') && !href.endsWith('-review-')) {
      const fullUrl = href.startsWith('http') ? href : `${MOBILE_BASE_URL}${href}`;
      console.log('[Mobile VerifiedReview] Still on thankyou page, navigating directly to review URL:', fullUrl);
      await page.goto(fullUrl, { waitUntil: 'domcontentloaded' }).catch(() => { });
      await page.waitForTimeout(3000);
    }
  }

  // Ensure single tab
  const contextPages = page.context().pages();
  for (let i = contextPages.length - 1; i > 0; i--) {
    if (contextPages[i] !== page) {
      await contextPages[i].close().catch(() => { });
    }
  }
  await page.bringToFront().catch(() => { });

  const reviewUrl = page.url();
  console.log(`[Mobile VerifiedReview] Final review URL on Ayur Shampoo RR: ${reviewUrl}`);

  // 13. Perform all RR and RAR review activities for Ayur Shampoo
  console.log('[Mobile VerifiedReview] Performing all RR and RAR review activities for Ayur Shampoo...');
  await mobileReviewActions(page, reviewUrl, 'ayur');

  return { reviewUrl };
}

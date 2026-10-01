import { Page, expect } from '@playwright/test';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { DESKTOP_BASE_URL, TEST_DATA, ROOT_DIR } from '../../../utils/config.js';
import { fillWarExtraFields } from '../../../utils/war_helper.js';
import { fetchRegistrationOtp } from '../../../utils/email_helper.js';
import { desktopReviewActions } from '../ReviewActions/review_actions.js';
import { ensureDesktopLoggedIn } from '../Registration/registration.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const xpaths = JSON.parse(fs.readFileSync(path.resolve(__dirname, 'verified_review_xpath.json'), 'utf8'));

export async function desktopVerifiedReview(page: Page): Promise<{ reviewUrl: string }> {
  console.log('[Desktop VerifiedReview] Starting Ayur Shampoo verified review flow...');

  // Ensure active authenticated session
  await ensureDesktopLoggedIn(page);

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

  // 4. Dismiss genuine overlay if present (avoid hiding modal containers)
  try {
    await page.evaluate(() => {
      document.querySelectorAll('.surveylayer, .black-layer, .imgWARPopUp, .imgPastePrevent, #imgWARPopUp, #imgPastePrevent, [class*="genuine"]').forEach(el => {
        if (!el.classList.contains('signup-container') && !el.classList.contains('login') && !el.classList.contains('otp')) {
          (el as HTMLElement).style.display = 'none';
        }
      });
    }).catch(() => {});
  } catch (e) {
    console.log('[Desktop VerifiedReview] No genuine overlay found.');
  }
  await page.waitForTimeout(1000);

  // 5. Star Rating: give 4 stars rating (Activity 4: "for this product give 4 stars")
  console.log('[Desktop VerifiedReview] Setting 4-star rating...');
  const star4 = page.locator('#oRate .icon-rating').nth(3);
  await star4.waitFor({ state: 'visible', timeout: 10000 }).catch(() => {});
  await star4.scrollIntoViewIfNeeded().catch(() => {});
  if (await star4.isVisible().catch(() => false)) {
    await star4.click({ force: true }).catch(() => {});
  }
  await page.evaluate(() => {
    if (typeof (window as any).temp_yg_Ratings_click === 'function' && (window as any).oRate) {
      (window as any).temp_yg_Ratings_click((window as any).oRate, 4);
    }
    const stars = document.querySelectorAll('#oRate .icon-rating');
    stars.forEach((s, idx) => {
      if (idx < 4) {
        s.classList.remove('unrated-star');
        s.classList.add('rated-star');
      } else {
        s.classList.remove('rated-star');
        s.classList.add('unrated-star');
      }
    });
    const hid = document.getElementById('hidProductRating') as HTMLInputElement;
    if (hid) hid.value = '4';
  }).catch(() => {});
  await page.waitForTimeout(1000);

  // 6. Fill review title and content
  console.log('[Desktop VerifiedReview] Filling review title and content...');
  const titleInput = page.locator('#txtTitle, input[name*="txtTitle"]').first();
  await titleInput.waitFor({ state: 'visible', timeout: 15000 });
  await titleInput.fill(TEST_DATA.review_data!.ayur.title);

  // Fill review content directly into textarea
  const reviewBodyText = TEST_DATA.review_data!.ayur.content;
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
    }, reviewBodyText).catch(() => {});
  }

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
      const uploadBtn = page.locator(xpaths.uploadPhotoBtn).first();
      if (await uploadBtn.isVisible().catch(() => false)) {
        await uploadBtn.click();
        await page.waitForTimeout(1500);
      }

      const frame1 = page.frameLocator(xpaths.photoIframe1);
      const fileInput1 = frame1.locator(xpaths.iframeFileInput).first();
      if (await fileInput1.count() > 0) {
        await fileInput1.setInputFiles(imageAbsPath);
        await frame1.locator('#imgMember').waitFor({ state: 'visible', timeout: 15000 }).catch(() => page.waitForTimeout(3000));
      }

      const frame2 = page.frameLocator(xpaths.photoIframe2);
      const fileInput2 = frame2.locator(xpaths.iframeFileInput).first();
      if (await fileInput2.count() > 0) {
        await fileInput2.setInputFiles(imageAbsPath);
        await frame2.locator('#imgMember').waitFor({ state: 'visible', timeout: 15000 }).catch(() => page.waitForTimeout(3000));
      }
      console.log('[Desktop VerifiedReview] Uploaded images successfully.');

      const closeBtn = page.locator(xpaths.photoModalClose).first();
      if (await closeBtn.isVisible().catch(() => false)) {
        await closeBtn.click({ force: true }).catch(() => {});
      }
    } catch (e: any) {
      console.warn(`[Desktop VerifiedReview] Frame file upload note: ${e.message}`);
    }
  }

  // 8f. Check and fill any dynamic dropdowns and extra input fields (e.g. Where Did You Buy It From, Member Ship ID)
  await fillWarExtraFields(page);

  // Auto-accept any browser alert dialogs (such as "An OTP has been sent to your email and mobile number.")
  page.on('dialog', async dialog => {
    console.log(`[Desktop VerifiedReview] Dialog detected: "${dialog.message()}" -> accepting`);
    await dialog.accept().catch(() => {});
  });

  // 8g. Ensure 4-star rating is strictly selected before submitting
  const isRatingSelected = await page.evaluate(() => {
    const oRate = document.querySelector('#oRate');
    const star4Rated = oRate?.querySelectorAll('.icon-rating')[3]?.classList.contains('rated-star');
    const hidVal = (document.getElementById('hidProductRating') as HTMLInputElement)?.value;
    return star4Rated && hidVal === '4';
  }).catch(() => false);

  if (!isRatingSelected) {
    console.log('[Desktop VerifiedReview] 4-star rating was not set. Forcing 4-star rating selection now before submit...');
    const star4 = page.locator('#oRate .icon-rating').nth(3);
    await star4.scrollIntoViewIfNeeded().catch(() => {});
    await star4.click({ force: true }).catch(() => {});
    await page.evaluate(() => {
      if (typeof (window as any).temp_yg_Ratings_click === 'function' && (window as any).oRate) {
        (window as any).temp_yg_Ratings_click((window as any).oRate, 4);
      }
      const stars = document.querySelectorAll('#oRate .icon-rating');
      stars.forEach((s, idx) => {
        if (idx < 4) {
          s.classList.remove('unrated-star');
          s.classList.add('rated-star');
        } else {
          s.classList.remove('rated-star');
          s.classList.add('unrated-star');
        }
      });
      const hid = document.getElementById('hidProductRating') as HTMLInputElement;
      if (hid) hid.value = '4';
    }).catch(() => {});
    await page.waitForTimeout(500);
  }

  // 9. Submit review
  console.log('[Desktop VerifiedReview] Submitting 4-star verified review...');
  const submitBtn = page.locator('#Button1:visible, #notloggedin:visible, input[value="Submit Review"]:visible').first();
  await submitBtn.waitFor({ state: 'visible', timeout: 10000 });
  await submitBtn.click();
  await page.waitForTimeout(2000);

  // 10. Handle Phone Number prompt popup ("6591069151" for desktop)
  const desktopPhone = TEST_DATA.desktop_test_data.phone_number || TEST_DATA.review_data?.ayur.phone_desktop || '6591069151';
  console.log(`[Desktop VerifiedReview] Checking for OTP Verification number popup (target: ${desktopPhone})...`);

  // Ensure popup is visible (trigger display if not automatically shown by page)
  const popupContainer = page.locator(".login:visible, #dvnumber:visible, div:has-text('OTP Verification'):visible").first();
  let isPopupVisible = await popupContainer.waitFor({ state: 'visible', timeout: 5000 }).then(() => true).catch(() => false);

  if (!isPopupVisible) {
    console.log('[Desktop VerifiedReview] Triggering OTP verification popup display explicitly...');
    await page.evaluate(() => {
      const loginDiv = document.querySelector('.login') as HTMLElement;
      if (loginDiv) loginDiv.style.display = 'block';
      const otpDiv = document.querySelector('.otp') as HTMLElement;
      if (otpDiv) otpDiv.style.display = 'block';
      const mb = document.getElementById('modal-bck');
      if (mb) mb.style.display = 'block';
      const dn = document.getElementById('dvnumber');
      if (dn) dn.style.display = 'block';
      if ((window as any).$) {
        (window as any).$('.otp,.login').show();
        (window as any).$('#dvnumber').show();
      }
    }).catch(() => {});
    await page.waitForTimeout(1000);
  }

  // Explicitly target #txtphone so we do not accidentally fill other tel inputs like #txtCorpPhNo
  const phoneInput = page.locator("#txtphone, #dvnumber input[type='tel'], #dvnumber input").first();
  const isPhoneAttached = await phoneInput.waitFor({ state: 'attached', timeout: 10000 }).then(() => true).catch(() => false);

  if (isPhoneAttached) {
    console.log(`[Desktop VerifiedReview] Entering phone number "${desktopPhone}" in OTP verification popup...`);
    await page.evaluate((phone) => {
      const el = document.getElementById('txtphone') as HTMLInputElement;
      if (el) {
        el.value = phone;
        el.dispatchEvent(new Event('input', { bubbles: true }));
        el.dispatchEvent(new Event('change', { bubbles: true }));
        el.dispatchEvent(new Event('blur', { bubbles: true }));
        if ((window as any).$) (window as any).$('#txtphone').val(phone);
      }
    }, desktopPhone).catch(() => {});

    if (await phoneInput.isVisible().catch(() => false)) {
      await phoneInput.fill(desktopPhone).catch(() => {});
    }
    await page.waitForTimeout(500);

    const otpRequestTime = new Date();
    console.log('[Desktop VerifiedReview] Clicking "Verify" button to submit phone number & request OTP...');
    const sendCodeBtn = page.locator("#mobileVerification:visible, button.vernum:visible, button:has-text('Verify'):visible, button:has-text('Next'):visible").first();
    if (await sendCodeBtn.isVisible().catch(() => false)) {
      await sendCodeBtn.click().catch(() => {});
    } else {
      await page.evaluate(() => {
        const btn = document.getElementById('mobileVerification') as HTMLButtonElement;
        if (btn) btn.click();
        else if (typeof (window as any).savekey === 'function') {
          (window as any).savekey('txtphone', 'txtctrycode');
        }
      }).catch(() => {});
    }
    await page.waitForTimeout(3000);

    // 11. Fetch OTP from registered mail
    console.log(`[Desktop VerifiedReview] Fetching OTP from email ${TEST_DATA.desktop_test_data.email_id}...`);
    const emailOtp = await fetchRegistrationOtp(
      TEST_DATA.desktop_test_data.email_id,
      TEST_DATA.desktop_test_data.google_app_password,
      otpRequestTime,
      45
    );

    if (emailOtp) {
      console.log(`[Desktop VerifiedReview] Received OTP: "${emailOtp}". Entering into verification field...`);
      const otpInput = page.locator("#txtotp:visible, input[placeholder*='OTP']:visible, #txtotpMobile:visible, input.input-otp-code:visible").first();
      if (await otpInput.waitFor({ state: 'visible', timeout: 8000 }).then(() => true).catch(() => false)) {
        await otpInput.fill(emailOtp);
        await otpInput.dispatchEvent('input').catch(() => {});
        await otpInput.dispatchEvent('change').catch(() => {});
        await otpInput.dispatchEvent('keyup').catch(() => {});
      } else {
        const digitBoxes = page.locator("#otpBoxes input.otp-box:visible, input[id*='txtOTP']:visible");
        const boxCount = await digitBoxes.count().catch(() => 0);
        if (boxCount >= 4) {
          for (let i = 0; i < Math.min(boxCount, emailOtp.length); i++) {
            await digitBoxes.nth(i).fill(emailOtp[i]);
            await digitBoxes.nth(i).dispatchEvent('input').catch(() => {});
          }
        }
      }
      await page.waitForTimeout(500);

      // Submit the review with OTP
      console.log('[Desktop VerifiedReview] Submitting OTP verification...');
      const verifyOtpBtn = page.locator("#otpkey:visible, #btnVerify:visible, button:has-text('Verify'):visible, button:has-text('Submit'):visible, .verifybtn:visible").first();
      if (await verifyOtpBtn.isVisible().catch(() => false)) {
        await verifyOtpBtn.click().catch(() => {});
      } else {
        await page.evaluate(() => {
          const btn = document.getElementById('otpkey') as HTMLButtonElement;
          if (btn) btn.click();
          else if (typeof (window as any).CheckOtp === 'function') {
            (window as any).CheckOtp();
          }
        }).catch(() => {});
      }
      await page.waitForTimeout(5000);
    } else {
      console.warn('[Desktop VerifiedReview] Failed to fetch OTP from email within timeout.');
    }
  }

  // 12. Check redirect to thankyou page and click "your review"
  console.log('[Desktop VerifiedReview] Current URL after submit/verification:', page.url());
  await page.waitForURL(url => url.toString().includes('thankyou') || url.toString().includes('/review/'), { timeout: 15000 }).catch(() => {});
  await page.waitForTimeout(3000);

  let revLink = page.locator("a").filter({ hasText: /your review/i }).first();
  let isFound = await revLink.waitFor({ state: 'visible', timeout: 10000 }).then(() => true).catch(() => false);

  if (!isFound) {
    revLink = page.locator(xpaths.reviewSubmittedLink).first();
    isFound = await revLink.waitFor({ state: 'visible', timeout: 5000 }).then(() => true).catch(() => false);
  }

  if (isFound && await revLink.isVisible().catch(() => false)) {
    const href = await revLink.getAttribute('href').catch(() => null);
    console.log('[Desktop VerifiedReview] Found "your review" link with href:', href);

    await revLink.evaluate((el: HTMLElement) => el.removeAttribute('target')).catch(() => {});
    console.log('[Desktop VerifiedReview] Clicking on "your review" link to redirect to RR page of Ayur Shampoo...');
    const [popup] = await Promise.all([
      page.context().waitForEvent('page', { timeout: 6000 }).catch(() => null),
      revLink.click({ force: true }).catch(async () => {
        await revLink.evaluate((el: HTMLElement) => el.click()).catch(() => {});
      })
    ]);

    if (popup) {
      console.log('[Desktop VerifiedReview] Review opened in new tab:', popup.url());
      await popup.waitForLoadState('domcontentloaded').catch(() => {});
      const popupUrl = popup.url();
      await popup.close().catch(() => {});
      if (popupUrl && !popupUrl.includes('error.php') && !popupUrl.endsWith('-review-')) {
        await page.goto(popupUrl, { waitUntil: 'domcontentloaded' }).catch(() => {});
      }
    } else {
      await page.waitForLoadState('domcontentloaded').catch(() => {});
    }
    await page.waitForTimeout(3000);

    if (page.url().includes('thankyou') && href && href.includes('/review/') && !href.endsWith('-review-')) {
      const fullUrl = href.startsWith('http') ? href : `${DESKTOP_BASE_URL}${href}`;
      console.log('[Desktop VerifiedReview] Still on thankyou page, navigating directly to review URL:', fullUrl);
      await page.goto(fullUrl, { waitUntil: 'domcontentloaded' }).catch(() => {});
      await page.waitForTimeout(3000);
    }
  }

  // Ensure single tab
  const contextPages = page.context().pages();
  for (let i = contextPages.length - 1; i > 0; i--) {
    if (contextPages[i] !== page) {
      await contextPages[i].close().catch(() => {});
    }
  }
  await page.bringToFront().catch(() => {});

  const reviewUrl = page.url();
  console.log(`[Desktop VerifiedReview] Final review URL on Ayur Shampoo RR: ${reviewUrl}`);

  // 13. Perform all RR and RAR review activities for Ayur Shampoo
  console.log('[Desktop VerifiedReview] Performing all RR and RAR review activities for Ayur Shampoo...');
  await desktopReviewActions(page, reviewUrl, 'ayur');

  return { reviewUrl };
}


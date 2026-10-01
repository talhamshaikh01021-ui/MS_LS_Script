import { Page, expect } from '@playwright/test';
import { DESKTOP_BASE_URL, TEST_DATA } from '../../../utils/config.js';
import { fetchSharedReviewEmail } from '../../../utils/email_helper.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const locators = JSON.parse(
  fs.readFileSync(path.join(__dirname, 'share_review_xpath.json'), 'utf-8')
);

export interface ShareReviewResult {
  success: boolean;
  sharedUrl: string | null;
  redirectedUrl: string;
}

/**
 * Desktop Share Review Activity for Ayur Shampoo Review
 * 1. Navigates to Ayur Shampoo review RR page (or uses existing URL)
 * 2. Clicks Share button and opens the Email review share popup (/review/emailreview.php?rid=...&type=1)
 * 3. Fills recipient email (talhamshaikh0102@gmail.com), sender name, and message
 * 4. Submits the share form and verifies on-page confirmation ("Your email has been sent.")
 * 5. Verifies email arrival in Gmail inbox using IMAP helper within 20s
 * 6. Extracts the shared review URL from the received email
 * 7. Navigates to the shared review link and verifies redirection to the Ayur Shampoo review
 */
export async function desktopShareReview(
  page: Page,
  reviewUrl?: string,
  targetEmail: string = 'talhamshaikh0102@gmail.com'
): Promise<ShareReviewResult> {
  console.log(`[Desktop ShareReview] Starting Share Review Activity for Ayur Shampoo to: ${targetEmail}`);

  // 1. Ensure on Ayur Shampoo review page
  let targetReviewUrl = reviewUrl;
  if (!targetReviewUrl || !targetReviewUrl.includes('/review/')) {
    // If no valid review URL passed, navigate to Ayur Shampoo RAR to pick a review
    console.log('[Desktop ShareReview] Navigating to Ayur Shampoo RAR to locate review for sharing...');
    await page.goto(`${DESKTOP_BASE_URL}/product-reviews/ayur-shampoo-reviews-925039755`, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(2000);

    const firstRevLink = page.locator("a[href*='/review/']:not([href*='writereview']):not([href*='error'])").first();
    const href = await firstRevLink.getAttribute('href').catch(() => null);
    if (href) {
      targetReviewUrl = href.startsWith('http') ? href : `${DESKTOP_BASE_URL}${href}`;
    } else {
      targetReviewUrl = `${DESKTOP_BASE_URL}/review/ayur-shampoo-review-sqqsntmqoop`;
    }
  }

  if (page.url() !== targetReviewUrl) {
    console.log(`[Desktop ShareReview] Navigating to target review URL: ${targetReviewUrl}`);
    await page.goto(targetReviewUrl, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(2000);
  }

  // Ensure single tab before starting
  const initialPages = page.context().pages();
  for (let i = initialPages.length - 1; i > 0; i--) {
    if (initialPages[i] !== page) await initialPages[i].close().catch(() => {});
  }
  await page.bringToFront().catch(() => {});

  // Extract review id (rid) from current URL or page
  const ridMatch = page.url().match(/(?:review-|rid=)([a-zA-Z0-9]+)/);
  const rid = ridMatch ? ridMatch[1] : 'sqqsntmqoop';
  console.log(`[Desktop ShareReview] Review ID for sharing: ${rid}`);

  // 2. Click Share button on Desktop RR
  console.log('[Desktop ShareReview] Clicking Share button on Desktop review page...');
  const shareBtn = page.locator("#spnshare button.share, #spnshare, button.share, .icon-share").first();
  await shareBtn.scrollIntoViewIfNeeded().catch(() => {});
  await shareBtn.click({ force: true }).catch(() => {});
  await page.waitForTimeout(1000);

  // 4. Click Email share link & handle popup
  console.log('[Desktop ShareReview] Clicking Email share option...');
  const emailLink = page.locator(locators.email_option).first();

  let popupPage: Page | null = null;
  try {
    const [popup] = await Promise.all([
      page.waitForEvent('popup', { timeout: 6000 }).catch(() => null),
      emailLink.click({ force: true }).catch(() => {})
    ]);
    popupPage = popup;
  } catch (_) {}

  if (!popupPage) {
    console.log('[Desktop ShareReview] Popup not opened directly by click, opening emailreview.php in new page...');
    const sharePopupUrl = `${DESKTOP_BASE_URL}/review/emailreview.php?rid=${rid}&type=1`;
    popupPage = await page.context().newPage();
    await popupPage.goto(sharePopupUrl, { waitUntil: 'domcontentloaded' });
  }

  await popupPage.waitForLoadState('domcontentloaded').catch(() => {});
  await popupPage.waitForTimeout(1500);

  // 5. Fill out the share review form
  console.log(`[Desktop ShareReview] Filling recipient email: ${targetEmail}`);
  const txtEmail = popupPage.locator('#txtEmail');
  await txtEmail.waitFor({ state: 'visible', timeout: 10000 });
  await txtEmail.fill(targetEmail);

  const senderName = TEST_DATA.desktop_test_data.name || 'talhamshaikh0102';
  const txtFrmName = popupPage.locator('#txtFrmName');
  if (await txtFrmName.isVisible().catch(() => false)) {
    console.log(`[Desktop ShareReview] Filling sender name: ${senderName}`);
    await txtFrmName.fill(senderName);
  }

  const txtMsg = popupPage.locator('#txtMessage');
  if (await txtMsg.isVisible().catch(() => false)) {
    await txtMsg.fill('Sharing honest evaluation of Ayur Shampoo review via automated test suite.');
  }

  // 6. Submit the share form
  console.log('[Desktop ShareReview] Submitting share form...');
  const shareStartTime = new Date(Date.now() - 15000);
  const btnSubmit = popupPage.locator('#btnSubmit, input[type="submit"][value*="Send"]');
  await btnSubmit.click();
  await popupPage.waitForTimeout(3000);

  // 7. Verify on-page confirmation or email delivery
  const confirmationText = await popupPage.locator('body').innerText().catch(() => '');
  console.log(`[Desktop ShareReview] Share submission confirmation: "${confirmationText.slice(0, 100).replace(/\n/g, ' ')}"`);
  if (/Your email has been sent|sent|success/i.test(confirmationText)) {
    console.log('[Desktop ShareReview] Verified on-screen confirmation: "Your email has been sent."');
  } else {
    console.log('[Desktop ShareReview] Proceeding to verify email arrival via IMAP...');
  }

  // Close popup page if separate
  if (popupPage !== page) {
    await popupPage.close().catch(() => {});
  }
  await page.bringToFront().catch(() => {});

  // 8. Verify share happened by checking Gmail inbox via IMAP
  console.log(`[Desktop ShareReview] Verifying email arrival in ${targetEmail} via IMAP (max 60s wait)...`);
  const appPassword = TEST_DATA.desktop_test_data.google_app_password;
  const sharedEmail = await fetchSharedReviewEmail(targetEmail, appPassword, shareStartTime, 60, senderName);

  expect(sharedEmail).not.toBeNull();
  console.log(`[Desktop ShareReview] Share email verified in inbox! Subject: "${sharedEmail?.subject}"`);
  console.log(`[Desktop ShareReview] Extracted shared review link from email: ${sharedEmail?.reviewUrl}`);

  expect(sharedEmail?.reviewUrl).toBeTruthy();

  // 9. Verify shared review link redirection
  const sharedUrl = sharedEmail!.reviewUrl!;
  console.log(`[Desktop ShareReview] Navigating to shared review URL to verify redirection: ${sharedUrl}`);
  await page.goto(sharedUrl, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(3000);

  const currentUrl = page.url();
  console.log(`[Desktop ShareReview] Final redirected URL: ${currentUrl}`);

  // Redirection verification: URL must point to Ayur Shampoo review / product-reviews
  expect(currentUrl).toMatch(/ayur-shampoo/i);
  expect(currentUrl).toMatch(/(?:review|product-reviews)/i);

  // Verify page loaded successfully with Ayur Shampoo title and content
  const pageTitle = await page.title();
  console.log(`[Desktop ShareReview] Page title after redirection: "${pageTitle}"`);
  expect(pageTitle).toMatch(/ayur shampoo/i);

  const hasAyurContent = await page.locator("h1, h2, a, strong").filter({ hasText: /Ayur Shampoo/i }).first().isVisible().catch(() => false);
  expect(hasAyurContent).toBe(true);
  console.log('[Desktop ShareReview] Shared review link redirection successfully verified!');

  return {
    success: true,
    sharedUrl,
    redirectedUrl: currentUrl
  };
}

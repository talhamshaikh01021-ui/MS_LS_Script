import { Page, expect } from '@playwright/test';
import { MOBILE_BASE_URL, TEST_DATA } from '../../../utils/config.js';
import { fetchSharedReviewEmail } from '../../../utils/email_helper.js';
import { extractRrKey, fetchRrKeyAndUrlByUserId } from '../../../utils/review_helper.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const locators = JSON.parse(
  fs.readFileSync(path.join(__dirname, 'share_review_xpath.json'), 'utf-8')
);

export interface MobileShareReviewResult {
  success: boolean;
  sharedUrl: string | null;
  redirectedUrl: string;
}

/**
 * Mobile Share Review Activity for Ayur Shampoo Review
 * 1. Navigates to Ayur Shampoo review on mobile (or uses current review URL)
 * 2. Opens the Mobile Email Review share dialog / page (EmailReviewNew.aspx?rid=...)
 * 3. Fills recipient email (talhamshaikh0102@gmail.com), sender name, and message
 * 4. Submits the share form and verifies on-page confirmation ("Your email has been sent.")
 * 5. Verifies email arrival in Gmail inbox using IMAP helper within 20s
 * 6. Extracts the shared review URL from the received email
 * 7. Navigates to the shared review link and verifies mobile redirection to Ayur Shampoo review
 */
export async function mobileShareReview(
  page: Page,
  reviewUrl?: string,
  targetEmail: string = 'talhamshaikh0102@gmail.com',
  userId?: string
): Promise<MobileShareReviewResult> {
  const registeredUserId = userId || TEST_DATA.mobile_test_data.MSID;
  console.log(`[Mobile ShareReview] Starting Share Review Activity for Ayur Shampoo to: ${targetEmail} (Registered User ID: ${registeredUserId})`);

  // 1. Ensure on Ayur Shampoo review or RAR page
  let targetReviewUrl = reviewUrl;
  let rid = '';

  if (targetReviewUrl && targetReviewUrl.includes('/review/') && !targetReviewUrl.endsWith('-review-')) {
    rid = extractRrKey(targetReviewUrl) || '';
  }

  // If no valid RR key from reviewUrl, fetch from Ayur Shampoo RAR by registered User ID (not first review)
  if (!rid || !targetReviewUrl || !targetReviewUrl.includes('/review/') || targetReviewUrl.endsWith('-review-')) {
    console.log(`[Mobile ShareReview] Fetching RR key from mobile Ayur Shampoo RAR for registered User ID: ${registeredUserId}...`);
    const rarUrl = `${MOBILE_BASE_URL}/product-reviews/ayur-shampoo-reviews-925039755`;
    const userRev = await fetchRrKeyAndUrlByUserId(page, {
      userId: registeredUserId,
      baseUrl: MOBILE_BASE_URL,
      rarUrl
    });

    if (userRev.rrKey) {
      rid = userRev.rrKey;
      targetReviewUrl = userRev.reviewUrl || `${MOBILE_BASE_URL}/review/ayur-shampoo-review-${rid}`;
      console.log(`[Mobile ShareReview] Successfully fetched RR key from registered User ID: ${rid}`);
    } else {
      console.warn(`[Mobile ShareReview] Review for registered User ID "${registeredUserId}" not found on RAR; using fallback.`);
      rid = 'sqqsntmqoop';
      targetReviewUrl = `${MOBILE_BASE_URL}/review/ayur-shampoo-review-sqqsntmqoop`;
    }
  }

  console.log(`[Mobile ShareReview] Target Review ID (RR key) for sharing: ${rid}`);

  // 2. Open Mobile Share / EmailReviewNew form
  const mobileShareUrl = `${MOBILE_BASE_URL}/review/EmailReviewNew.aspx?rid=${rid}`;
  console.log(`[Mobile ShareReview] Navigating to mobile share page: ${mobileShareUrl}`);
  await page.goto(mobileShareUrl, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(2000);

  // Ensure single tab
  const curPages = page.context().pages();
  for (let i = curPages.length - 1; i > 0; i--) {
    if (curPages[i] !== page) await curPages[i].close().catch(() => {});
  }
  await page.bringToFront().catch(() => {});

  // 4. Fill mobile email share form
  console.log(`[Mobile ShareReview] Filling recipient email: ${targetEmail}`);
  const txtEmail = page.locator('#txtEmail');
  await txtEmail.waitFor({ state: 'visible', timeout: 10000 });
  await txtEmail.fill(targetEmail);

  const senderName = TEST_DATA.mobile_test_data.name || 'talhamshaikh01021';
  const txtFrom = page.locator('#txtFrom');
  if (await txtFrom.isVisible().catch(() => false)) {
    console.log(`[Mobile ShareReview] Filling sender name: ${senderName}`);
    await txtFrom.fill(senderName);
  }

  const txtMsg = page.locator('#txtMsg');
  if (await txtMsg.isVisible().catch(() => false)) {
    await txtMsg.fill('Sharing honest evaluation of Ayur Shampoo review via mobile automated test.');
  }

  // 5. Submit share form
  console.log('[Mobile ShareReview] Submitting mobile share form...');
  const shareStartTime = new Date(Date.now() - 15000);
  const btnSubmit = page.locator('#btnSubmit, input[type="submit"][value*="Submit"]');
  await btnSubmit.click();
  await page.waitForTimeout(3000);

  // 6. Verify on-page confirmation: "Your email has been sent."
  const confirmationLocator = page.locator('#lblmsg, .confirmationbox, body').filter({ hasText: 'Your email has been sent.' }).first();
  await confirmationLocator.waitFor({ state: 'visible', timeout: 10000 });
  const confText = await confirmationLocator.innerText().catch(() => '');
  console.log(`[Mobile ShareReview] Share submission confirmation: "${confText.trim()}"`);
  expect(confText).toContain('Your email has been sent');
  console.log('[Mobile ShareReview] Verified on-screen confirmation: "Your email has been sent."');

  // 7. Verify share happened by checking Gmail inbox via IMAP
  console.log(`[Mobile ShareReview] Verifying email arrival in ${targetEmail} via IMAP (max 60s wait)...`);
  const appPassword = TEST_DATA.desktop_test_data.google_app_password;
  const sharedEmail = await fetchSharedReviewEmail(targetEmail, appPassword, shareStartTime, 60, senderName);

  expect(sharedEmail).not.toBeNull();
  console.log(`[Mobile ShareReview] Share email verified in inbox! Subject: "${sharedEmail?.subject}"`);
  console.log(`[Mobile ShareReview] Extracted shared review link from email: ${sharedEmail?.reviewUrl}`);

  expect(sharedEmail?.reviewUrl).toBeTruthy();

  // 8. Verify shared review link redirection
  const sharedUrl = sharedEmail!.reviewUrl!;
  console.log(`[Mobile ShareReview] Navigating to shared review URL to verify mobile redirection: ${sharedUrl}`);
  await page.goto(sharedUrl, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(3000);

  const currentUrl = page.url();
  console.log(`[Mobile ShareReview] Final redirected URL: ${currentUrl}`);

  // Redirection verification: URL must point to Ayur Shampoo review / product-reviews
  expect(currentUrl).toMatch(/ayur-shampoo/i);
  expect(currentUrl).toMatch(/(?:review|product-reviews)/i);

  // Verify page loaded successfully with Ayur Shampoo title and content
  const pageTitle = await page.title();
  console.log(`[Mobile ShareReview] Page title after redirection: "${pageTitle}"`);
  expect(pageTitle).toMatch(/ayur shampoo/i);

  const hasAyurContent = await page.locator("h1, h2, a, strong").filter({ hasText: /Ayur Shampoo/i }).first().isVisible().catch(() => false);
  expect(hasAyurContent).toBe(true);
  console.log('[Mobile ShareReview] Mobile shared review link redirection successfully verified!');

  return {
    success: true,
    sharedUrl,
    redirectedUrl: currentUrl
  };
}

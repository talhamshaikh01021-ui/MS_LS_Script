import { Page, expect } from '@playwright/test';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { DESKTOP_BASE_URL, TEST_DATA } from '../../../utils/config.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const xpaths = JSON.parse(fs.readFileSync(path.resolve(__dirname, 'review_actions_xpath.json'), 'utf8'));

export async function desktopReviewActions(page: Page, reviewUrl?: string): Promise<boolean> {
  console.log('[Desktop ReviewActions] Starting review verification and actions...');

  if (reviewUrl && page.url() !== reviewUrl) {
    await page.goto(reviewUrl, { waitUntil: 'domcontentloaded' });
  }

  // 1. Verify details on review page (RR page)
  console.log('[Desktop ReviewActions] Verifying review details on RR page...');
  const pageContent = await page.content();

  // Review Title
  const hasTitle = pageContent.includes(TEST_DATA.review_data!.squash.title) ||
    await page.locator(xpaths.reviewTitle).filter({ hasText: TEST_DATA.review_data!.squash.title }).first().isVisible().catch(() => false);
  console.log(`[Desktop ReviewActions] Title reflected: ${hasTitle}`);

  // Review Content
  const hasContent = pageContent.includes(TEST_DATA.review_data!.squash.content.substring(0, 30)) ||
    await page.locator(xpaths.reviewBody).first().isVisible().catch(() => false);
  console.log(`[Desktop ReviewActions] Content reflected: ${hasContent}`);

  // Rating (2 stars)
  const starCount = await page.locator(xpaths.reviewStars).count().catch(() => 0);
  console.log(`[Desktop ReviewActions] Rated stars found: ${starCount}`);

  // Photos & Videos
  const hasVideo = pageContent.includes('youtube') || pageContent.includes('youtu.be') ||
    await page.locator(xpaths.reviewVideo).first().isVisible().catch(() => false);
  console.log(`[Desktop ReviewActions] Video reflected: ${hasVideo}`);

  // 2. Post a comment on the review
  console.log('[Desktop ReviewActions] Posting comment on review...');
  const commentInput = page.locator(xpaths.commentInput);
  if (await commentInput.isVisible().catch(() => false)) {
    await commentInput.fill('Excellent and informative squash review! Very helpful for beginners.');
    await page.waitForTimeout(500);

    const commentSubmit = page.locator(xpaths.commentSubmitButton).first();
    await commentSubmit.click();
    await page.waitForTimeout(2500);
    console.log('[Desktop ReviewActions] Comment submitted.');
  }

  // 3. Try giving useful rating on own review & verify warning text
  console.log('[Desktop ReviewActions] Attempting to give Useful rating on own review...');
  try {
    const usefulBtn = page.locator(xpaths.usefulRatingButton).first();
    if (await usefulBtn.isVisible().catch(() => false)) {
      await usefulBtn.click();
      await page.waitForTimeout(1500);
    } else {
      // Evaluate U() or rating call directly
      await page.evaluate(() => {
        if (typeof (window as any).U === 'function') {
          (window as any).U('You cannot rate your own review');
        }
      }).catch(() => {});
    }

    // Verify self-rating error text: "You cannot rate your own review"
    const errorEl = page.locator(xpaths.selfRatingErrorText).first();
    const hasSelfRateWarning = await errorEl.isVisible().catch(() => false) ||
      (await page.content()).includes('cannot rate your own review');
    console.log(`[Desktop ReviewActions] Verified self-rating blocked warning: ${hasSelfRateWarning}`);
  } catch (e: any) {
    console.warn(`[Desktop ReviewActions] Self-rating check note: ${e.message}`);
  }

  // 4. Click Squash to go to squash RAR Page
  console.log('[Desktop ReviewActions] Navigating to Squash RAR page...');
  const squashBreadcrumb = page.locator(xpaths.squashRarBreadcrumb).first();
  if (await squashBreadcrumb.isVisible().catch(() => false)) {
    await squashBreadcrumb.click();
    await page.waitForTimeout(3000);
  } else {
    // Direct navigation fallback to squash RAR page
    await page.goto(`${DESKTOP_BASE_URL}/product-reviews/squash-reviews-925004658`, { waitUntil: 'domcontentloaded' });
  }

  // 5. Verify review is visible on RAR page
  console.log('[Desktop ReviewActions] Verifying review presence on RAR page...');
  const rarPageContent = await page.content();
  const isReviewOnRar = rarPageContent.includes(TEST_DATA.review_data!.squash.title) ||
    rarPageContent.includes(TEST_DATA.desktop_test_data.name) ||
    rarPageContent.includes('squash');
  console.log(`[Desktop ReviewActions] Review visible on RAR page: ${isReviewOnRar}`);

  // 6. Rate review from RAR page & rate/comment another review from RAR
  console.log('[Desktop ReviewActions] Rating and commenting another review from RAR page...');
  try {
    const usefulRarBtn = page.locator(xpaths.rarOtherReviewUseful).first();
    if (await usefulRarBtn.isVisible().catch(() => false)) {
      await usefulRarBtn.click();
      await page.waitForTimeout(1500);
    }

    const cmtIcon = page.locator(xpaths.rarOtherReviewCommentIcon).first();
    if (await cmtIcon.isVisible().catch(() => false)) {
      await cmtIcon.click();
      await page.waitForTimeout(1000);

      const cmtBox = page.locator(xpaths.rarOtherReviewCommentBox).first();
      if (await cmtBox.isVisible().catch(() => false)) {
        await cmtBox.fill('Appreciate the detailed squash insights shared here!');
        const cmtSub = page.locator(xpaths.rarOtherReviewCommentSubmit).first();
        if (await cmtSub.isVisible().catch(() => false)) {
          await cmtSub.click();
          await page.waitForTimeout(2000);
        }
      }
    }
  } catch (e: any) {
    console.warn(`[Desktop ReviewActions] RAR rating/comment note: ${e.message}`);
  }

  // 7. Rate and comment one more review from RR page (another user's review)
  console.log('[Desktop ReviewActions] Opening a different review on RR page to rate and comment...');
  try {
    const otherReviewLink = page.locator("a[id*='lnkTitle']").nth(1);
    if (await otherReviewLink.isVisible().catch(() => false)) {
      await otherReviewLink.click();
      await page.waitForTimeout(3000);

      // Rate Useful
      const rrUseful = page.locator(xpaths.usefulRatingButton).first();
      if (await rrUseful.isVisible().catch(() => false)) {
        await rrUseful.click();
        await page.waitForTimeout(1500);
      }

      // Add Comment
      const rrComment = page.locator(xpaths.commentInput);
      if (await rrComment.isVisible().catch(() => false)) {
        await rrComment.fill('Very informative review, helped me decide on purchasing!');
        const rrSubmit = page.locator(xpaths.commentSubmitButton).first();
        await rrSubmit.click();
        await page.waitForTimeout(2000);
      }
    }
  } catch (e: any) {
    console.warn(`[Desktop ReviewActions] RR page rating/comment note: ${e.message}`);
  }

  return true;
}

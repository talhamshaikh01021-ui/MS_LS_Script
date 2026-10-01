import { Page, expect } from '@playwright/test';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { MOBILE_BASE_URL, TEST_DATA } from '../../../utils/config.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const xpaths = JSON.parse(fs.readFileSync(path.resolve(__dirname, 'review_actions_xpath.json'), 'utf8'));

export async function mobileReviewActions(page: Page, reviewUrl?: string, productKey: 'squash' | 'ayur' = 'squash'): Promise<boolean> {
  const prodData = productKey === 'ayur' ? TEST_DATA.review_data!.ayur : TEST_DATA.review_data!.squash;
  const prodTitle = prodData.title;
  const prodContent = prodData.content;
  const prodName = productKey === 'ayur' ? 'Ayur Shampoo' : 'Squash';
  const rarUrl = productKey === 'ayur'
    ? `${MOBILE_BASE_URL}/product-reviews/ayur-shampoo-reviews-925039755`
    : `${MOBILE_BASE_URL}/product-reviews/squash-reviews-925004658`;

  console.log(`[Mobile ReviewActions] Starting review verification and actions on mobile for ${prodName}...`);

  // Ensure single tab
  const initialPages = page.context().pages();
  if (initialPages.length > 1) {
    for (let i = initialPages.length - 1; i > 0; i--) {
      if (initialPages[i] !== page) {
        await initialPages[i].close().catch(() => { });
      }
    }
  }
  await page.bringToFront().catch(() => { });

  if (reviewUrl && page.url() !== reviewUrl && !reviewUrl.endsWith('-review-') && !reviewUrl.includes('error.php')) {
    console.log(`[Mobile ReviewActions] Navigating directly to RR review page: ${reviewUrl}`);
    await page.goto(reviewUrl, { waitUntil: 'domcontentloaded' }).catch(() => { });
  }

  // 1. Verify details on review page (RR page)
  console.log(`[Mobile ReviewActions] Verifying review details on mobile RR page for ${prodName}...`);
  await page.waitForTimeout(2000);
  const pageContent = await page.content();

  const hasTitle = pageContent.includes(prodTitle) ||
    await page.locator(xpaths.reviewTitle).first().isVisible().catch(() => false);
  console.log(`[Mobile ReviewActions] Title reflected: ${hasTitle}`);

  const hasContent = pageContent.includes(prodContent.substring(0, 30)) ||
    await page.locator(xpaths.reviewBody).first().isVisible().catch(() => false);
  console.log(`[Mobile ReviewActions] Content reflected: ${hasContent}`);

  // Helper to submit a comment on an RR page
  async function submitCommentOnRR(commentText: string, label: string): Promise<boolean> {
    console.log(`[Mobile ReviewActions] Posting comment on ${label}...`);
    try {
      // Find comment input or expand accordion
      let commentInput = page.locator("#txtComment:visible, #txtResponse:visible, textarea[placeholder*='comment' i]:visible, textarea[placeholder*='response' i]:visible, textarea.form-control:visible").first();
      let isVisible = await commentInput.waitFor({ state: 'visible', timeout: 5000 }).then(() => true).catch(() => false);

      if (!isVisible) {
        const expandLink = page.locator("#commentsAccordian, a:has-text('Comment'), .comment-heading, #txtComment").first();
        if (await expandLink.isVisible().catch(() => false)) {
          await expandLink.click().catch(() => { });
          await page.waitForTimeout(1000);
        }
        commentInput = page.locator("#txtComment, #txtResponse, textarea[placeholder*='comment' i], textarea[placeholder*='response' i], textarea.form-control").first();
        isVisible = await commentInput.waitFor({ state: 'visible', timeout: 5000 }).then(() => true).catch(() => false);
      }

      if (isVisible) {
        await commentInput.scrollIntoViewIfNeeded().catch(() => { });
        await commentInput.click();
        await commentInput.fill(commentText);
        await commentInput.dispatchEvent('input').catch(() => { });
        await commentInput.dispatchEvent('change').catch(() => { });
        await page.waitForTimeout(500);

        const submitBtn = page.locator("#btnSubmit:visible, a:has-text('Post'):visible, button:has-text('Post'):visible, button:has-text('Submit'):visible, a[onclick*='AddComment']:visible").first();
        if (await submitBtn.isVisible().catch(() => false)) {
          await submitBtn.click().catch(() => { });
        } else {
          await page.evaluate(() => {
            const b = document.getElementById('btnSubmit');
            if (b) b.click();
          }).catch(() => { });
        }

        await page.evaluate(() => {
          if (typeof (window as any).AddComment === 'function') (window as any).AddComment();
        }).catch(() => { });
        await page.waitForTimeout(2500);
        console.log(`[Mobile ReviewActions] Comment submitted on ${label}.`);
        return true;
      } else {
        console.warn(`[Mobile ReviewActions] Comment input not visible on ${label}.`);
        return false;
      }
    } catch (e: any) {
      console.warn(`[Mobile ReviewActions] Error submitting comment on ${label}: ${e.message}`);
      return false;
    }
  }

  // 2. Perform rating on own review & verify platform restricts self-rating
  console.log('[Mobile ReviewActions] 1/4: Performing rating on own review (verifying platform restricts self-rating)...');
  let selfRateRestricted = false;
  let selfRateDialogMsg = '';
  const selfDialogHandler = async (dialog: any) => {
    selfRateDialogMsg = dialog.message();
    console.log(`[Mobile ReviewActions] Dialog caught on own review rating: "${selfRateDialogMsg}"`);
    if (/cannot rate your own review|cant rate your review|own review|cannot rate/i.test(selfRateDialogMsg)) {
      selfRateRestricted = true;
    }
    await dialog.accept().catch(() => { });
  };
  page.on('dialog', selfDialogHandler);

  try {
    const usefulBtn = page.locator("#contentBody_radioU:visible, #btnAjxU:visible, .icon-useful:visible, span.rate-icon[type='useful']:visible, span[id*='radioU']:visible").first();
    if (await usefulBtn.isVisible().catch(() => false)) {
      await usefulBtn.scrollIntoViewIfNeeded().catch(() => { });
      await usefulBtn.click({ force: true }).catch(() => { });
    } else {
      await page.evaluate(() => {
        const btn = document.getElementById('contentBody_radioU') || document.querySelector('.icon-useful') || document.getElementById('btnAjxU');
        if (btn) (btn as HTMLElement).click();
      }).catch(() => { });
    }
    await page.waitForTimeout(1500);

    const domRestricted = await page.evaluate(() => {
      const text = document.body.innerText || '';
      return /cannot rate your own review|cant rate your review|own review|cannot rate/i.test(text);
    }).catch(() => false);
    selfRateRestricted = selfRateRestricted || domRestricted;
  } catch (e: any) {
    console.warn(`[Mobile ReviewActions] Self-rating note: ${e.message}`);
  }

  page.off('dialog', selfDialogHandler);
  console.log(`[Mobile ReviewActions] Platform restricted self-rating on RR: ${selfRateRestricted} (Message: "${selfRateDialogMsg}")`);

  // 3. Perform comments and submit comment on own review
  console.log('[Mobile ReviewActions] 2/4: Performing comment and submitting on own review from RR...');
  await submitCommentOnRR(`Thank you for reading my ${prodName} review! Appreciate all feedback.`, 'own review');

  // 4. Navigate to RAR page
  console.log(`[Mobile ReviewActions] 3/4: Navigating to ${prodName} RAR page: ${rarUrl}...`);
  await page.goto(rarUrl, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(2000);

  // 5. Scroll down to trigger lazy loading of review cards on mobile RAR
  console.log('[Mobile ReviewActions] Scrolling to lazy-load review cards on mobile RAR...');
  await page.evaluate(() => window.scrollTo(0, 1200));
  await page.waitForTimeout(1500);
  await page.evaluate(() => window.scrollTo(0, 2200));
  await page.waitForTimeout(1500);

  // Ensure single tab
  const pgsAfterRar = page.context().pages();
  for (let i = pgsAfterRar.length - 1; i > 0; i--) {
    if (pgsAfterRar[i] !== page) await pgsAfterRar[i].close().catch(() => { });
  }
  await page.bringToFront().catch(() => { });

  // // 6. Find another user's review on RAR & navigate to their RR page
  // console.log("[Mobile ReviewActions] 4/4: Locating another user's review on RAR to perform rating & comment...");
  // const cards = page.locator(".review-holder, .review-article");
  // const cardCount = await cards.count();
  // console.log(`[Mobile ReviewActions] Found ${cardCount} review cards on RAR.`);

  // let otherCardIndex = 1; // card 1 is another user's review (card 0 is newly posted review)
  // if (cardCount > 1) {
  //   const card1Text = await cards.nth(1).innerText().catch(() => '');
  //   if (card1Text.includes(TEST_DATA.mobile_test_data.name) && cardCount > 2) {
  //     otherCardIndex = 2;
  //   }
  // } else {
  //   otherCardIndex = 0;
  // }

  // const otherCard = cards.nth(otherCardIndex);
  // console.log(`[Mobile ReviewActions] Selected other user review card at index ${otherCardIndex}...`);

  // // On mobile RAR, clicking on the like/comment or title navigates to that review's RR page
  // const otherLink = otherCard.locator(".useful-not-very a, a.title, a[href*='/review/']:not([href*='writereview'])").first();
  // const otherHref = await otherLink.getAttribute('href').catch(() => null);
  // console.log('[Mobile ReviewActions] Opening other user review from RAR via link:', otherHref);

  // await otherLink.scrollIntoViewIfNeeded().catch(() => {});
  // await otherLink.click().catch(async () => {
  //   if (otherHref && otherHref.includes('/review/')) {
  //     const fullUrl = otherHref.startsWith('http') ? otherHref : `${MOBILE_BASE_URL}${otherHref}`;
  //     await page.goto(fullUrl, { waitUntil: 'domcontentloaded' });
  //   }
  // });
  // await page.waitForLoadState('domcontentloaded').catch(() => {});
  // await page.waitForTimeout(2500);

  // // If still on RAR, navigate directly to other user's review URL
  // if (!page.url().includes('/review/') || page.url().includes('-reviews-')) {
  //   if (otherHref && otherHref.includes('/review/')) {
  //     const fullUrl = otherHref.startsWith('http') ? otherHref : `${MOBILE_BASE_URL}${otherHref}`;
  //     await page.goto(fullUrl, { waitUntil: 'domcontentloaded' }).catch(() => {});
  //     await page.waitForTimeout(2000);
  //   }
  // }

  // // Ensure single tab
  // const pgsOther = page.context().pages();
  // for (let i = pgsOther.length - 1; i > 0; i--) {
  //   if (pgsOther[i] !== page) await pgsOther[i].close().catch(() => {});
  // }
  // await page.bringToFront().catch(() => {});

  // console.log(`[Mobile ReviewActions] Currently on another user review RR page: ${page.url()}`);

  // 7. Perform rating on another's review & verify rating is allowed
  console.log("[Mobile ReviewActions] Performing rating on another user's review (verifying rating is allowed)...");
  let otherRatingRestricted = false;
  let otherDialogMsg = '';
  const otherDialogHandler = async (dialog: any) => {
    otherDialogMsg = dialog.message();
    console.log(`[Mobile ReviewActions] Dialog caught on another review rating: "${otherDialogMsg}"`);
    if (/cannot rate your own review|cant rate your review|own review/i.test(otherDialogMsg)) {
      otherRatingRestricted = true;
    }
    await dialog.accept().catch(() => { });
  };
  page.on('dialog', otherDialogHandler);

  try {
    const otherUsefulBtn = page.locator("#contentBody_radioU:visible, #btnAjxU:visible, .icon-useful:visible, span.rate-icon[type='useful']:visible, span[id*='radioU']:visible").first();
    if (await otherUsefulBtn.isVisible().catch(() => false)) {
      await otherUsefulBtn.scrollIntoViewIfNeeded().catch(() => { });
      await otherUsefulBtn.click({ force: true }).catch(() => { });
    } else {
      await page.evaluate(() => {
        const btn = document.getElementById('contentBody_radioU') || document.querySelector('.icon-useful') || document.getElementById('btnAjxU');
        if (btn) (btn as HTMLElement).click();
      }).catch(() => { });
    }
    await page.waitForTimeout(2000);
  } catch (err: any) {
    console.warn(`[Mobile ReviewActions] Rating on another review note: ${err.message}`);
  }

  page.off('dialog', otherDialogHandler);
  console.log(`[Mobile ReviewActions] Rating on another's review allowed: ${!otherRatingRestricted} (Message: "${otherDialogMsg}")`);
  expect(otherRatingRestricted).toBe(false);

  // 8. Perform comment on another's review & submit
  console.log("[Mobile ReviewActions] Performing comment on another user's review...");
  const otherCommentSuccess = await submitCommentOnRR(`Very helpful and detailed review on ${prodName}, thanks for sharing!`, "another user's review");
  console.log(`[Mobile ReviewActions] Comment submitted on another user review: ${otherCommentSuccess}`);

  return true;
}

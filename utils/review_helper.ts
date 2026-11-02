import { Page, Locator } from '@playwright/test';

/**
 * Extracts RR key (review ID) from a review URL, query param or string.
 * Example: "https://beta.mouthshut.com/review/squash-review-lnoqsloqoop" -> "lnoqsloqoop"
 * Example: "EmailReviewNew.aspx?rid=lnoqsloqoop" -> "lnoqsloqoop"
 */
export function extractRrKey(urlOrText: string): string | null {
  if (!urlOrText) return null;
  const match = urlOrText.match(/(?:review-|rid=)([a-zA-Z0-9]+)/);
  if (match) return match[1];
  const m = urlOrText.match(/['"]([a-zA-Z0-9]{8,15})['"]/);
  if (m) return m[1];
  return null;
}

/**
 * Find the review card on RAR that belongs to the registered User ID.
 * Searches both Desktop (.review-article) and Mobile (.review-holder) structures.
 */
export async function findReviewCardByUserId(
  page: Page,
  userId: string,
  maxScrolls = 4
): Promise<Locator | null> {
  const cleanId = userId.trim().toLowerCase();
  console.log(`[ReviewHelper] Searching for review card with registered User ID: "${cleanId}"...`);

  for (let scroll = 0; scroll < maxScrolls; scroll++) {
    const cards = page.locator("div.review-article, div.review-holder, div[id*='rptreviews']");
    const count = await cards.count();

    for (let i = 0; i < count; i++) {
      const card = cards.nth(i);
      const isMatch = await card.evaluate((el: HTMLElement, uid: string) => {
        const text = (el.innerText || '').toLowerCase();
        // Check text for @userId or userId
        if (text.includes(`@${uid}`) || text.includes(uid)) {
          return true;
        }
        // Check anchor tags for profile links like /userId or user=userId
        const anchors = Array.from(el.querySelectorAll('a'));
        return anchors.some(a => {
          const href = (a.getAttribute('href') || '').toLowerCase();
          return href.endsWith(`/${uid}`) || href.includes(`/${uid}/`) || href.includes(`user=${uid}`) || href.includes(`/${uid}?`);
        });
      }, cleanId).catch(() => false);

      if (isMatch) {
        console.log(`[ReviewHelper] Found matching review card for registered User ID "${cleanId}" at card index ${i}!`);
        return card;
      }
    }

    // If not found yet and not on last scroll, scroll down to lazy-load more cards
    if (scroll < maxScrolls - 1) {
      console.log(`[ReviewHelper] User review not visible yet, scrolling down (attempt ${scroll + 1}/${maxScrolls})...`);
      await page.evaluate((s) => window.scrollTo(0, (s + 1) * 1500), scroll);
      await page.waitForTimeout(2000);
    }
  }

  console.warn(`[ReviewHelper] No review card found for registered User ID "${cleanId}" after ${maxScrolls} scroll attempts.`);
  return null;
}

/**
 * Find a review card on RAR that belongs to ANOTHER user (does NOT belong to registered User ID).
 */
export async function findOtherUserReviewCard(
  page: Page,
  registeredUserId: string,
  maxScrolls = 2
): Promise<Locator | null> {
  const cleanId = registeredUserId.trim().toLowerCase();
  console.log(`[ReviewHelper] Searching for another user's review card (not "${cleanId}")...`);

  for (let scroll = 0; scroll < maxScrolls; scroll++) {
    const cards = page.locator("div.review-article, div.review-holder, div[id*='rptreviews']");
    const count = await cards.count();

    for (let i = 0; i < count; i++) {
      const card = cards.nth(i);
      const isOwn = await card.evaluate((el: HTMLElement, uid: string) => {
        const text = (el.innerText || '').toLowerCase();
        if (text.includes(`@${uid}`) || text.includes(uid)) return true;
        const anchors = Array.from(el.querySelectorAll('a'));
        return anchors.some(a => {
          const href = (a.getAttribute('href') || '').toLowerCase();
          return href.endsWith(`/${uid}`) || href.includes(`/${uid}/`) || href.includes(`user=${uid}`);
        });
      }, cleanId).catch(() => false);

      if (!isOwn) {
        // Also ensure this card has a valid review link
        const hasRevLink = await card.locator("a[href*='/review/']:not([href*='writereview'])").first().count() > 0;
        if (hasRevLink) {
          console.log(`[ReviewHelper] Found another user review card at card index ${i}.`);
          return card;
        }
      }
    }

    if (scroll < maxScrolls - 1) {
      await page.evaluate(() => window.scrollBy(0, 1000));
      await page.waitForTimeout(1500);
    }
  }

  return null;
}

/**
 * Fetches the RR key and review URL from the review card that has the registered User ID.
 * Never defaults to the first review.
 */
export async function fetchRrKeyAndUrlByUserId(
  page: Page,
  options: {
    userId: string;
    baseUrl: string;
    rarUrl?: string;
  }
): Promise<{ rrKey: string | null; reviewUrl: string | null; card: Locator | null }> {
  const { userId, baseUrl, rarUrl } = options;

  // Navigate to RAR if rarUrl provided and not already on that RAR path
  if (rarUrl && !page.url().includes(rarUrl.replace(/https?:\/\/[^\/]+/, ''))) {
    console.log(`[ReviewHelper] Navigating to RAR page: ${rarUrl}`);
    await page.goto(rarUrl, { waitUntil: 'domcontentloaded' }).catch(() => {});
    await page.waitForTimeout(2000);
  }

  // Locate the review card belonging to the registered user
  const card = await findReviewCardByUserId(page, userId);
  if (!card) {
    return { rrKey: null, reviewUrl: null, card: null };
  }

  // Extract review link from this specific card
  const revLink = card.locator("a[href*='/review/']:not([href*='writereview']):not([href*='error']):not([href*='prewrite'])").first();
  let href = await revLink.getAttribute('href').catch(() => null);

  let rrKey: string | null = null;
  let fullUrl: string | null = null;

  if (href) {
    fullUrl = href.startsWith('http') ? href : `${baseUrl}${href.startsWith('/') ? '' : '/'}${href}`;
    rrKey = extractRrKey(fullUrl);
  }

  // If href wasn't found or didn't contain key, check share button onclick inside this card
  if (!rrKey) {
    const shareBtn = card.locator("span.share-review, [id*='dvshareAll'], button.share, a[onclick*='review']").first();
    if (await shareBtn.count() > 0) {
      const oc = await shareBtn.getAttribute('onclick').catch(() => '');
      rrKey = extractRrKey(oc || '');
      if (rrKey && !fullUrl) {
        fullUrl = `${baseUrl}/review/${rrKey}`;
      }
    }
  }

  console.log(`[ReviewHelper] Extracted RR key: "${rrKey}" and URL: "${fullUrl}" for registered User ID "${userId}"`);
  return { rrKey, reviewUrl: fullUrl, card };
}

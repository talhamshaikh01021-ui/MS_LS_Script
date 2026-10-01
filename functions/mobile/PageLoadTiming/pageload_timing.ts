import { Page } from '@playwright/test';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { MOBILE_BASE_URL, TEST_DATA } from '../../../utils/config.js';
import { RegressionReporter } from '../../../utils/reporter.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const xpaths = JSON.parse(fs.readFileSync(path.resolve(__dirname, 'pageload_timing_xpath.json'), 'utf8'));

export async function mobilePageLoadTiming(page: Page): Promise<{
  rarLoadTimeMs: number;
  rrLoadTimeMs: number;
}> {
  console.log('[Mobile PageLoadTiming] Returning to mobile homepage to measure Amazon RAR & RR pageload times...');
  const reporter = RegressionReporter.getInstance();

  // 1. Return to homepage
  await page.goto(MOBILE_BASE_URL, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(1500);

  // 2. Search for amazon
  console.log('[Mobile PageLoadTiming] Searching for amazon on mobile...');
  const searchInput = page.locator(xpaths.searchInput).first();
  await searchInput.waitFor({ state: 'visible', timeout: 15000 });
  await searchInput.click();
  await searchInput.fill('');
  await searchInput.pressSequentially(TEST_DATA.review_data!.amazon.search_term, { delay: 100 });
  await page.waitForTimeout(2000);

  // 3. Click on Amazon product (avoiding Mobile Phones, selecting Amazon Online Shopping)
  console.log('[Mobile PageLoadTiming] Selecting Amazon (Online Shopping) to measure RAR pageload time...');
  const suggestions = page.locator(xpaths.amazonSuggestion || 'ul.ui-autocomplete li a, .ui-menu-item a');
  const sugCount = await suggestions.count();
  let clicked = false;
  let rarStartTime = Date.now();

  if (sugCount > 0) {
    for (let i = 0; i < sugCount; i++) {
      const sug = suggestions.nth(i);
      const text = (await sug.innerText().catch(() => '')).replace(/\s+/g, ' ');
      // Explicit requirement: do not select amazon in mobile phones, select amazon online shopping
      if (!/Mobile Phones/i.test(text) && (/Online Shopping/i.test(text) || /^Amazon/i.test(text))) {
        console.log(`[Mobile PageLoadTiming] Clicking Mobile suggestion: "${text}"`);
        rarStartTime = Date.now();
        await Promise.all([
          page.waitForLoadState('domcontentloaded'),
          sug.click()
        ]);
        clicked = true;
        break;
      }
    }
  }

  if (!clicked) {
    const amazonLink = page.locator(xpaths.amazonSearchResult)
      .filter({ hasNotText: /Mobile Phones/i })
      .first();

    if (await amazonLink.isVisible().catch(() => false)) {
      console.log('[Mobile PageLoadTiming] Clicking Amazon search result link...');
      rarStartTime = Date.now();
      await Promise.all([
        page.waitForLoadState('domcontentloaded'),
        amazonLink.click()
      ]);
    } else {
      console.log('[Mobile PageLoadTiming] Direct navigation fallback to Amazon Online Shopping RAR...');
      rarStartTime = Date.now();
      await page.goto(`${MOBILE_BASE_URL}/product-reviews/amazon-reviews-925000493`, { waitUntil: 'domcontentloaded' });
    }
  }

  // If landed on category listing (e.g. online-shopping?cid=925153...), click the Amazon product link to reach RAR
  if (page.url().includes('online-shopping') && !page.url().includes('product-reviews')) {
    console.log('[Mobile PageLoadTiming] On Online Shopping listing; clicking Amazon product link...');
    const prodLink = page.locator("a.product-name:has-text('Amazon'), a[href*='amazon-reviews']").first();
    if (await prodLink.isVisible().catch(() => false)) {
      rarStartTime = Date.now();
      await Promise.all([
        page.waitForLoadState('domcontentloaded'),
        prodLink.click()
      ]);
    }
  }

  const rarEndTime = Date.now();
  const rarLoadTimeMs = rarEndTime - rarStartTime;

  console.log(`[Mobile PageLoadTiming] Amazon RAR Page Load Time: ${rarLoadTimeMs}ms (URL: ${page.url()})`);
  reporter.recordPageLoad('Amazon RAR Page', 'Mobile', page.url(), rarLoadTimeMs);

  // 4. Click on review -> redirect to RR page, note pageload time
  console.log('[Mobile PageLoadTiming] Clicking on review to measure RR pageload time...');
  await page.waitForTimeout(2000);

  // Scroll down like a human to trigger lazy loading of review cards
  await page.evaluate(() => window.scrollTo(0, 1200));
  await page.waitForTimeout(1500);

  const reviewLink = page.locator(xpaths.reviewLinkOnRar).first();
  let rrLoadTimeMs = 0;

  if (await reviewLink.isVisible().catch(() => false)) {
    const rrStartTime = Date.now();
    await Promise.all([
      page.waitForLoadState('domcontentloaded'),
      reviewLink.click()
    ]);
    const rrEndTime = Date.now();
    rrLoadTimeMs = rrEndTime - rrStartTime;
    console.log(`[Mobile PageLoadTiming] Amazon RR Page Load Time: ${rrLoadTimeMs}ms (URL: ${page.url()})`);
    reporter.recordPageLoad('Amazon RR Page', 'Mobile', page.url(), rrLoadTimeMs);
  } else {
    console.log('[Mobile PageLoadTiming] Attempting fallback review link...');
    const fallbackLink = page.locator("//a[contains(@href,'/review/') and not(contains(@href,'writereview'))]").first();
    if (await fallbackLink.isVisible().catch(() => false)) {
      const rrStartTime = Date.now();
      await Promise.all([
        page.waitForLoadState('domcontentloaded'),
        fallbackLink.click()
      ]);
      rrLoadTimeMs = Date.now() - rrStartTime;
      reporter.recordPageLoad('Amazon RR Page', 'Mobile', page.url(), rrLoadTimeMs);
    }
  }

  return { rarLoadTimeMs, rrLoadTimeMs };
}

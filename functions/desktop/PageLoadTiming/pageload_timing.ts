import { Page } from '@playwright/test';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { DESKTOP_BASE_URL, TEST_DATA } from '../../../utils/config.js';
import { RegressionReporter } from '../../../utils/reporter.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const xpaths = JSON.parse(fs.readFileSync(path.resolve(__dirname, 'pageload_timing_xpath.json'), 'utf8'));

export async function desktopPageLoadTiming(page: Page): Promise<{
  rarLoadTimeMs: number;
  rrLoadTimeMs: number;
}> {
  console.log('[Desktop PageLoadTiming] Returning to homepage to measure Amazon RAR & RR pageload times...');
  const reporter = RegressionReporter.getInstance();

  // 1. Come back to homepage
  await page.goto(DESKTOP_BASE_URL, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(1500);

  // 2. Search for amazon
  console.log('[Desktop PageLoadTiming] Searching for amazon...');
  const searchInput = page.locator(xpaths.searchInput).first();
  await searchInput.waitFor({ state: 'visible', timeout: 15000 });
  await searchInput.click();
  await searchInput.fill('');
  await searchInput.pressSequentially(TEST_DATA.review_data!.amazon.search_term, { delay: 120 });
  await page.waitForTimeout(2000);

  // 3. Click on Amazon product (avoiding Mobile Phones, selecting Amazon Online Shopping) -> redirect to RAR, note pageload time
  console.log('[Desktop PageLoadTiming] Selecting Amazon (Online Shopping) to measure RAR pageload time...');
  const suggestions = page.locator(xpaths.amazonSuggestion || 'li.uib-typeahead-match a, ul.ui-autocomplete li a, .dropdown-menu li a');
  const sugCount = await suggestions.count();
  let clicked = false;
  let rarStartTime = Date.now();

  if (sugCount > 0) {
    for (let i = 0; i < sugCount; i++) {
      const sug = suggestions.nth(i);
      const text = (await sug.innerText().catch(() => '')).replace(/\s+/g, ' ');
      // Explicit requirement: do not select amazon in mobile phones, select amazon
      if (!/Mobile Phones/i.test(text) && (/Online Shopping/i.test(text) || /^Amazon/i.test(text))) {
        console.log(`[Desktop PageLoadTiming] Clicking Amazon suggestion: "${text}"`);
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
      console.log('[Desktop PageLoadTiming] Clicking Amazon search result link...');
      rarStartTime = Date.now();
      await Promise.all([
        page.waitForLoadState('domcontentloaded'),
        amazonLink.click()
      ]);
    } else {
      console.log('[Desktop PageLoadTiming] Direct navigation fallback to Amazon Online Shopping RAR...');
      rarStartTime = Date.now();
      await page.goto(`${DESKTOP_BASE_URL}/online-shopping-proid-925153?cid=925153&srchcatid=925000493`, { waitUntil: 'domcontentloaded' });
    }
  }

  const rarEndTime = Date.now();
  const rarLoadTimeMs = rarEndTime - rarStartTime;

  console.log(`[Desktop PageLoadTiming] Amazon RAR Page Load Time: ${rarLoadTimeMs}ms (URL: ${page.url()})`);
  reporter.recordPageLoad('Amazon RAR Page', 'Desktop', page.url(), rarLoadTimeMs);

  // 4. Click on review -> redirect to RR page, note pageload time
  console.log('[Desktop PageLoadTiming] Clicking on review to measure RR pageload time...');
  const reviewLink = page.locator(xpaths.reviewLinkOnRar).first();
  await reviewLink.waitFor({ state: 'visible', timeout: 15000 });

  const rrStartTime = Date.now();
  await Promise.all([
    page.waitForLoadState('domcontentloaded'),
    reviewLink.click()
  ]);
  const rrEndTime = Date.now();
  const rrLoadTimeMs = rrEndTime - rrStartTime;

  console.log(`[Desktop PageLoadTiming] Amazon RR Page Load Time: ${rrLoadTimeMs}ms (URL: ${page.url()})`);
  reporter.recordPageLoad('Amazon RR Page', 'Desktop', page.url(), rrLoadTimeMs);

  return { rarLoadTimeMs, rrLoadTimeMs };
}

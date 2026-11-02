import { Page } from '@playwright/test';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { DESKTOP_BASE_URL, TEST_DATA } from '../../../utils/config.js';
import { RegressionReporter } from '../../../utils/reporter.js';
import { measureFullPageLoad } from '../../../utils/pageload_helper.js';

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

  // 3. Select Amazon Online Shopping to measure RAR pageload time
  console.log('[Desktop PageLoadTiming] Selecting Amazon (Online Shopping) to measure RAR pageload time...');
  const suggestions = page.locator(xpaths.amazonSuggestion || 'li.uib-typeahead-match a, ul.ui-autocomplete li a, .dropdown-menu li a');
  const sugCount = await suggestions.count();
  let rarTargetUrl = `${DESKTOP_BASE_URL}/product-reviews/amazon-reviews-925000493`;
  let found = false;

  if (sugCount > 0) {
    for (let i = 0; i < sugCount; i++) {
      const sug = suggestions.nth(i);
      const text = (await sug.innerText().catch(() => '')).replace(/\s+/g, ' ');
      // Explicit requirement: do not select amazon in mobile phones, select amazon online shopping
      if (!/Mobile Phones/i.test(text) && (/Online Shopping/i.test(text) || /^Amazon/i.test(text))) {
        console.log(`[Desktop PageLoadTiming] Found Amazon suggestion: "${text}"`);
        const href = await sug.getAttribute('href').catch(() => null);
        if (href) {
          rarTargetUrl = href.startsWith('http') ? href : `${DESKTOP_BASE_URL}${href}`;
        }
        found = true;
        break;
      }
    }
  }

  if (!found) {
    const amazonLink = page.locator(xpaths.amazonSearchResult)
      .filter({ hasNotText: /Mobile Phones/i })
      .first();

    if (await amazonLink.isVisible().catch(() => false)) {
      console.log('[Desktop PageLoadTiming] Found Amazon search result link...');
      const href = await amazonLink.getAttribute('href').catch(() => null);
      if (href) {
        rarTargetUrl = href.startsWith('http') ? href : `${DESKTOP_BASE_URL}${href}`;
      }
    }
  }

  // Navigate to Amazon RAR and measure full page load time (document, stylesheets, scripts, and all images)
  console.log(`[Desktop PageLoadTiming] Measuring Amazon RAR Page Load Time: ${rarTargetUrl}`);
  const rarLoadTimeMs = await measureFullPageLoad(page, rarTargetUrl);
  console.log(`[Desktop PageLoadTiming] Amazon RAR Page Load Time: ${rarLoadTimeMs}ms (${(rarLoadTimeMs / 1000).toFixed(2)}s)`);
  reporter.recordPageLoad('Amazon RAR Page', 'Desktop', page.url(), rarLoadTimeMs);

  // 4. Locate review on RAR -> navigate to RR page and measure full page load time
  console.log('[Desktop PageLoadTiming] Locating review link on RAR to measure RR pageload time...');
  await page.waitForTimeout(1000);
  const reviewLink = page.locator(xpaths.reviewLinkOnRar).first();
  await reviewLink.waitFor({ state: 'visible', timeout: 15000 });
  const reviewHref = await reviewLink.getAttribute('href');
  if (!reviewHref) {
    throw new Error('Could not find review link on Amazon RAR page');
  }

  const rrTargetUrl = reviewHref.startsWith('http') ? reviewHref : `${DESKTOP_BASE_URL}${reviewHref}`;
  console.log(`[Desktop PageLoadTiming] Measuring Amazon RR (Read Review) Page Load Time: ${rrTargetUrl}`);
  const rrLoadTimeMs = await measureFullPageLoad(page, rrTargetUrl);
  console.log(`[Desktop PageLoadTiming] Amazon RR Page Load Time: ${rrLoadTimeMs}ms (${(rrLoadTimeMs / 1000).toFixed(2)}s)`);
  reporter.recordPageLoad('Amazon RR Page', 'Desktop', page.url(), rrLoadTimeMs);

  return { rarLoadTimeMs, rrLoadTimeMs };
}

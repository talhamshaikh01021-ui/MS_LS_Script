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
  await searchInput.fill(TEST_DATA.review_data!.amazon.search_term);
  await page.waitForTimeout(1500);
  await page.keyboard.press('Enter');
  await page.waitForTimeout(3000);

  // 3. Click on Amazon product -> redirect to RAR, note pageload time
  console.log('[Mobile PageLoadTiming] Clicking on Amazon listing result to measure RAR pageload time...');
  const amazonLink = page.locator(xpaths.amazonSearchResult).first();
  await amazonLink.waitFor({ state: 'visible', timeout: 15000 });

  const rarStartTime = Date.now();
  await Promise.all([
    page.waitForLoadState('domcontentloaded'),
    amazonLink.click()
  ]);
  const rarEndTime = Date.now();
  const rarLoadTimeMs = rarEndTime - rarStartTime;

  console.log(`[Mobile PageLoadTiming] Amazon RAR Page Load Time: ${rarLoadTimeMs}ms (URL: ${page.url()})`);
  reporter.recordPageLoad('Amazon RAR Page', 'Mobile', page.url(), rarLoadTimeMs);

  // 4. Click on review -> redirect to RR page, note pageload time
  console.log('[Mobile PageLoadTiming] Clicking on review to measure RR pageload time...');
  const reviewLink = page.locator(xpaths.reviewLinkOnRar).first();
  await reviewLink.waitFor({ state: 'visible', timeout: 15000 });

  const rrStartTime = Date.now();
  await Promise.all([
    page.waitForLoadState('domcontentloaded'),
    reviewLink.click()
  ]);
  const rrEndTime = Date.now();
  const rrLoadTimeMs = rrEndTime - rrStartTime;

  console.log(`[Mobile PageLoadTiming] Amazon RR Page Load Time: ${rrLoadTimeMs}ms (URL: ${page.url()})`);
  reporter.recordPageLoad('Amazon RR Page', 'Mobile', page.url(), rrLoadTimeMs);

  return { rarLoadTimeMs, rrLoadTimeMs };
}

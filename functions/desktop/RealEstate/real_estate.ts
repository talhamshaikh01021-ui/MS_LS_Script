import { Page } from '@playwright/test';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { DESKTOP_BASE_URL } from '../../../utils/config.js';
import { RegressionReporter } from '../../../utils/reporter.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const xpaths = JSON.parse(fs.readFileSync(path.resolve(__dirname, 'real_estate_xpath.json'), 'utf8'));

export interface RealEstateTimings {
  homeLoadTimeMs: number;
  builderLoadTimeMs: number;
  projectLoadTimeMs: number;
}

export async function desktopRealEstate(page: Page): Promise<RealEstateTimings> {
  console.log('[Desktop RealEstate] Starting Real Estate listing, filter & page load timing activities...');
  const reporter = RegressionReporter.getInstance();

  // 1. Measure and record page load time of Real Estate Home
  console.log('[Desktop RealEstate] Navigating to Real Estate Home to measure page load time...');
  const homeStartTime = Date.now();
  await page.goto(`${DESKTOP_BASE_URL}/realestate`, { waitUntil: 'domcontentloaded', timeout: 35000 }).catch(async (e) => {
    console.warn('[Desktop RealEstate] Realestate navigation warning, retrying once...', e.message);
    await page.goto(`${DESKTOP_BASE_URL}/realestate`, { waitUntil: 'domcontentloaded', timeout: 35000 }).catch(() => {});
  });
  const homeLoadTimeMs = Date.now() - homeStartTime;
  console.log(`[Desktop RealEstate] Real Estate Home Page Load Time: ${homeLoadTimeMs}ms (URL: ${page.url()})`);
  reporter.recordPageLoad('Real Estate Home Page', 'Desktop', page.url(), homeLoadTimeMs);
  await page.waitForTimeout(1500);

  // 2. Measure and record page load time of Builders & Developers
  console.log('[Desktop RealEstate] Navigating to Builders & Developers to measure page load time...');
  const builderStartTime = Date.now();
  try {
    await page.goto(`${DESKTOP_BASE_URL}/builders-and-developers`, { waitUntil: 'domcontentloaded', timeout: 35000 });
  } catch (err: any) {
    console.warn('[Desktop RealEstate] Direct navigation to /builders-and-developers timed out or failed:', err?.message);
  }
  const builderLoadTimeMs = Date.now() - builderStartTime;
  console.log(`[Desktop RealEstate] Real Estate Builder Page Load Time: ${builderLoadTimeMs}ms (URL: ${page.url()})`);
  reporter.recordPageLoad('Real Estate Builder Page', 'Desktop', page.url(), builderLoadTimeMs);
  await page.waitForTimeout(1500);

  // 3. Perform filter activities on current Builders page (Sort & City)
  console.log('[Desktop RealEstate] Performing filter activities (Sort & City)...');
  const sortSelect = page.locator(xpaths.sortFilterSelect).first();
  if (await sortSelect.isVisible().catch(() => false)) {
    await sortSelect.selectOption({ label: 'Product Rating' }).catch(() => sortSelect.selectOption({ index: 1 }).catch(() => {}));
    await page.waitForTimeout(1500);
    console.log('[Desktop RealEstate] Filtered by Product Rating.');
  }

  const citySelect = page.locator(xpaths.cityFilterSelect).first();
  if (await citySelect.isVisible().catch(() => false)) {
    await citySelect.selectOption({ label: 'Ahmedabad' }).catch(() => citySelect.selectOption({ index: 2 }).catch(() => {}));
    await page.waitForTimeout(1500);
    console.log('[Desktop RealEstate] Filtered by City.');
  }

  // 4. Open top developers / top builders link in a new tab & perform filter activities
  console.log('[Desktop RealEstate] Opening top builders/developers in a new tab...');
  const context = page.context();
  const newPage = await context.newPage();

  try {
    const targetUrl = `${DESKTOP_BASE_URL}/builders-and-developers/mumbai`;
    console.log(`[Desktop RealEstate] [New Tab] Navigating to top developers in Mumbai: ${targetUrl}`);
    await newPage.goto(targetUrl, { waitUntil: 'domcontentloaded', timeout: 35000 }).catch((e) => {
      console.warn('[Desktop RealEstate] [New Tab] Navigation warning:', e.message);
    });
    await newPage.waitForTimeout(1500);

    const newTabSort = newPage.locator(xpaths.sortFilterSelect).first();
    if (await newTabSort.isVisible().catch(() => false)) {
      await newTabSort.selectOption({ label: 'Most Reviewed' }).catch(() => newTabSort.selectOption({ index: 2 }).catch(() => {}));
      await newPage.waitForTimeout(1500);
      console.log('[Desktop RealEstate] [New Tab] Filtered by Most Reviewed in Mumbai.');
    }

    const newTabCity = newPage.locator(xpaths.cityFilterSelect).first();
    if (await newTabCity.isVisible().catch(() => false)) {
      await newTabCity.selectOption({ label: 'Pune' }).catch(() => newTabCity.selectOption({ index: 3 }).catch(() => {}));
      await newPage.waitForTimeout(1500);
      console.log('[Desktop RealEstate] [New Tab] Switched city to Pune in new tab.');
    }
  } finally {
    console.log('[Desktop RealEstate] Closing new tab and returning to primary page...');
    await newPage.close().catch(() => {});
  }

  await page.bringToFront();

  // 5. Measure and record page load time of Real Estate Projects
  console.log('[Desktop RealEstate] Navigating to Projects to measure page load time...');
  const projectStartTime = Date.now();
  try {
    await page.goto(`${DESKTOP_BASE_URL}/projects`, { waitUntil: 'domcontentloaded', timeout: 35000 });
  } catch (err: any) {
    console.warn('[Desktop RealEstate] Projects navigation timeout or error:', err?.message);
  }
  const projectLoadTimeMs = Date.now() - projectStartTime;
  console.log(`[Desktop RealEstate] Real Estate Project Page Load Time: ${projectLoadTimeMs}ms (URL: ${page.url()})`);
  reporter.recordPageLoad('Real Estate Project Page', 'Desktop', page.url(), projectLoadTimeMs);
  await page.waitForTimeout(1500);

  return { homeLoadTimeMs, builderLoadTimeMs, projectLoadTimeMs };
}

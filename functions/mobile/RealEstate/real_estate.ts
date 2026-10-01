import { Page } from '@playwright/test';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { MOBILE_BASE_URL } from '../../../utils/config.js';
import { RegressionReporter } from '../../../utils/reporter.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const xpaths = JSON.parse(fs.readFileSync(path.resolve(__dirname, 'real_estate_xpath.json'), 'utf8'));

export interface RealEstateTimings {
  homeLoadTimeMs: number;
  builderLoadTimeMs: number;
  projectLoadTimeMs: number;
}

export async function mobileRealEstate(page: Page): Promise<RealEstateTimings> {
  console.log('[Mobile RealEstate] Starting mobile Real Estate listing, filter & page load timing activities...');
  const reporter = RegressionReporter.getInstance();

  // 1. Measure and record page load time of Real Estate Home
  console.log('[Mobile RealEstate] Navigating to Real Estate Home to measure page load time...');
  const homeStartTime = Date.now();
  await page.goto(`${MOBILE_BASE_URL}/realestate`, { waitUntil: 'domcontentloaded' });
  const homeLoadTimeMs = Date.now() - homeStartTime;
  console.log(`[Mobile RealEstate] Real Estate Home Page Load Time: ${homeLoadTimeMs}ms (URL: ${page.url()})`);
  reporter.recordPageLoad('Real Estate Home Page', 'Mobile', page.url(), homeLoadTimeMs);
  await page.waitForTimeout(1500);

  // 2. Measure and record page load time of Builders & Developers
  console.log('[Mobile RealEstate] Navigating to Builders & Developers to measure page load time...');
  const builderStartTime = Date.now();
  await page.goto(`${MOBILE_BASE_URL}/builders-and-developers`, { waitUntil: 'domcontentloaded' });
  const builderLoadTimeMs = Date.now() - builderStartTime;
  console.log(`[Mobile RealEstate] Real Estate Builder Page Load Time: ${builderLoadTimeMs}ms (URL: ${page.url()})`);
  reporter.recordPageLoad('Real Estate Builder Page', 'Mobile', page.url(), builderLoadTimeMs);
  await page.waitForTimeout(1500);

  // 3. Perform filter activities like a human on mobile
  console.log('[Mobile RealEstate] Performing mobile filter activities...');

  // 3a. Sort filter: Open sort modal and select "Product Rating"
  try {
    const sortBtn = page.locator(xpaths.mobileSortButton).first();
    if (await sortBtn.isVisible().catch(() => false)) {
      console.log('[Mobile RealEstate] Opening Sort modal...');
      await sortBtn.click();
      await page.waitForTimeout(800);

      const prodRatingOpt = page.locator(xpaths.sortProductRatingOption).first();
      if (await prodRatingOpt.isVisible().catch(() => false)) {
        console.log('[Mobile RealEstate] Selecting "Product Rating" sort...');
        await prodRatingOpt.click();
        await page.waitForTimeout(2000);
      }
    } else {
      // Fallback for select dropdown if present
      const sortSelect = page.locator(xpaths.sortFilterSelect).first();
      if (await sortSelect.isVisible().catch(() => false)) {
        await sortSelect.selectOption({ label: 'Product Rating' }).catch(() => sortSelect.selectOption({ index: 1 }));
        await page.waitForTimeout(2000);
      }
    }
  } catch (err: any) {
    console.warn('[Mobile RealEstate] Sort filter note:', err.message);
  }

  // 3b. City filter: Open Filters drawer, select city, click Apply
  try {
    const filterBtn = page.locator(xpaths.mobileFiltersButton).first();
    if (await filterBtn.isVisible().catch(() => false)) {
      console.log('[Mobile RealEstate] Opening Filters drawer...');
      await filterBtn.click();
      await page.waitForTimeout(800);

      const cityOpt = page.locator(xpaths.cityOptionAhmedabad + ', ' + xpaths.cityOptionMumbai).first();
      if (await cityOpt.isVisible().catch(() => false)) {
        console.log('[Mobile RealEstate] Selecting city filter...');
        await cityOpt.click();
        await page.waitForTimeout(500);
      }

      const applyBtn = page.locator(xpaths.applyFilterButton).first();
      if (await applyBtn.isVisible().catch(() => false)) {
        console.log('[Mobile RealEstate] Clicking Apply filter button...');
        await applyBtn.click();
        await page.waitForTimeout(2000);
      }
    } else {
      // Fallback for select dropdown if present
      const citySelect = page.locator(xpaths.cityFilterSelect).first();
      if (await citySelect.isVisible().catch(() => false)) {
        await citySelect.selectOption({ label: 'Mumbai' }).catch(() => citySelect.selectOption({ index: 1 }));
        await page.waitForTimeout(2000);
      }
    }
  } catch (err: any) {
    console.warn('[Mobile RealEstate] City filter note:', err.message);
  }

  // 4. Open top developers / builders link in a new tab & perform filter activities
  console.log('[Mobile RealEstate] Opening top builders in new tab...');
  const context = page.context();
  const newPage = await context.newPage();

  try {
    const targetUrl = `${MOBILE_BASE_URL}/builders-and-developers/hyderabad`;
    console.log(`[Mobile RealEstate] [New Tab] Navigating to: ${targetUrl}`);
    await newPage.goto(targetUrl, { waitUntil: 'domcontentloaded' });
    await newPage.waitForTimeout(2000);

    const newTabSortBtn = newPage.locator(xpaths.mobileSortButton).first();
    if (await newTabSortBtn.isVisible().catch(() => false)) {
      await newTabSortBtn.click();
      await newPage.waitForTimeout(800);
      const mostRevOpt = newPage.locator(xpaths.sortMostReviewedOption).first();
      if (await mostRevOpt.isVisible().catch(() => false)) {
        await mostRevOpt.click();
        await newPage.waitForTimeout(2000);
        console.log('[Mobile RealEstate] [New Tab] Filtered by Most Reviewed in Hyderabad.');
      }
    } else {
      const newTabSort = newPage.locator(xpaths.sortFilterSelect).first();
      if (await newTabSort.isVisible().catch(() => false)) {
        await newTabSort.selectOption({ label: 'Most Reviewed' }).catch(() => newTabSort.selectOption({ index: 2 }));
        await newPage.waitForTimeout(2000);
      }
    }
  } catch (err: any) {
    console.warn('[Mobile RealEstate] [New Tab] Filter note:', err.message);
  } finally {
    console.log('[Mobile RealEstate] Closing new tab...');
    await newPage.close();
  }

  await page.bringToFront();

  // 5. Measure and record page load time of Real Estate Projects
  console.log('[Mobile RealEstate] Navigating to Projects to measure page load time...');
  const projectStartTime = Date.now();
  await page.goto(`${MOBILE_BASE_URL}/projects`, { waitUntil: 'domcontentloaded' });
  const projectLoadTimeMs = Date.now() - projectStartTime;
  console.log(`[Mobile RealEstate] Real Estate Project Page Load Time: ${projectLoadTimeMs}ms (URL: ${page.url()})`);
  reporter.recordPageLoad('Real Estate Project Page', 'Mobile', page.url(), projectLoadTimeMs);
  await page.waitForTimeout(1500);

  return { homeLoadTimeMs, builderLoadTimeMs, projectLoadTimeMs };
}

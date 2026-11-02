import { Page } from '@playwright/test';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { MOBILE_BASE_URL } from '../../../utils/config.js';
import { RegressionReporter } from '../../../utils/reporter.js';
import { measureFullPageLoad } from '../../../utils/pageload_helper.js';

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

  // 1. Measure and record full page load time of Real Estate Home (document, scripts, stylesheets, and images)
  console.log('[Mobile RealEstate] Navigating to Real Estate Home to measure full page load time...');
  const homeLoadTimeMs = await measureFullPageLoad(page, `${MOBILE_BASE_URL}/realestate`);
  console.log(`[Mobile RealEstate] Real Estate Home Page Load Time: ${homeLoadTimeMs}ms (${(homeLoadTimeMs / 1000).toFixed(2)}s)`);
  reporter.recordPageLoad('Real Estate Home Page', 'Mobile', page.url(), homeLoadTimeMs);
  await page.waitForTimeout(1500);

  // 2. Measure and record full page load time of Builders & Developers
  console.log('[Mobile RealEstate] Navigating to Builders & Developers to measure full page load time...');
  const builderLoadTimeMs = await measureFullPageLoad(page, `${MOBILE_BASE_URL}/builders-and-developers`);
  console.log(`[Mobile RealEstate] Real Estate Builder Page Load Time: ${builderLoadTimeMs}ms (${(builderLoadTimeMs / 1000).toFixed(2)}s)`);
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
    const filterBtn = page.locator(xpaths.mobileFilterButton).first();
    if (await filterBtn.isVisible().catch(() => false)) {
      console.log('[Mobile RealEstate] Opening mobile Filters drawer...');
      await filterBtn.click();
      await page.waitForTimeout(1000);

      const cityHeader = page.locator(xpaths.filterCityTab).first();
      if (await cityHeader.isVisible().catch(() => false)) {
        await cityHeader.click();
        await page.waitForTimeout(600);
      }

      const cityOpt = page.locator(xpaths.filterCityOption).first();
      if (await cityOpt.isVisible().catch(() => false)) {
        console.log('[Mobile RealEstate] Selecting City in filters...');
        await cityOpt.click();
        await page.waitForTimeout(600);
      }

      const applyBtn = page.locator(xpaths.filterApplyButton).first();
      if (await applyBtn.isVisible().catch(() => false)) {
        console.log('[Mobile RealEstate] Applying filters...');
        await applyBtn.click();
        await page.waitForTimeout(2000);
      }
    } else {
      const citySelect = page.locator(xpaths.cityFilterSelect).first();
      if (await citySelect.isVisible().catch(() => false)) {
        await citySelect.selectOption({ label: 'Ahmedabad' }).catch(() => citySelect.selectOption({ index: 2 }));
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

  // 5. Measure and record full page load time of Real Estate Projects
  console.log('[Mobile RealEstate] Navigating to Projects to measure full page load time...');
  const projectLoadTimeMs = await measureFullPageLoad(page, `${MOBILE_BASE_URL}/projects`);
  console.log(`[Mobile RealEstate] Real Estate Project Page Load Time: ${projectLoadTimeMs}ms (${(projectLoadTimeMs / 1000).toFixed(2)}s)`);
  reporter.recordPageLoad('Real Estate Project Page', 'Mobile', page.url(), projectLoadTimeMs);
  await page.waitForTimeout(1500);

  return { homeLoadTimeMs, builderLoadTimeMs, projectLoadTimeMs };
}

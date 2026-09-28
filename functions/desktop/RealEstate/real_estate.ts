import { Page } from '@playwright/test';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { DESKTOP_BASE_URL } from '../../../utils/config.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const xpaths = JSON.parse(fs.readFileSync(path.resolve(__dirname, 'real_estate_xpath.json'), 'utf8'));

export async function desktopRealEstate(page: Page): Promise<boolean> {
  console.log('[Desktop RealEstate] Starting Real Estate listing and filter activities...');

  // 1. Go to homepage
  await page.goto(DESKTOP_BASE_URL, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(1500);

  // 2. Hover on Browse Categories / listing
  console.log('[Desktop RealEstate] Hovering on Browse Categories...');
  const browseBtn = page.locator(xpaths.browseCategoriesButton).first();
  if (await browseBtn.isVisible().catch(() => false)) {
    await browseBtn.hover();
    await page.waitForTimeout(1000);
  }

  // 3. Click on Real Estate
  console.log('[Desktop RealEstate] Clicking on Real Estate...');
  const realEstateLink = page.locator(xpaths.realEstateCategoryLink).first();
  if (await realEstateLink.isVisible().catch(() => false)) {
    await realEstateLink.click();
    await page.waitForTimeout(3000);
  } else {
    // Direct navigation fallback
    await page.goto(`${DESKTOP_BASE_URL}/realestate`, { waitUntil: 'domcontentloaded' });
  }

  console.log('[Desktop RealEstate] Reached Real Estate page:', page.url());

  // Navigate to Builders & Developers listing
  const buildersLink = page.locator(xpaths.buildersDevelopersLink).first();
  if (await buildersLink.isVisible().catch(() => false)) {
    await buildersLink.click();
    await page.waitForTimeout(3000);
  } else {
    await page.goto(`${DESKTOP_BASE_URL}/builders-and-developers`, { waitUntil: 'domcontentloaded' });
  }
  console.log('[Desktop RealEstate] On Builders & Developers page:', page.url());

  // 4. Perform filter activities on current page
  console.log('[Desktop RealEstate] Performing filter activities (Sort & City)...');
  const sortSelect = page.locator(xpaths.sortFilterSelect).first();
  if (await sortSelect.isVisible().catch(() => false)) {
    await sortSelect.selectOption({ label: 'Product Rating' }).catch(() => sortSelect.selectOption({ index: 1 }));
    await page.waitForTimeout(2500);
    console.log('[Desktop RealEstate] Filtered by Product Rating.');
  }

  const citySelect = page.locator(xpaths.cityFilterSelect).first();
  if (await citySelect.isVisible().catch(() => false)) {
    await citySelect.selectOption({ label: 'Ahmedabad' }).catch(() => citySelect.selectOption({ index: 2 }));
    await page.waitForTimeout(2500);
    console.log('[Desktop RealEstate] Filtered by City.');
  }

  // 5. Open top developers / top builders link in a new tab & perform filter activities
  console.log('[Desktop RealEstate] Opening top builders/developers in a new tab...');
  const context = page.context();
  const newPage = await context.newPage();

  try {
    const targetUrl = `${DESKTOP_BASE_URL}/builders-and-developers/mumbai`;
    console.log(`[Desktop RealEstate] [New Tab] Navigating to top developers in Mumbai: ${targetUrl}`);
    await newPage.goto(targetUrl, { waitUntil: 'domcontentloaded' });
    await newPage.waitForTimeout(2000);

    // Perform filter activity in the new tab
    const newTabSort = newPage.locator(xpaths.sortFilterSelect).first();
    if (await newTabSort.isVisible().catch(() => false)) {
      await newTabSort.selectOption({ label: 'Most Reviewed' }).catch(() => newTabSort.selectOption({ index: 2 }));
      await newPage.waitForTimeout(2500);
      console.log('[Desktop RealEstate] [New Tab] Filtered by Most Reviewed in Mumbai.');
    }

    // Switch city filter in new tab
    const newTabCity = newPage.locator(xpaths.cityFilterSelect).first();
    if (await newTabCity.isVisible().catch(() => false)) {
      await newTabCity.selectOption({ label: 'Pune' }).catch(() => newTabCity.selectOption({ index: 3 }));
      await newPage.waitForTimeout(2500);
      console.log('[Desktop RealEstate] [New Tab] Switched city to Pune in new tab.');
    }
  } finally {
    // Close new tab and return
    console.log('[Desktop RealEstate] Closing new tab and returning to primary page...');
    await newPage.close();
  }

  await page.bringToFront();
  return true;
}

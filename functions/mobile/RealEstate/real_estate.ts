import { Page } from '@playwright/test';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { MOBILE_BASE_URL } from '../../../utils/config.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const xpaths = JSON.parse(fs.readFileSync(path.resolve(__dirname, 'real_estate_xpath.json'), 'utf8'));

export async function mobileRealEstate(page: Page): Promise<boolean> {
  console.log('[Mobile RealEstate] Starting mobile Real Estate listing and filter activities...');

  // 1. Navigate to Real Estate / Builders & Developers on mobile
  await page.goto(`${MOBILE_BASE_URL}/builders-and-developers`, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(2000);
  console.log('[Mobile RealEstate] On Builders & Developers page:', page.url());

  // 2. Perform filter activities
  console.log('[Mobile RealEstate] Performing filter activities...');
  const sortSelect = page.locator(xpaths.sortFilterSelect).first();
  if (await sortSelect.isVisible().catch(() => false)) {
    await sortSelect.selectOption({ label: 'Product Rating' }).catch(() => sortSelect.selectOption({ index: 1 }));
    await page.waitForTimeout(2000);
    console.log('[Mobile RealEstate] Filtered by Product Rating.');
  }

  const citySelect = page.locator(xpaths.cityFilterSelect).first();
  if (await citySelect.isVisible().catch(() => false)) {
    await citySelect.selectOption({ label: 'Mumbai' }).catch(() => citySelect.selectOption({ index: 1 }));
    await page.waitForTimeout(2000);
    console.log('[Mobile RealEstate] Filtered by City.');
  }

  // 3. Open top developers / builders link in a new tab & perform filter activities
  console.log('[Mobile RealEstate] Opening top builders in new tab...');
  const context = page.context();
  const newPage = await context.newPage();

  try {
    const targetUrl = `${MOBILE_BASE_URL}/builders-and-developers/hyderabad`;
    console.log(`[Mobile RealEstate] [New Tab] Navigating to: ${targetUrl}`);
    await newPage.goto(targetUrl, { waitUntil: 'domcontentloaded' });
    await newPage.waitForTimeout(2000);

    const newTabSort = newPage.locator(xpaths.sortFilterSelect).first();
    if (await newTabSort.isVisible().catch(() => false)) {
      await newTabSort.selectOption({ label: 'Most Reviewed' }).catch(() => newTabSort.selectOption({ index: 2 }));
      await newPage.waitForTimeout(2000);
      console.log('[Mobile RealEstate] [New Tab] Filtered by Most Reviewed in Hyderabad.');
    }
  } finally {
    console.log('[Mobile RealEstate] Closing new tab...');
    await newPage.close();
  }

  await page.bringToFront();
  return true;
}

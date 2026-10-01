import { Page } from '@playwright/test';

/**
 * Automatically inspects and fills any dynamic dropdowns and extra input fields
 * that appear on Mouthshut Write A Review (WAR) pages (e.g., Ayur Shampoo, corporate reviews, etc.)
 */
export async function fillWarExtraFields(page: Page, defaultNumericId: string = '925039755'): Promise<void> {
  console.log('[WAR Helper] Checking for dropdowns and extra input fields on WAR page...');

  try {
    // 1. Handle all visible dropdowns (<select>)
    const selectElements = page.locator('select:visible');
    const selCount = await selectElements.count().catch(() => 0);
    for (let i = 0; i < selCount; i++) {
      const sel = selectElements.nth(i);
      try {
        const isVisible = await sel.isVisible().catch(() => false);
        if (!isVisible) continue;

        const id = (await sel.getAttribute('id').catch(() => '')) || '';
        const selectedText = await sel.evaluate((el: HTMLSelectElement) => {
          return el.options[el.selectedIndex]?.text?.trim() || '';
        }).catch(() => '');
        const selectedVal = await sel.inputValue().catch(() => '');

        if (selectedText.toLowerCase() === 'select' || selectedVal === '0' || selectedVal === '') {
          console.log(`[WAR Helper] Dropdown #${id} is unselected. Selecting first valid option...`);
          await sel.selectOption({ index: 1 }).catch(async () => {
            await sel.evaluate((el: HTMLSelectElement) => {
              if (el.options.length > 1) {
                el.selectedIndex = 1;
                el.dispatchEvent(new Event('change', { bubbles: true }));
              }
            }).catch(() => {});
          });
          await page.waitForTimeout(300);
        }
      } catch (e: any) {
        console.warn(`[WAR Helper] Notice handling select ${i}: ${e.message}`);
      }
    }

    // 2. Handle Member Ship ID / Order ID input field (#txtorderid / [id*='txtorderid'])
    const orderInputs = page.locator("input[id*='txtorderid']:visible, input[name*='txtorderid']:visible");
    const orderCount = await orderInputs.count().catch(() => 0);
    for (let i = 0; i < orderCount; i++) {
      const inp = orderInputs.nth(i);
      try {
        const val = await inp.inputValue().catch(() => '');
        if (!val || val.trim().length === 0) {
          console.log(`[WAR Helper] Filling Member Ship ID / Order ID with "${defaultNumericId}"...`);
          await inp.fill(defaultNumericId);
          await inp.dispatchEvent('input').catch(() => {});
          await inp.dispatchEvent('change').catch(() => {});
          await page.waitForTimeout(200);
        }
      } catch (e: any) {
        console.warn(`[WAR Helper] Notice filling order input ${i}: ${e.message}`);
      }
    }

    // 3. Handle Contact / Mobile input field (#txtcontact / [id*='txtcontact'])
    const contactInputs = page.locator("input[id*='txtcontact']:visible, input[name*='txtcontact']:visible");
    const contactCount = await contactInputs.count().catch(() => 0);
    for (let i = 0; i < contactCount; i++) {
      const inp = contactInputs.nth(i);
      try {
        const val = await inp.inputValue().catch(() => '');
        if (!val || val.trim().length === 0) {
          console.log('[WAR Helper] Filling contact number with "9876543210"...');
          await inp.fill('9876543210');
          await inp.dispatchEvent('input').catch(() => {});
          await inp.dispatchEvent('change').catch(() => {});
          await page.waitForTimeout(200);
        }
      } catch (e: any) {
        console.warn(`[WAR Helper] Notice filling contact input ${i}: ${e.message}`);
      }
    }

    // 4. Handle radio options (e.g. #Radopt1 / #Radopt2)
    // Check current rating to comply with business logic: ratings < 3 require "No", >= 3 require "Yes"
    const currentRating = await page.evaluate(() => {
      const hid = (document.getElementById('hidProductRating') || document.getElementById('contentBody_hidProductRating')) as HTMLInputElement;
      return hid ? parseInt(hid.value || '0', 10) : 0;
    }).catch(() => 0);

    const radSelector = currentRating > 0 && currentRating < 3
      ? "input[id*='Radopt2']:visible, input[id*='radno']:visible"
      : "input[id*='Radopt1']:visible, input[id*='radyes']:visible";

    const targetRad = page.locator(radSelector).first();
    if (await targetRad.isVisible().catch(() => false)) {
      const isChecked = await targetRad.isChecked().catch(() => false);
      if (!isChecked) {
        console.log(`[WAR Helper] Checking recommendation radio (${radSelector}) for rating ${currentRating}...`);
        await targetRad.check({ force: true }).catch(() => {});
      }
    }

    // 5. Hide warning elements if they were visible
    await page.evaluate(() => {
      const errDrop = document.getElementById('add_error_drop');
      if (errDrop) errDrop.style.display = 'none';
      const errTxt = document.getElementById('add_error_txt');
      if (errTxt) errTxt.style.display = 'none';
      const errTxt1 = document.getElementById('add_error_txt1');
      if (errTxt1) errTxt1.style.display = 'none';
      const errRad = document.getElementById('add_error_rad');
      if (errRad) errRad.style.display = 'none';
    }).catch(() => {});

    await page.waitForTimeout(300);
  } catch (err: any) {
    console.warn(`[WAR Helper] General notice in fillWarExtraFields: ${err.message}`);
  }
}

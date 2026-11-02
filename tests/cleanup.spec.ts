import { test } from '@playwright/test';
import { setupContestBannerPrevention } from '../utils/contest_banner.js';
import { RegressionReporter } from '../utils/reporter.js';

test.describe('Post-Regression Cleanup Suite', () => {
  const reporter = RegressionReporter.getInstance();

  test('Delete regression test IDs via mouthshut.com/delete.aspx', async ({ page }) => {
    test.setTimeout(60000);
    const start = Date.now();
    console.log('>>> [Cleanup] Starting cleanup: hitting mouthshut.com/delete.aspx to delete regression IDs...');

    await setupContestBannerPrevention(page);

    try {
      const response = await page.goto('https://mouthshut.com/delete.aspx', {
        waitUntil: 'domcontentloaded',
        timeout: 45000,
      });

      // Allow backend processing time for ID deletion
      await page.waitForTimeout(3000);

      const status = response?.status();
      const currentUrl = page.url();
      console.log(`>>> [Cleanup] Successfully hit delete.aspx. Status: ${status}, URL: ${currentUrl}`);

      reporter.recordStep(
        'Cleanup: Delete Regression IDs',
        'General',
        'PASSED',
        Date.now() - start,
        `Hit https://mouthshut.com/delete.aspx (HTTP ${status})`
      );
    } catch (err: any) {
      console.error('>>> [Cleanup] Error while hitting mouthshut.com/delete.aspx:', err.message);
      reporter.recordStep(
        'Cleanup: Delete Regression IDs',
        'General',
        'FAILED',
        Date.now() - start,
        err.message
      );
      throw err;
    }
  });
});

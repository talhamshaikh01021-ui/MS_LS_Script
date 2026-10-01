import { test, expect } from '@playwright/test';
import { desktopShareReview } from '../functions/desktop/ShareReview/share_review.js';
import { mobileShareReview } from '../functions/mobile/ShareReview/share_review.js';
import { RegressionReporter } from '../utils/reporter.js';

test.describe('Ayur Shampoo Share Review Activity', () => {
  test.describe.configure({ mode: 'serial' });
  const reporter = RegressionReporter.getInstance();

  test('Desktop: Share Ayur Shampoo Review, Verify Email Arrival & Redirection', async ({ page }) => {
    test.setTimeout(120000);
    const start = Date.now();
    try {
      console.log('>>> [Desktop Share Review Test] Starting...');
      const res = await desktopShareReview(page, 'https://beta.mouthshut.com/review/ayur-shampoo-review-sqqsntmqoop', 'talhamshaikh0102@gmail.com');
      expect(res.success).toBe(true);
      expect(res.sharedUrl).toBeTruthy();
      expect(res.redirectedUrl).toMatch(/ayur-shampoo/i);
      reporter.recordStep(
        'Desktop Share Review Activity (Ayur Shampoo)',
        'Desktop',
        'PASSED',
        Date.now() - start,
        `Shared to talhamshaikh0102@gmail.com, verified email via IMAP, extracted URL ${res.sharedUrl}, verified redirection to ${res.redirectedUrl}`
      );
      reporter.setActivityStatus('Desktop', 12, 'Fine');
    } catch (err: any) {
      reporter.recordStep('Desktop Share Review Activity (Ayur Shampoo)', 'Desktop', 'FAILED', Date.now() - start, err.message);
      reporter.setActivityStatus('Desktop', 12, 'Failed');
      throw err;
    }
  });

  test('Mobile: Share Ayur Shampoo Review, Verify Email Arrival & Redirection', async ({ page }) => {
    test.setTimeout(120000);
    const start = Date.now();
    try {
      console.log('>>> [Mobile Share Review Test] Starting...');
      const res = await mobileShareReview(page, 'https://mbeta.mouthshut.com/review/ayur-shampoo-review-sqqsntmqoop', 'talhamshaikh0102@gmail.com');
      expect(res.success).toBe(true);
      expect(res.sharedUrl).toBeTruthy();
      expect(res.redirectedUrl).toMatch(/ayur-shampoo/i);
      reporter.recordStep(
        'Mobile Share Review Activity (Ayur Shampoo)',
        'Mobile',
        'PASSED',
        Date.now() - start,
        `Shared to talhamshaikh0102@gmail.com, verified email via IMAP, extracted URL ${res.sharedUrl}, verified mobile redirection to ${res.redirectedUrl}`
      );
      reporter.setActivityStatus('Mobile', 12, 'Fine');
    } catch (err: any) {
      reporter.recordStep('Mobile Share Review Activity (Ayur Shampoo)', 'Mobile', 'FAILED', Date.now() - start, err.message);
      reporter.setActivityStatus('Mobile', 12, 'Failed');
      throw err;
    }
  });
});

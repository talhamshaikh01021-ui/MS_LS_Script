import { test, expect } from '@playwright/test';
import { desktopRegistration } from '../functions/desktop/Registration/registration.js';
import { desktopPostReview } from '../functions/desktop/PostReview/post_review.js';
import { desktopReviewActions } from '../functions/desktop/ReviewActions/review_actions.js';
import { desktopVerifiedReview } from '../functions/desktop/VerifiedReview/verified_review.js';
import { desktopRealEstate } from '../functions/desktop/RealEstate/real_estate.js';
import { desktopPageLoadTiming } from '../functions/desktop/PageLoadTiming/pageload_timing.js';
import { RegressionReporter } from '../utils/reporter.js';

test.describe('Desktop Regression Master Suite', () => {
  test.describe.configure({ mode: 'serial' });
  const reporter = RegressionReporter.getInstance();

  test('Execute Desktop Full Regression Flow', async ({ page }) => {
    test.setTimeout(600000); // 10 minute suite timeout
    let reviewUrl = '';

    // Activity 1: Registration
    const act1Start = Date.now();
    try {
      console.log('>>> [Desktop Master] Starting Activity 1: Registration');
      await desktopRegistration(page);
      reporter.recordStep('Activity 1: Desktop Registration & Verification', 'Desktop', 'PASSED', Date.now() - act1Start, 'Completed signup, captcha OCR, OTP verification and 3 mail checks');
    } catch (err: any) {
      reporter.recordStep('Activity 1: Desktop Registration & Verification', 'Desktop', 'FAILED', Date.now() - act1Start, err.message);
      console.error('[Desktop Master] Activity 1 Failed:', err);
    }

    // Activity 2: Post Review with Video and Photo (Squash)
    const act2Start = Date.now();
    try {
      console.log('>>> [Desktop Master] Starting Activity 2: Post Review (Squash)');
      const res = await desktopPostReview(page);
      reviewUrl = res.reviewUrl;
      reporter.recordStep('Activity 2: Post Review with Photo and Video (Squash)', 'Desktop', 'PASSED', Date.now() - act2Start, `Submitted 2-star review, uploaded 2 images & YT video URL. RR URL: ${reviewUrl}`);
    } catch (err: any) {
      reporter.recordStep('Activity 2: Post Review with Photo and Video (Squash)', 'Desktop', 'FAILED', Date.now() - act2Start, err.message);
      console.error('[Desktop Master] Activity 2 Failed:', err);
    }

    // Activity 3: Post Comment on Review, Verify Reflection, Self-Rating restriction, RAR actions
    const act3Start = Date.now();
    try {
      console.log('>>> [Desktop Master] Starting Activity 3: Review Actions & RAR Verification');
      await desktopReviewActions(page, reviewUrl);
      reporter.recordStep('Activity 3: Post Comment, Self-Rating Verification & RAR Actions', 'Desktop', 'PASSED', Date.now() - act3Start, 'Verified details on RR, verified self-rating block, rated/commented on RAR & RR reviews');
    } catch (err: any) {
      reporter.recordStep('Activity 3: Post Comment, Self-Rating Verification & RAR Actions', 'Desktop', 'FAILED', Date.now() - act3Start, err.message);
      console.error('[Desktop Master] Activity 3 Failed:', err);
    }

    // Activity 4: While on RAR: Ayur Shampoo /dummytest verified review
    const act4Start = Date.now();
    try {
      console.log('>>> [Desktop Master] Starting Activity 4: Verified Review (Ayur Shampoo /dummytest)');
      await desktopVerifiedReview(page);
      reporter.recordStep('Activity 4: Ayur Shampoo Verified Review (/dummytest 4-stars)', 'Desktop', 'PASSED', Date.now() - act4Start, 'Searched ayur shampoo, added /dummytest, submitted 4-star verified review with photo/video');
    } catch (err: any) {
      reporter.recordStep('Activity 4: Ayur Shampoo Verified Review (/dummytest 4-stars)', 'Desktop', 'FAILED', Date.now() - act4Start, err.message);
      console.error('[Desktop Master] Activity 4 Failed:', err);
    }

    // Activity 5: Real Estate Product Listing Page [Brand & Builder]
    const act5Start = Date.now();
    try {
      console.log('>>> [Desktop Master] Starting Activity 5: Real Estate Listing & Filters');
      await desktopRealEstate(page);
      reporter.recordStep('Activity 5: Real Estate Listing & New Tab Filter Activities', 'Desktop', 'PASSED', Date.now() - act5Start, 'Navigated to real estate, applied city/sort filters, opened top developers in new tab and filtered');
    } catch (err: any) {
      reporter.recordStep('Activity 5: Real Estate Listing & New Tab Filter Activities', 'Desktop', 'FAILED', Date.now() - act5Start, err.message);
      console.error('[Desktop Master] Activity 5 Failed:', err);
    }

    // Activity 6: Page Load Timing Measurement (Amazon RAR & RR)
    const act6Start = Date.now();
    try {
      console.log('>>> [Desktop Master] Starting Activity 6: Page Load Timing (Amazon)');
      const timings = await desktopPageLoadTiming(page);
      reporter.recordStep('Activity 6: Page Load Timing (Amazon RAR & RR)', 'Desktop', 'PASSED', Date.now() - act6Start, `Amazon RAR: ${timings.rarLoadTimeMs}ms, Amazon RR: ${timings.rrLoadTimeMs}ms`);
    } catch (err: any) {
      reporter.recordStep('Activity 6: Page Load Timing (Amazon RAR & RR)', 'Desktop', 'FAILED', Date.now() - act6Start, err.message);
      console.error('[Desktop Master] Activity 6 Failed:', err);
    }

    console.log('[Desktop Master] All 6 desktop activities finished!');
  });
});

import { test, expect } from '@playwright/test';
import { mobileRegistration } from '../functions/mobile/Registration/registration.js';
import { mobilePostReview } from '../functions/mobile/PostReview/post_review.js';
import { mobileReviewActions } from '../functions/mobile/ReviewActions/review_actions.js';
import { mobileVerifiedReview } from '../functions/mobile/VerifiedReview/verified_review.js';
import { mobileRealEstate } from '../functions/mobile/RealEstate/real_estate.js';
import { mobilePageLoadTiming } from '../functions/mobile/PageLoadTiming/pageload_timing.js';
import { RegressionReporter } from '../utils/reporter.js';

test.describe('Mobile Regression Master Suite', () => {
  test.describe.configure({ mode: 'serial' });
  const reporter = RegressionReporter.getInstance();

  test('Execute Mobile Full Regression Flow', async ({ page }) => {
    test.setTimeout(300000); // 5 minute suite timeout
    let reviewUrl = '';

    // Activity 1: Mobile Registration
    const act1Start = Date.now();
    try {
      console.log('>>> [Mobile Master] Starting Activity 1: Registration');
      await mobileRegistration(page);
      reporter.recordStep('Activity 1: Mobile Registration & Verification', 'Mobile', 'PASSED', Date.now() - act1Start, 'Completed mobile signup, captcha OCR, email verification prompt, OTP verification and 3 mail checks');
    } catch (err: any) {
      reporter.recordStep('Activity 1: Mobile Registration & Verification', 'Mobile', 'FAILED', Date.now() - act1Start, err.message);
      console.error('[Mobile Master] Activity 1 Failed:', err);
    }

    // Activity 2: Post Review with Video and Photo (Squash)
    const act2Start = Date.now();
    try {
      console.log('>>> [Mobile Master] Starting Activity 2: Post Review (Squash)');
      const res = await mobilePostReview(page);
      reviewUrl = res.reviewUrl;
      reporter.recordStep('Activity 2: Post Review with Photo and Video (Squash)', 'Mobile', 'PASSED', Date.now() - act2Start, `Submitted 2-star review, uploaded 2 images & YT video URL. RR URL: ${reviewUrl}`);
    } catch (err: any) {
      reporter.recordStep('Activity 2: Post Review with Photo and Video (Squash)', 'Mobile', 'FAILED', Date.now() - act2Start, err.message);
      console.error('[Mobile Master] Activity 2 Failed:', err);
    }

    // Activity 3: Post Comment, Self-Rating restriction, Verify RAR redirects to RR on mobile
    const act3Start = Date.now();
    try {
      console.log('>>> [Mobile Master] Starting Activity 3: Review Actions & RAR Verification');
      await mobileReviewActions(page, reviewUrl);
      reporter.recordStep('Activity 3: Post Comment, Self-Rating & RAR to RR Redirection Verification', 'Mobile', 'PASSED', Date.now() - act3Start, 'Verified details on RR, verified self-rating restriction, verified clicking rating/comment on mobile RAR redirects to RR');
    } catch (err: any) {
      reporter.recordStep('Activity 3: Post Comment, Self-Rating & RAR to RR Redirection Verification', 'Mobile', 'FAILED', Date.now() - act3Start, err.message);
      console.error('[Mobile Master] Activity 3 Failed:', err);
    }

    // Activity 4: While on RAR: Ayur Shampoo /dummytest verified review
    const act4Start = Date.now();
    try {
      console.log('>>> [Mobile Master] Starting Activity 4: Verified Review (Ayur Shampoo /dummytest)');
      await mobileVerifiedReview(page);
      reporter.recordStep('Activity 4: Ayur Shampoo Verified Review (/dummytest 4-stars)', 'Mobile', 'PASSED', Date.now() - act4Start, 'Searched ayur shampoo, added /dummytest, submitted 4-star verified review with photo/video');
    } catch (err: any) {
      reporter.recordStep('Activity 4: Ayur Shampoo Verified Review (/dummytest 4-stars)', 'Mobile', 'FAILED', Date.now() - act4Start, err.message);
      console.error('[Mobile Master] Activity 4 Failed:', err);
    }

    // Activity 5: Real Estate Product Listing Page [Brand & Builder]
    const act5Start = Date.now();
    try {
      console.log('>>> [Mobile Master] Starting Activity 5: Real Estate Listing & Filters');
      await mobileRealEstate(page);
      reporter.recordStep('Activity 5: Real Estate Listing & New Tab Filter Activities', 'Mobile', 'PASSED', Date.now() - act5Start, 'Navigated to real estate, applied city/sort filters, opened top developers in new tab and filtered');
    } catch (err: any) {
      reporter.recordStep('Activity 5: Real Estate Listing & New Tab Filter Activities', 'Mobile', 'FAILED', Date.now() - act5Start, err.message);
      console.error('[Mobile Master] Activity 5 Failed:', err);
    }

    // Activity 6: Page Load Timing Measurement (Amazon RAR & RR)
    const act6Start = Date.now();
    try {
      console.log('>>> [Mobile Master] Starting Activity 6: Page Load Timing (Amazon)');
      const timings = await mobilePageLoadTiming(page);
      reporter.recordStep('Activity 6: Page Load Timing (Amazon RAR & RR)', 'Mobile', 'PASSED', Date.now() - act6Start, `Amazon RAR: ${timings.rarLoadTimeMs}ms, Amazon RR: ${timings.rrLoadTimeMs}ms`);
    } catch (err: any) {
      reporter.recordStep('Activity 6: Page Load Timing (Amazon RAR & RR)', 'Mobile', 'FAILED', Date.now() - act6Start, err.message);
      console.error('[Mobile Master] Activity 6 Failed:', err);
    }

    console.log('[Mobile Master] All 6 mobile activities finished!');
  });
});

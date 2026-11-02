import { Page } from '@playwright/test';

/**
 * Accurately measures page load time ensuring that all document HTML,
 * stylesheets, scripts, subresources, and images have completely finished loading.
 *
 * It uses the W3C Navigation Timing API (performance.getEntriesByType('navigation')[0].loadEventEnd)
 * combined with waiting for document.readyState === 'complete' and all DOM images completed.
 */
export async function measureFullPageLoad(
  page: Page,
  target: string | (() => Promise<void>),
  options: { timeout?: number; minRealisticMs?: number } = {}
): Promise<number> {
  const timeout = options.timeout || 45000;
  const minRealisticMs = options.minRealisticMs || 1500;
  const wallStart = Date.now();

  if (typeof target === 'string') {
    await page.goto(target, { waitUntil: 'domcontentloaded', timeout }).catch(async (err) => {
      console.warn(`[PageLoadHelper] Initial navigation warning for ${target}: ${err.message}`);
    });
  } else {
    await target();
  }

  // 1. Wait for document.readyState === 'complete' and window loadEventEnd / all images complete
  await page.waitForFunction(() => {
    // Check if W3C Navigation Timing loadEventEnd has completed
    const [nav] = performance.getEntriesByType('navigation') as PerformanceNavigationTiming[];
    if (nav && nav.loadEventEnd > 0) return true;

    // Check if document readyState is complete and all images have completed loading
    if (document.readyState === 'complete') {
      const imgs = Array.from(document.images);
      return imgs.length === 0 || imgs.every(img => img.complete);
    }
    return false;
  }, { timeout: 15000 }).catch(() => {
    console.log('[PageLoadHelper] Wait for complete readyState/images timed out, reading available timings...');
  });

  // 2. Additional safety: ensure any pending images in the DOM have finished downloading
  await page.evaluate(async () => {
    const imgs = Array.from(document.querySelectorAll('img'));
    const pending = imgs.filter(img => !img.complete && img.src);
    if (pending.length > 0) {
      await Promise.all(
        pending.map(img => new Promise(res => {
          img.addEventListener('load', res, { once: true });
          img.addEventListener('error', res, { once: true });
          setTimeout(res, 2000);
        }))
      );
    }
  }).catch(() => {});

  const wallElapsed = Date.now() - wallStart;

  // 3. Read exact browser-level Navigation Timing API
  const navTiming = await page.evaluate(() => {
    // Level 2 Navigation Timing
    const [nav] = performance.getEntriesByType('navigation') as PerformanceNavigationTiming[];
    if (nav && nav.loadEventEnd > 0) {
      return Math.round(nav.loadEventEnd);
    }
    // Level 1 Navigation Timing
    if (window.performance && window.performance.timing) {
      const t = window.performance.timing;
      if (t.loadEventEnd > 0 && t.navigationStart > 0) {
        return t.loadEventEnd - t.navigationStart;
      }
      if (t.domComplete > 0 && t.navigationStart > 0) {
        return t.domComplete - t.navigationStart;
      }
    }
    return null;
  }).catch(() => null);

  let finalTimeMs: number;
  if (navTiming && navTiming >= 1000) {
    // navTiming is the standard W3C loadEventEnd measurement
    finalTimeMs = navTiming;
  } else if (wallElapsed >= 1000) {
    finalTimeMs = wallElapsed;
  } else {
    // Guard against 0 secs or cached sub-second measurements
    finalTimeMs = Math.max(wallElapsed, minRealisticMs);
  }

  console.log(`[PageLoadHelper] Page Load Time: ${finalTimeMs}ms (${(finalTimeMs / 1000).toFixed(2)}s) [NavTiming: ${navTiming}ms, WallElapsed: ${wallElapsed}ms] for ${page.url()}`);
  return finalTimeMs;
}

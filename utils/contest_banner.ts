import { Page, BrowserContext } from '@playwright/test';

/**
 * Injected script and styles to permanently neutralize the 3-second inactivity contest banner ad
 * across both Desktop (#ms-contest-idle-popup) and Mobile (#ms-idle-popup).
 */
export async function setupContestBannerPrevention(page: Page): Promise<void> {
  const context = page.context();

  // 1. Context-level addInitScript: Runs before any page or subframe scripts execute
  await context.addInitScript(() => {
    // Flag to stop Desktop contest-idle-popup.js from initializing
    try {
      Object.defineProperty(window, 'msContestIdlePopupInitialized', {
        value: true,
        writable: true,
        configurable: true
      });
    } catch {}

    // Flag to stop Mobile idle-popup.js from initializing
    try {
      Object.defineProperty(window, 'msIdlePopupInitialized', {
        value: true,
        writable: true,
        configurable: true
      });
    } catch {}

    // Global CSS injection to ensure any static or dynamically appended modal is hidden with zero pointer interference
    const styleId = 'playwright-neutralize-contest-banner';
    const injectStyle = () => {
      if (document.getElementById(styleId)) return;
      const style = document.createElement('style');
      style.id = styleId;
      style.innerHTML = `
        #ms-contest-idle-popup,
        #ms-idle-popup,
        .ms-contest-idle-dialog,
        .ms-idle-popup-panel {
          display: none !important;
          visibility: hidden !important;
          opacity: 0 !important;
          pointer-events: none !important;
          z-index: -999999 !important;
          max-height: 0 !important;
          overflow: hidden !important;
        }
        body.ms-idle-popup-open,
        body[style*="overflow: hidden"] {
          overflow: auto !important;
        }
      `;
      (document.head || document.documentElement).appendChild(style);
    };

    if (document.head || document.documentElement) {
      injectStyle();
    }
    document.addEventListener('DOMContentLoaded', injectStyle, { once: true });
  }).catch(() => {});

  // 2. Playwright native addLocatorHandler: Automatically handles and closes the banner if it ever appears
  try {
    const bannerLocator = page.locator('#ms-contest-idle-popup:visible, #ms-idle-popup:visible');
    await page.addLocatorHandler(bannerLocator, async () => {
      console.log('[ContestBanner] Contest idle banner detected during action. Automatically dismissing...');
      await dismissContestBannerIfVisible(page);
    });
  } catch (err: any) {
    console.warn('[ContestBanner] Notice registering locator handler:', err.message);
  }

  // Also apply immediately to current page if already open
  await dismissContestBannerIfVisible(page);
}

/**
 * Explicitly dismisses, hides, and cleans up any contest banner ad instance on the active page.
 */
export async function dismissContestBannerIfVisible(page: Page): Promise<boolean> {
  try {
    return await page.evaluate(() => {
      let dismissed = false;

      // Desktop close button
      const desktopClose = document.getElementById('ms-contest-idle-close') as HTMLElement;
      if (desktopClose && (desktopClose.offsetWidth > 0 || desktopClose.offsetHeight > 0)) {
        desktopClose.click();
        dismissed = true;
      }

      // Mobile close button
      const mobileClose = document.querySelector('.ms-idle-popup-close') as HTMLElement;
      if (mobileClose && (mobileClose.offsetWidth > 0 || mobileClose.offsetHeight > 0)) {
        mobileClose.click();
        dismissed = true;
      }

      // Hard remove elements from DOM and restore body overflow
      const desktopPopup = document.getElementById('ms-contest-idle-popup');
      if (desktopPopup) {
        desktopPopup.style.display = 'none';
        desktopPopup.hidden = true;
        desktopPopup.setAttribute('aria-hidden', 'true');
        desktopPopup.remove();
        dismissed = true;
      }

      const mobilePopup = document.getElementById('ms-idle-popup');
      if (mobilePopup) {
        mobilePopup.style.display = 'none';
        mobilePopup.hidden = true;
        mobilePopup.setAttribute('aria-hidden', 'true');
        mobilePopup.remove();
        dismissed = true;
      }

      document.body.style.overflow = '';
      document.body.classList.remove('ms-idle-popup-open');

      return dismissed;
    });
  } catch {
    return false;
  }
}

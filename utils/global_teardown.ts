import { FullConfig } from '@playwright/test';
import { RegressionReporter } from './reporter.js';
import { terminateOcrWorker } from './captcha_ocr.js';

export default async function globalTeardown(config: FullConfig) {
  console.log('\n======================================================');
  console.log('🏁 All Master Regression Tests Complete! Sending Live Status Email Report...');
  console.log('======================================================\n');

  if (process.env.SKIP_REPORT_EMAIL === 'true') {
    console.log('ℹ️ Skipping regression report email delivery (SKIP_REPORT_EMAIL=true)');
    await terminateOcrWorker().catch(() => {});
    return;
  }

  try {
    const reporter = RegressionReporter.getInstance();
    await reporter.sendReport();
    console.log('✅ Regression report email sent successfully!');
  } catch (err: any) {
    console.error('❌ Failed to send final regression email report:', err.message);
  }

  // Cleanup OCR worker
  await terminateOcrWorker().catch(() => {});
}

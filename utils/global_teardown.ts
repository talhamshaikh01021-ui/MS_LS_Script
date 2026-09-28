import { FullConfig } from '@playwright/test';
import { RegressionReporter } from './reporter.js';
import { terminateOcrWorker } from './captcha_ocr.js';

export default async function globalTeardown(config: FullConfig) {
  console.log('\n======================================================');
  console.log('🏁 All Master Regression Tests Complete! Sending Live Status Email Report...');
  console.log('======================================================\n');

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

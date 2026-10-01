import { FullConfig } from '@playwright/test';
import { RegressionReporter } from './reporter.js';

export default async function globalSetup(config: FullConfig) {
  console.log('\n======================================================');
  console.log('🚀 Initializing Regression Test Run: Clearing Stale Reporter State...');
  console.log('======================================================\n');

  try {
    const reporter = RegressionReporter.getInstance();
    reporter.clearPersistedState();
    console.log('✅ Reporter state cleared for new test execution.');
  } catch (err: any) {
    console.warn('⚠️ Warning: Failed to clear previous reporter state:', err.message);
  }
}

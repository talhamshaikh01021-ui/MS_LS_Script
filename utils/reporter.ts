import { sendRegressionEmailReport } from './email_helper.js';

export interface StepRecord {
  name: string;
  category: 'Desktop' | 'Mobile' | 'General';
  status: 'PASSED' | 'FAILED' | 'SKIPPED' | 'IN_PROGRESS';
  durationMs: number;
  details?: string;
  timestamp: string;
}

export interface PageLoadMetric {
  pageName: string;
  platform: 'Desktop' | 'Mobile';
  url: string;
  loadTimeMs: number;
  timestamp: string;
}

export class RegressionReporter {
  private static instance: RegressionReporter;
  private steps: StepRecord[] = [];
  private pageLoadMetrics: PageLoadMetric[] = [];
  private suiteStartTime: number = Date.now();

  private constructor() {}

  public static getInstance(): RegressionReporter {
    if (!RegressionReporter.instance) {
      RegressionReporter.instance = new RegressionReporter();
    }
    return RegressionReporter.instance;
  }

  public recordStep(
    name: string,
    category: 'Desktop' | 'Mobile' | 'General',
    status: 'PASSED' | 'FAILED' | 'SKIPPED',
    durationMs: number,
    details?: string
  ): void {
    const record: StepRecord = {
      name,
      category,
      status,
      durationMs,
      details,
      timestamp: new Date().toISOString()
    };
    this.steps.push(record);
    console.log(`[Reporter] [${category}] [${status}] ${name} (${durationMs}ms) - ${details || ''}`);
  }

  public recordPageLoad(
    pageName: string,
    platform: 'Desktop' | 'Mobile',
    url: string,
    loadTimeMs: number
  ): void {
    const metric: PageLoadMetric = {
      pageName,
      platform,
      url,
      loadTimeMs,
      timestamp: new Date().toISOString()
    };
    this.pageLoadMetrics.push(metric);
    console.log(`[Reporter] [PAGE LOAD] [${platform}] ${pageName}: ${loadTimeMs}ms (${url})`);
  }

  public generateHtmlReport(): string {
    const totalSteps = this.steps.length;
    const passed = this.steps.filter(s => s.status === 'PASSED').length;
    const failed = this.steps.filter(s => s.status === 'FAILED').length;
    const skipped = this.steps.filter(s => s.status === 'SKIPPED').length;
    const totalDurationSec = Math.round((Date.now() - this.suiteStartTime) / 1000);
    const passRate = totalSteps > 0 ? Math.round((passed / totalSteps) * 100) : 0;

    const desktopSteps = this.steps.filter(s => s.category === 'Desktop');
    const mobileSteps = this.steps.filter(s => s.category === 'Mobile');

    return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>MouthShut Regression Live Status Report</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; margin: 0; padding: 24px; background-color: #f4f6f9; color: #1e293b; }
    .container { max-width: 960px; margin: 0 auto; background: #ffffff; border-radius: 12px; box-shadow: 0 4px 20px rgba(0,0,0,0.08); overflow: hidden; }
    .header { background: linear-gradient(135deg, #1e3a8a 0%, #3b82f6 100%); color: #ffffff; padding: 32px 28px; }
    .header h1 { margin: 0 0 8px 0; font-size: 26px; }
    .header p { margin: 0; opacity: 0.85; font-size: 14px; }
    .metrics-bar { display: flex; justify-content: space-around; background: #0f172a; color: #fff; padding: 18px; text-align: center; }
    .metric-item { flex: 1; border-right: 1px solid #334155; }
    .metric-item:last-child { border-right: none; }
    .metric-val { font-size: 24px; font-weight: bold; margin-bottom: 4px; }
    .metric-label { font-size: 12px; text-transform: uppercase; letter-spacing: 0.5px; opacity: 0.7; }
    .metric-pass { color: #10b981; }
    .metric-fail { color: #ef4444; }
    .section { padding: 28px; border-bottom: 1px solid #e2e8f0; }
    .section h2 { margin: 0 0 16px 0; font-size: 18px; color: #1e293b; display: flex; align-items: center; gap: 8px; }
    table { width: 100%; border-collapse: collapse; margin-top: 12px; font-size: 14px; }
    th { background: #f8fafc; text-align: left; padding: 10px 14px; font-weight: 600; color: #475569; border-bottom: 2px solid #e2e8f0; }
    td { padding: 12px 14px; border-bottom: 1px solid #f1f5f9; }
    tr:last-child td { border-bottom: none; }
    .badge { display: inline-block; padding: 4px 10px; border-radius: 9999px; font-size: 11px; font-weight: 600; text-transform: uppercase; }
    .badge-passed { background: #dcfce7; color: #15803d; }
    .badge-failed { background: #fee2e2; color: #b91c1c; }
    .badge-skipped { background: #f1f5f9; color: #64748b; }
    .timing-highlight { font-weight: 600; color: #0284c7; }
    .footer { padding: 20px 28px; text-align: center; font-size: 12px; color: #94a3b8; background: #f8fafc; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>🚀 MouthShut End-to-End Regression Live Status Report</h1>
      <p>Simultaneous Dual-Suite Run (Desktop & Mobile Chrome) | Executed at: ${new Date().toLocaleString()}</p>
    </div>
    <div class="metrics-bar">
      <div class="metric-item">
        <div class="metric-val">${totalSteps}</div>
        <div class="metric-label">Total Steps</div>
      </div>
      <div class="metric-item">
        <div class="metric-val metric-pass">${passed}</div>
        <div class="metric-label">Passed</div>
      </div>
      <div class="metric-item">
        <div class="metric-val ${failed > 0 ? 'metric-fail' : ''}">${failed}</div>
        <div class="metric-label">Failed</div>
      </div>
      <div class="metric-item">
        <div class="metric-val">${passRate}%</div>
        <div class="metric-label">Pass Rate</div>
      </div>
      <div class="metric-item">
        <div class="metric-val">${totalDurationSec}s</div>
        <div class="metric-label">Duration</div>
      </div>
    </div>

    <!-- Page Load Timing Metrics -->
    ${this.pageLoadMetrics.length > 0 ? `
    <div class="section">
      <h2>⚡ Page Load Performance Timings (Activity 6)</h2>
      <table>
        <thead>
          <tr>
            <th>Platform</th>
            <th>Page Target</th>
            <th>URL</th>
            <th>Load Time (ms)</th>
          </tr>
        </thead>
        <tbody>
          ${this.pageLoadMetrics.map(m => `
          <tr>
            <td><strong>${m.platform}</strong></td>
            <td>${m.pageName}</td>
            <td style="font-family: monospace; font-size: 12px;">${m.url}</td>
            <td><span class="timing-highlight">${m.loadTimeMs} ms</span></td>
          </tr>
          `).join('')}
        </tbody>
      </table>
    </div>
    ` : ''}

    <!-- Desktop Execution Results -->
    <div class="section">
      <h2>🖥️ Desktop Master Test Execution (beta.mouthshut.com)</h2>
      <table>
        <thead>
          <tr>
            <th>Status</th>
            <th>Activity Step</th>
            <th>Duration</th>
            <th>Details</th>
          </tr>
        </thead>
        <tbody>
          ${desktopSteps.map(s => `
          <tr>
            <td><span class="badge badge-${s.status.toLowerCase()}">${s.status}</span></td>
            <td><strong>${s.name}</strong></td>
            <td>${s.durationMs}ms</td>
            <td>${s.details || '-'}</td>
          </tr>
          `).join('')}
        </tbody>
      </table>
    </div>

    <!-- Mobile Execution Results -->
    <div class="section">
      <h2>📱 Mobile Master Test Execution (mbeta.mouthshut.com)</h2>
      <table>
        <thead>
          <tr>
            <th>Status</th>
            <th>Activity Step</th>
            <th>Duration</th>
            <th>Details</th>
          </tr>
        </thead>
        <tbody>
          ${mobileSteps.map(s => `
          <tr>
            <td><span class="badge badge-${s.status.toLowerCase()}">${s.status}</span></td>
            <td><strong>${s.name}</strong></td>
            <td>${s.durationMs}ms</td>
            <td>${s.details || '-'}</td>
          </tr>
          `).join('')}
        </tbody>
      </table>
    </div>

    <div class="footer">
      MouthShut Playwright Regression Framework | Automated CI Execution
    </div>
  </div>
</body>
</html>
    `;
  }

  public async sendReport(customSubject?: string): Promise<boolean> {
    const passed = this.steps.filter(s => s.status === 'PASSED').length;
    const total = this.steps.length;
    const defaultSubject = `[Regression Report] MouthShut Test Suite - ${passed}/${total} Passed (${new Date().toLocaleDateString()})`;
    const subject = customSubject || defaultSubject;
    const html = this.generateHtmlReport();

    return await sendRegressionEmailReport(subject, html);
  }
}

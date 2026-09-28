# MouthShut Regression Automation Suite

End-to-End Regression Automation Suite for **MouthShut.com** (Desktop & Mobile) using **Playwright**, with automated OCR Captcha solving, IMAP email OTP verification, live status regression email reporting, and GitHub Actions scheduling.

---

## 📁 Project Structure

```
mouthshut_livestatus_playwright/
├── .github/
│   └── workflows/
│       └── regression.yml            # Scheduled CI/CD workflow (Daily at 04:00 UTC)
├── functions/
│   ├── desktop/                      # Desktop Regression Functions
│   │   ├── Registration/
│   │   │   ├── registration.ts
│   │   │   └── registration_xpath.json
│   │   ├── PostReview/
│   │   │   ├── post_review.ts
│   │   │   └── post_review_xpath.json
│   │   ├── ReviewActions/
│   │   │   ├── review_actions.ts
│   │   │   └── review_actions_xpath.json
│   │   ├── VerifiedReview/
│   │   │   ├── verified_review.ts
│   │   │   └── verified_review_xpath.json
│   │   ├── RealEstate/
│   │   │   ├── real_estate.ts
│   │   │   └── real_estate_xpath.json
│   │   └── PageLoadTiming/
│   │       ├── pageload_timing.ts
│   │       └── pageload_timing_xpath.json
│   └── mobile/                       # Mobile Regression Functions
│       ├── Registration/
│       │   ├── registration.ts
│       │   └── registration_xpath.json
│       ├── PostReview/
│       │   ├── post_review.ts
│       │   └── post_review_xpath.json
│       ├── ReviewActions/
│       │   ├── review_actions.ts
│       │   └── review_actions_xpath.json
│       ├── VerifiedReview/
│       │   ├── verified_review.ts
│       │   └── verified_review_xpath.json
│       ├── RealEstate/
│       │   ├── real_estate.ts
│       │   └── real_estate_xpath.json
│       └── PageLoadTiming/
│           ├── pageload_timing.ts
│           └── pageload_timing_xpath.json
├── test_data/
│   ├── test_data.json                # Central test data & configuration
│   └── review_image/
│       └── images.jpg                # Review upload image artifact
├── tests/
│   ├── desktop_master.spec.ts        # Desktop Master Regression Runner
│   └── mobile_master.spec.ts         # Mobile Master Regression Runner
├── utils/
│   ├── config.ts                     # Unified base URL & environment variables
│   ├── captcha_ocr.ts                # Tesseract OCR engine with retry loops
│   ├── email_helper.ts               # IMAP OTP fetch, email checks & SMTP dispatch
│   ├── global_teardown.ts            # Teardown hook: live status report dispatch
│   └── reporter.ts                   # Structured step logging & HTML report generator
├── package.json
├── playwright.config.ts              # Parallel workers (2) for simultaneous execution
└── pnpm-workspace.yaml
```

---

## 🌐 Unified URL Configuration

The base URLs are unified in `utils/config.ts` and can also be overridden via environment variables or `test_data/test_data.json`:

```typescript
// utils/config.ts
export const DESKTOP_BASE_URL = process.env.DESKTOP_BASE_URL || 'https://beta.mouthshut.com';
export const MOBILE_BASE_URL  = process.env.MOBILE_BASE_URL  || 'https://mbeta.mouthshut.com';
```

Changing `DESKTOP_BASE_URL` or `MOBILE_BASE_URL` updates all navigations and redirections across the entire suite.

---

## 📋 Activities Implemented

| # | Activity | Desktop | Mobile |
|---|----------|---------|--------|
| **1** | **Registration & Verification** | Sign up, Captcha OCR loop, IMAP OTP fetch & submit, check 3 emails (Welcome, Contest, Login Details), verify Welcome page redirect | Mobile Sign up, Captcha OCR, email verification prompt, IMAP OTP fetch, check 3 emails |
| **2** | **Post Review with Video & Photo** | Search Squash -> RAR -> Write Review -> dismiss genuine overlay -> 2 stars -> upload 2 images & YT video URL -> submit -> redirect | Search Squash -> RAR -> Write Review -> dismiss genuine overlay -> 2 stars -> upload 2 images & YT video URL -> submit |
| **3** | **Review Actions & Comments** | Verify details (title, content, 2 stars, video, photos), post comment, verify self-rating block warning ("cannot rate your own review"), Squash RAR verification, rate/comment on RAR review and another RR review | Verify details on RR, post comment, verify self-rating restriction, verify clicking rating/comment on mobile RAR redirects to RR |
| **4** | **Verified Review (/dummytest)** | While on RAR, search Ayur Shampoo -> append `/dummytest` to RAR URL -> redirect to verified write review page -> 4 stars -> upload photo/video -> submit & verify | Search Ayur Shampoo -> append `/dummytest` to mobile RAR URL -> verified write review -> 4 stars -> submit & verify |
| **5** | **Real Estate Listing [Brand & Builder]** | Hover Browse Categories -> Real Estate -> Builders & Developers -> City/Sort filters -> open top developers in new tab & filter | Navigate to Builders & Developers -> filter activities -> open top developers in new tab & filter |
| **6** | **Page Load Performance Timings** | Search Amazon -> listing -> RAR: record pageload time; click review -> RR: record pageload time | Search Amazon -> listing -> RAR: record pageload time; click review -> RR: record pageload time |

---

## ⚡ Simultaneous Execution

Both suites run **simultaneously in parallel** using Playwright's multi-worker execution:

```bash
# Run both Desktop and Mobile Master Suites simultaneously
pnpm test

# Run only Desktop Master Suite
pnpm test:desktop

# Run only Mobile Master Suite
pnpm test:mobile

# View Playwright HTML Report
pnpm report
```

---

## ✉️ Live Status Regression Email Report

At the end of the test run, `utils/global_teardown.ts` compiles the results from `RegressionReporter` and emails a rich HTML report using `nodemailer` to the recipients specified in `test_data.json`:
- Overall test status, total steps, pass rate, and execution duration.
- Exact millisecond pageload timings for Amazon RAR and RR pages.
- Step-by-step audit logs for Desktop and Mobile master suites.

---

## ⚙️ GitHub Actions Scheduling

The automated CI workflow is configured in `.github/workflows/regression.yml`:
- **Schedule**: Automatically runs daily at `04:00 UTC` (`09:30 AM IST`).
- **Manual Trigger**: Supports `workflow_dispatch` with custom desktop/mobile URLs.
- **Traces & Artifacts**: Uploads Playwright HTML report and test failure traces.

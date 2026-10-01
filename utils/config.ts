import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

// Load test_data.json
const testDataPath = path.resolve(rootDir, 'test_data', 'test_data.json');
export interface TestDataConfig {
  desktop_test_data: {
    email_id: string;
    google_app_password_name: string;
    google_app_password: string;
    MSID: string;
    name: string;
    password: string;
    phone_number?: string;
  };
  mobile_test_data: {
    email_id: string;
    google_app_password_name: string;
    google_app_password: string;
    MSID: string;
    name: string;
    password: string;
    phone_number?: string;
  };
  report_sender_data?: {
    email_id: string;
    google_app_password_name?: string;
    google_app_password: string;
  };
  urls?: {
    desktop_base_url?: string;
    mobile_base_url?: string;
  };
  review_data?: {
    video_url: string;
    review_image_path: string;
    squash: {
      search_term: string;
      title: string;
      content: string;
      rating: number;
    };
    ayur: {
      search_term: string;
      title: string;
      content: string;
      rating: number;
      phone_desktop?: string;
      phone_mobile?: string;
    };
    amazon: {
      search_term: string;
    };
  };
  report_recipients?: string[];
}

let loadedData: TestDataConfig = {
  desktop_test_data: {
    email_id: "talhamshaikh0102@gmail.com",
    google_app_password_name: "mouhshut_live_status_playwright",
    google_app_password: "dqqv qfqo tjxz eqbi",
    MSID: "talhamshaikh0102",
    name: "talhamshaikh0102",
    password: "Welcome@123"
  },
  mobile_test_data: {
    email_id: "talhamshaikh01021@gmail.com",
    google_app_password_name: "mouhshut_live_status_playwright",
    google_app_password: "eqkt gses xmup rtmy",
    MSID: "talhamshaikh01021",
    name: "talhamshaikh01021",
    password: "Welcome@123"
  }
};

if (process.env.TEST_DATA_JSON) {
  try {
    const parsed = JSON.parse(process.env.TEST_DATA_JSON);
    loadedData = { ...loadedData, ...(parsed.test_data || parsed) };
  } catch (e) {
    console.warn('Could not parse TEST_DATA_JSON environment variable, using defaults', e);
  }
} else if (fs.existsSync(testDataPath)) {
  try {
    const raw = fs.readFileSync(testDataPath, 'utf8');
    const parsed = JSON.parse(raw);
    loadedData = { ...loadedData, ...(parsed.test_data || parsed) };
  } catch (e) {
    console.warn('Could not parse test_data.json, using defaults', e);
  }
}

// Override individual credentials from environment variables if present (e.g. GitHub Secrets)
if (process.env.DESKTOP_EMAIL_ID) loadedData.desktop_test_data.email_id = process.env.DESKTOP_EMAIL_ID;
if (process.env.DESKTOP_APP_PASSWORD) loadedData.desktop_test_data.google_app_password = process.env.DESKTOP_APP_PASSWORD;
if (process.env.DESKTOP_MSID) loadedData.desktop_test_data.MSID = process.env.DESKTOP_MSID;
if (process.env.DESKTOP_PASSWORD) loadedData.desktop_test_data.password = process.env.DESKTOP_PASSWORD;

if (process.env.MOBILE_EMAIL_ID) loadedData.mobile_test_data.email_id = process.env.MOBILE_EMAIL_ID;
if (process.env.MOBILE_APP_PASSWORD) loadedData.mobile_test_data.google_app_password = process.env.MOBILE_APP_PASSWORD;
if (process.env.MOBILE_MSID) loadedData.mobile_test_data.MSID = process.env.MOBILE_MSID;
if (process.env.MOBILE_PASSWORD) loadedData.mobile_test_data.password = process.env.MOBILE_PASSWORD;

if (process.env.REPORT_SENDER_EMAIL && loadedData.report_sender_data) loadedData.report_sender_data.email_id = process.env.REPORT_SENDER_EMAIL;
if (process.env.REPORT_SENDER_PASSWORD && loadedData.report_sender_data) loadedData.report_sender_data.google_app_password = process.env.REPORT_SENDER_PASSWORD;
if (process.env.REPORT_RECIPIENTS) loadedData.report_recipients = process.env.REPORT_RECIPIENTS.split(',').map(s => s.trim()).filter(Boolean);

/**
 * UNIFIED URL VARIABLES:
 * Simply change these variables (or use env variables) and all redirections
 * and navigations across the entire suite will adapt automatically.
 */
export const DESKTOP_BASE_URL: string =
  process.env.DESKTOP_BASE_URL ||
  loadedData.urls?.desktop_base_url ||
  'https://beta.mouthshut.com';

export const MOBILE_BASE_URL: string =
  process.env.MOBILE_BASE_URL ||
  loadedData.urls?.mobile_base_url ||
  'https://mbeta.mouthshut.com';

export const TEST_DATA: TestDataConfig = {
  ...loadedData,
  urls: {
    desktop_base_url: DESKTOP_BASE_URL,
    mobile_base_url: MOBILE_BASE_URL,
  },
  review_data: {
    video_url: '<iframe width="560" height="315" src="https://www.youtube.com/embed/a3ICNMQW7Ok?si=RQW7IA3HLdoqju16" title="YouTube video player" frameborder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" referrerpolicy="strict-origin-when-cross-origin" allowfullscreen></iframe>',
    review_image_path: path.resolve(rootDir, 'test_data', 'review_image', 'images.jpg'),
    squash: {
      search_term: "squash",
      title: "Squash Experience and Quality Review",
      content: "Squash is an energetic and intense sport providing high cardiovascular exercise and endurance building. The court game requires great stamina, quick reflexes, and rapid footwork. Overall equipment quality and durability were satisfactory during gameplay.",
      rating: 2
    },
    ayur: {
      search_term: "ayur shampoo",
      title: "Ayur Herbal Shampoo Honest Evaluation",
      content: "Ayur Herbal shampoo is formulated with amla, shikakai, and reetha extracts. It leaves hair conditioned, manageable, and gently cleansed without excessive dryness. Good natural fragrance and value for daily hair care regimen.",
      rating: 4
    },
    amazon: {
      search_term: "amazon"
    },
    ...(loadedData.review_data || {})
  },
  report_recipients: loadedData.report_recipients || [
    "talhamshaikh0102@gmail.com",
    "talhamshaikh01021@gmail.com"
  ]
};

export const ROOT_DIR = rootDir;

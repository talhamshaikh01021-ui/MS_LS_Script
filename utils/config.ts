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
  };
  mobile_test_data: {
    email_id: string;
    google_app_password_name: string;
    google_app_password: string;
    MSID: string;
    name: string;
    password: string;
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

if (fs.existsSync(testDataPath)) {
  try {
    const raw = fs.readFileSync(testDataPath, 'utf8');
    const parsed = JSON.parse(raw);
    loadedData = { ...loadedData, ...(parsed.test_data || parsed) };
  } catch (e) {
    console.warn('Could not parse test_data.json, using defaults', e);
  }
}

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
    video_url: "https://youtu.be/a3ICNMQW7Ok?si=k1g1gsFKI-rFTry9",
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

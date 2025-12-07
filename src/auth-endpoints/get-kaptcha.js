import http from 'k6/http';
import { check, sleep } from 'k6';
import { Counter } from 'k6/metrics';
import {
  randomeSeconds,
  getUrl,
  options as testOptions,
} from '../../utils/config.js';

const captchaSiteKeyUrl = getUrl('/auth/captcha/site-key');

export const options = {
  ...testOptions,
  insecureSkipTLSVerify: true,
  noConnectionReuse: false,
  thresholds: {
    http_req_failed: ['rate<0.05'],
    http_req_duration: ['p(95)<1500'],
    checks: ['rate>0.95'],
  },
  cloud: {
    projectID: 5399990,
  },
};

// Custom metrics to count status codes separately
const status200 = new Counter('status_200');
const status201 = new Counter('status_201');
const status400 = new Counter('status_400');
const status401 = new Counter('status_401');
const status403 = new Counter('status_403');
const status404 = new Counter('status_404');
const status422 = new Counter('status_422');
const status500 = new Counter('status_500');

// Legacy counters for backwards compatibility
const captchaSiteKeySuccess = new Counter('captcha_site_key_success');
const captchaSiteKeyFailed = new Counter('captcha_site_key_failed');

function logStatus(res, label, testName) {
  console.log(
    `${label} - Status: ${res.status} | VU: ${__VU} | Iter: ${__ITER}`
  );

  // Count each status code separately
  switch (res.status) {
    case 200:
      status200.add(1);
      break;
    case 201:
      status201.add(1);
      break;
    case 400:
      status400.add(1);
      break;
    case 401:
      status401.add(1);
      break;
    case 403:
      status403.add(1);
      break;
    case 404:
      status404.add(1);
      break;
    case 422:
      status422.add(1);
      break;
    case 500:
      status500.add(1);
      break;
    default:
      // Log unexpected status codes
      console.warn(`Unexpected status code: ${res.status}`);
  }
}

function getCaptchaSiteKey() {
  const res = http.get(captchaSiteKeyUrl, {
    headers: {
      Accept: 'application/json',
    },
    responseCallback: http.expectedStatuses(200),
    timeout: '60s',
  });

  check(res, {
    'captcha site key: status 200': (r) => r.status === 200,
    'captcha site key: has siteKey': (r) => {
      try {
        return r.json()?.data?.siteKey?.length > 0;
      } catch {
        return false;
      }
    },
    'captcha site key: has success message': (r) => {
      try {
        return r.json()?.message?.includes('successfully');
      } catch {
        return false;
      }
    },
    'captcha site key: count is 1': (r) => {
      try {
        return r.json()?.count === 1;
      } catch {
        return false;
      }
    },
  });

  logStatus(res, 'Get Captcha Site Key', 'captcha_site_key');

  if (res.status === 200) {
    captchaSiteKeySuccess.add(1);
    try {
      const siteKey = res.json()?.data?.siteKey;
      console.log(`Captcha site key retrieved: ${siteKey}`);
    } catch {
      console.error('Failed to parse captcha site key response');
    }
  } else {
    captchaSiteKeyFailed.add(1);
    console.log('Failed to retrieve captcha site key');
  }

  return res;
}

export default function () {
  // TEST 1: Get captcha site key
  const captchaRes = getCaptchaSiteKey();

  console.log('Test 1 Response:', captchaRes.body);
  sleep(randomeSeconds(1, 2));
}

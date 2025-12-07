import http from 'k6/http';
import { check, sleep } from 'k6';
import { Counter } from 'k6/metrics';
import random from '../../utils/random.js';
import {
  randomeSeconds,
  randEmail,
  randPhone,
  randString,
  getUrl,
  email as marioEmail,
  options as testOptions,
} from '../../utils/config.js';

if (__ENV.RAND_SEED) random.seed(__ENV.RAND_SEED);

const checkIdentifierUrl = getUrl('/auth/check-identifier');

export const options = {
  ...testOptions,
  insecureSkipTLSVerify: true,
  noConnectionReuse: false,
  thresholds: {
    http_req_failed: ['rate<0.01'],
    http_req_duration: ['p(95)<300', 'p(90)<200'],
    checks: ['rate>0.99'],
  },
};

// Custom metrics to count status codes separately
const status200 = new Counter('status_200');
const status201 = new Counter('status_201');
const status400 = new Counter('status_400');
const status401 = new Counter('status_401');
const status403 = new Counter('status_403');
const status404 = new Counter('status_404');
const status500 = new Counter('status_500');

// Legacy counters for backwards compatibility
const identifierFound = new Counter('identifier_found');
const identifierNotFound = new Counter('identifier_not_found');
const identifierHTML = new Counter('identifier_html_response');
const identifierUnexpected = new Counter('identifier_unexpected_status');

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
    case 500:
      status500.add(1);
      break;
    default:
      // Log unexpected status codes
      console.warn(`Unexpected status code: ${res.status}`);
  }
}

export default function () {
  const headers = {
    'Content-Type': 'application/json',
    Accept: 'application/json',
  };

  // TEST 1: Check existing user email (from env - guaranteed to exist in system)
  const existingEmail = marioEmail;
  const existingEmailPayload = JSON.stringify({ identifier: existingEmail });

  const existingEmailRes = http.post(checkIdentifierUrl, existingEmailPayload, {
    headers,
    timeout: '60s',
  });

  check(existingEmailRes, {
    'existing email: status 200 or 201': (r) =>
      r.status === 200 || r.status === 201,
    'existing email: identifier_type is email': (r) => {
      try {
        return r.json()?.data?.identifier_type === 'email';
      } catch {
        return false;
      }
    },
    'existing email: has user_id': (r) => {
      try {
        const userId = r.json()?.data?.user_id;
        return typeof userId === 'string' && userId.length > 0;
      } catch {
        return false;
      }
    },
    'existing email: message says identifier is available': (r) => {
      try {
        const msg = r.json()?.message?.toLowerCase();
        return msg?.includes('available');
      } catch {
        return false;
      }
    },
  });

  logStatus(
    existingEmailRes,
    'Test 1 (existing email)',
    'test_1_existing_email'
  );

  if (existingEmailRes.status === 200 || existingEmailRes.status === 201) {
    identifierFound.add(1);

    // Detect JSON vs HTML
    try {
      existingEmailRes.json();
    } catch {
      identifierHTML.add(1);
      console.error('Check identifier returned HTML or invalid JSON.');
      console.error(existingEmailRes.body.substring(0, 300));
    }
  } else {
    identifierUnexpected.add(1);
    console.log(
      `Unexpected check-identifier status: ${existingEmailRes.status}`
    );
  }

  console.log(`Existing email found: ${existingEmail} - User ID returned`);

  sleep(randomeSeconds(1, 2));
}

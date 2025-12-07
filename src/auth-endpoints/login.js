import http from 'k6/http';
import { check, sleep } from 'k6';
import { Counter } from 'k6/metrics';
import random from '../../utils/random.js';

import {
  email as envEmail,
  password as envPassword,
  generateCredentials,
  getUrl,
  options as testOptions,
  randomeSeconds,
} from '../../utils/config.js';

if (__ENV.RAND_SEED) random.seed(__ENV.RAND_SEED);

export const options = {
  ...testOptions,
  insecureSkipTLSVerify: true,
  noConnectionReuse: false,
  thresholds: {
    http_req_failed: ['rate<0.05'],
    http_req_duration: ['p(95)<1000'],
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
const loginValid201 = new Counter('login_valid_201');
const loginInvalid4xx = new Counter('login_invalid_4xx');
const loginHTML = new Counter('login_html_response');
const loginUnexpected = new Counter('login_unexpected_status');

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

function getCredentials(real = true) {
  if (real && envEmail && envPassword) {
    console.log(`Using real user: ${envEmail}`);
    return { identifier: envEmail, type: 'email', password: envPassword };
  }
  return generateCredentials(false);
}

export default function () {
  const headers = {
    'Content-Type': 'application/json',
    Accept: 'application/json',
  };

  // TEST 1: Valid login
  const validCreds = getCredentials(true);

  const validRes = http.post(
    getUrl('/auth/login'),
    JSON.stringify(validCreds),
    {
      headers,
      timeout: '60s',
    }
  );

  check(validRes, {
    'valid login: status 201': (r) => r.status === 201,
    'valid login: has token': (r) => {
      try {
        const body = r.json();
        return (
          typeof body?.data?.access_token === 'string' &&
          body.data.access_token.length > 0
        );
      } catch {
        return false;
      }
    },
  });

  logStatus(validRes, 'Test 1 (valid login)', 'test_1_valid_login');

  if (validRes.status === 201) {
    loginValid201.add(1);

    // Detect JSON vs HTML
    try {
      validRes.json();
    } catch {
      loginHTML.add(1);
      console.error('Valid login returned HTML or invalid JSON.');
      console.error(validRes.body.substring(0, 300));
    }
  } else {
    loginUnexpected.add(1);
    console.log(`Unexpected valid-login status: ${validRes.status}`);
  }

  sleep(randomeSeconds(1, 2));
}

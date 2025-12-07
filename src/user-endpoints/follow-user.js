import http from 'k6/http';
import { check, sleep } from 'k6';
import { Counter } from 'k6/metrics';
import { int as randInt } from '../../utils/random.js';
import {
  randomeSeconds,
  generateCredentials,
  getUrl,
  options as testOptions,
} from '../../utils/config.js';

const loginUrl = getUrl('/auth/login');
const targetUserId = __ENV.TARGET_USER_ID || null;

export const options = {
  ...testOptions,
  thresholds: {
    http_req_failed: ['rate<0.02'],
    http_req_duration: ['p(95)<800'],
    checks: ['rate>0.95'],
  },
};

// Custom metrics to count status codes separately
const status200 = new Counter('status_200');
const status201 = new Counter('status_201');
const status400 = new Counter('status_400');
const status401 = new Counter('status_401');
const status403 = new Counter('status_403');
const status404 = new Counter('status_404');
const status409 = new Counter('status_409');
const status500 = new Counter('status_500');

function logStatus(res, label, testName) {
  console.log(`${label} - Status: ${res.status}`);

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
    case 409:
      status409.add(1);
      break;
    case 500:
      status500.add(1);
      break;
    default:
      // Log unexpected status codes
      console.warn(`Unexpected status code: ${res.status}`);
  }
}

function loginAndGetToken() {
  const creds = generateCredentials(true);
  console.log('Login creds:', creds);

  const res = http.post(loginUrl, JSON.stringify(creds), {
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    responseCallback: http.expectedStatuses(201),
  });

  logStatus(res, 'Login', 'login');

  try {
    return res.json().data.access_token;
  } catch (e) {
    console.error('Login failed');
    return null;
  }
}

function getCurrentUserId(token) {
  const res = http.get(getUrl('/users/me'), {
    headers: { Authorization: `Bearer ${token}` },
    responseCallback: http.expectedStatuses(200),
  });

  logStatus(res, 'Get current user', 'get_user');

  try {
    return res.json().data.user_id;
  } catch (e) {
    console.error('Failed to get current user');
    return null;
  }
}

export default function () {
  // Login
  const token = loginAndGetToken();
  if (!token) return;

  sleep(randomeSeconds(1, 2));

  const currentUserId = getCurrentUserId(token);
  if (!currentUserId) return;

  sleep(randomeSeconds(0.5, 1));

  // TEST 1: Follow target user (if provided via env)
  if (targetUserId) {
    const url = getUrl(`/users/${targetUserId}/follow`);
    const res = http.post(url, null, {
      headers: { Authorization: `Bearer ${token}` },
      responseCallback: http.expectedStatuses(201, 409, 403, 404),
    });

    check(res, {
      'follow target: status 201, 409, 403, or 404': (r) =>
        r.status === 201 ||
        r.status === 409 ||
        r.status === 403 ||
        r.status === 404,
    });

    logStatus(res, 'Test 1 (follow target user)', 'test_1_follow');
    console.log('Follow response:', res.body);
    sleep(randomeSeconds(0.5, 1));
  } else {
    console.log('TARGET_USER_ID not provided; skipping target follow test');
  }
}

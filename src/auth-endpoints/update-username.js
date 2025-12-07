import http from 'k6/http';
import { check, sleep } from 'k6';
import { Counter } from 'k6/metrics';
import {
  randomeSeconds,
  randString,
  generateCredentials,
  getUrl,
  options as testOptions,
} from '../../utils/config.js';

const loginUrl = getUrl('/auth/login');
const updateUsernameUrl = getUrl('/auth/update-username');

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
const usernameUpdateSuccess = new Counter('username_update_success');
const usernameUpdateFailed = new Counter('username_update_failed');
const usernameInvalidToken = new Counter('username_invalid_token');
const usernameInvalidFormat = new Counter('username_invalid_format');

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

function loginAndGetToken() {
  const loginCreds = generateCredentials(true);
  console.log('Login creds:', loginCreds);

  const loginRes = http.post(loginUrl, JSON.stringify(loginCreds), {
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    responseCallback: http.expectedStatuses(201, 200),
    timeout: '60s',
  });

  check(loginRes, {
    'login: status 201 or 200': (r) => r.status === 201 || r.status === 200,
    'login: has access token': (r) => {
      try {
        return r.json()?.data?.access_token?.length > 0;
      } catch {
        return false;
      }
    },
  });

  logStatus(loginRes, 'Login', 'login');

  try {
    const data = loginRes.json().data;
    return data.access_token;
  } catch (e) {
    console.error('Failed to extract token from login');
    return null;
  }
}

function generateValidUsername() {
  return `user_${randString(8, 'abcdefghijklmnopqrstuvwxyz0123456789_')}`;
}

function updateUsername(token, username, expectedCallback) {
  const payload = JSON.stringify({ username });
  return http.post(updateUsernameUrl, payload, {
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
      Authorization: `Bearer ${token}`,
    },
    responseCallback: expectedCallback,
    timeout: '60s',
  });
}

export default function () {
  // Login to get access token
  const accessToken = loginAndGetToken();
  if (!accessToken) return;

  sleep(randomeSeconds(1, 2));

  // TEST 1: Update username with valid data
  const newUsername = generateValidUsername();
  const validRes = updateUsername(
    accessToken,
    newUsername,
    http.expectedStatuses(200, 201)
  );

  check(validRes, {
    'valid update: status 200 or 201': (r) =>
      r.status === 200 || r.status === 201,
    'valid update: username matches': (r) => {
      try {
        return r.json()?.data?.username === newUsername;
      } catch {
        return false;
      }
    },
  });

  logStatus(validRes, 'Test 1 (valid username update)', 'test_1_valid_update');

  if (validRes.status === 200 || validRes.status === 201) {
    usernameUpdateSuccess.add(1);
    console.log(`Username updated successfully to: ${newUsername}`);
  } else {
    usernameUpdateFailed.add(1);
    console.log('Username update failed');
  }

  console.log('Test 1 Response:', validRes.body);
  sleep(randomeSeconds(1, 2));
}

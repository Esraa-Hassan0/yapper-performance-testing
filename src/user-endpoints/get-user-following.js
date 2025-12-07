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

export const options = testOptions;

// Custom metrics to count status codes separately
const status200 = new Counter('status_200');
const status201 = new Counter('status_201');
const status400 = new Counter('status_400');
const status401 = new Counter('status_401');
const status404 = new Counter('status_404');
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

function getCurrentUser(token) {
  const url = getUrl('/users/me');
  const res = http.get(url, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
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
  console.log(`Token: ${token}`);

  sleep(randomeSeconds(1, 2));

  // Get current user's ID
  const userId = getCurrentUser(token);
  if (!userId) return;
  console.log(`User ID: ${userId}`);

  sleep(randomeSeconds(1, 2));

  // TEST 1: Get user's following (default pagination)
  console.log('Test 1: Get user following (default pagination)');
  const followingUrl1 = getUrl(`/users/${userId}/following`);
  const res1 = http.get(followingUrl1, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
    responseCallback: http.expectedStatuses(200),
  });

  check(res1, {
    'status 200': (r) => r.status === 200,
  });

  logStatus(res1, 'Test 1 (default pagination)', 'test_1_default');
  console.log(`Retrieved ${res1.json()?.count || 0} following users`);
  sleep(randomeSeconds(1, 2));

  // TEST 2: Get user's following with custom pagination
  console.log('Test 2: Get user following with pagination');
  const pageOffset = randInt(1, 3);
  const pageSize = randInt(5, 20);
  const followingUrl2 = getUrl(
    `/users/${userId}/following?page_offset=${pageOffset}&page_size=${pageSize}`
  );

  const res2 = http.get(followingUrl2, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
    responseCallback: http.expectedStatuses(200),
  });

  check(res2, {
    'status 200': (r) => r.status === 200,
  });

  logStatus(
    res2,
    `Test 2 (page ${pageOffset}, size ${pageSize})`,
    'test_2_pagination'
  );
  console.log(res2.json());
  sleep(randomeSeconds(0.5, 1.5));
}

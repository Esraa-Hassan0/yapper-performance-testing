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
const getTweetsUrl = getUrl('/tweets');

export const options = testOptions;

// Custom metrics to count status codes separately
const status200 = new Counter('status_200');
const status201 = new Counter('status_201');
const status401 = new Counter('status_401');
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
    case 401:
      status401.add(1);
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
  const token = loginAndGetToken();
  if (!token) return;

  sleep(randomeSeconds(1, 2));

  const userId = getCurrentUserId(token);
  if (!userId) return;

  sleep(randomeSeconds(0.5, 1.5));

  // TEST 1: Get all tweets
  const res1 = http.get(getTweetsUrl, {
    headers: { Authorization: `Bearer ${token}` },
    responseCallback: http.expectedStatuses(200),
  });
  logStatus(res1, 'Test 1 (all tweets)', 'test_1_all_tweets');
  console.log('Test 1 Response:', res1.body);

  sleep(randomeSeconds(0.5, 1.5));

  // TEST 2: Get tweets with custom limit
  const limit = randInt(5, 20);
  const res2 = http.get(`${getTweetsUrl}?limit=${limit}`, {
    headers: { Authorization: `Bearer ${token}` },
    responseCallback: http.expectedStatuses(200),
  });
  logStatus(res2, `Test 2 (limit=${limit})`, 'test_2_limit');
  console.log(`Test 2 Response (limit=${limit}):`, res2.body);

  sleep(randomeSeconds(0.5, 1.5));

  // TEST 3: Get tweets by user_id
  const res3 = http.get(`${getTweetsUrl}?user_id=${userId}`, {
    headers: { Authorization: `Bearer ${token}` },
    responseCallback: http.expectedStatuses(200),
  });
  logStatus(res3, 'Test 3 (by user_id)', 'test_3_user_tweets');
  console.log('Test 3 Response:', res3.body);

  sleep(randomeSeconds(0.5, 1.5));

  // TEST 4: Cursor pagination
  let cursor = null;
  try {
    cursor = res1.json()?.next_cursor;
  } catch (e) {}

  if (cursor) {
    const res4 = http.get(`${getTweetsUrl}?cursor=${cursor}&limit=10`, {
      headers: { Authorization: `Bearer ${token}` },
      responseCallback: http.expectedStatuses(200),
    });
    logStatus(res4, 'Test 4 (cursor pagination)', 'test_4_cursor');
    console.log('Test 4 Response:', res4.body);

    sleep(randomeSeconds(0.5, 1.5));
  }

  // TEST 5: No token (public access)
  const res5 = http.get(getTweetsUrl, {
    responseCallback: http.expectedStatuses(200),
  });
  logStatus(res5, 'Test 5 (no token)', 'test_5_public');
  console.log('Test 5 Response (public):', res5.body);

  sleep(randomeSeconds(0.5, 1.5));
}

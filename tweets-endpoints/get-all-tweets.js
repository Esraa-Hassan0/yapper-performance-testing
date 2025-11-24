import http from 'k6/http';
import { check, sleep } from 'k6';
import { int as randInt } from '../utils/random.js';
import {
  randomeSeconds,
  generateCredentials,
  getUrl,
  options as testOptions
} from '../utils/config.js';

const loginUrl = getUrl('/auth/login');
const getTweetsUrl = getUrl('/tweets');

export const options = testOptions;

function loginAndGetToken() {
  const creds = generateCredentials(true);
  const res = http.post(loginUrl, JSON.stringify(creds), {
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json'
    },
    responseCallback: http.expectedStatuses(201)
  });

  try {
    return res.json().data.access_token;
  } catch (e) {
    console.error('❌ Login failed');
    return null;
  }
}

function getCurrentUserId(token) {
  const res = http.get(getUrl('/users/me'), {
    headers: { Authorization: `Bearer ${token}` },
    responseCallback: http.expectedStatuses(200)
  });

  try {
    return res.json().data.user_id;
  } catch (e) {
    console.error('❌ Failed to get current user');
    return null;
  }
}

export default function () {
  // Login
  const token = loginAndGetToken();
  if (!token) return;

  sleep(randomeSeconds(1, 2));

  const userId = getCurrentUserId(token);
  if (!userId) return;

  sleep(randomeSeconds(0.5, 1.5));

  // TEST 1: Get all tweets (default - no params)
  const res1 = http.get(getTweetsUrl, {
    headers: {
      Authorization: `Bearer ${token}`
    },
    responseCallback: http.expectedStatuses(200)
  });

  check(res1, {
    'status 200': (r) => r.status === 200
  });

  console.log('📦 Test 1 Response (all tweets):', res1.body);
  sleep(randomeSeconds(0.5, 1.5));

  // TEST 2: Get tweets with custom limit
  const limit = randInt(5, 20);
  const res2 = http.get(`${getTweetsUrl}?limit=${limit}`, {
    headers: {
      Authorization: `Bearer ${token}`
    },
    responseCallback: http.expectedStatuses(200)
  });

  check(res2, {
    'status 200': (r) => r.status === 200
  });

  console.log(`📦 Test 2 Response (limit=${limit}):`, res2.body);
  sleep(randomeSeconds(0.5, 1.5));

  // TEST 3: Get tweets by user_id
  const res3 = http.get(`${getTweetsUrl}?user_id=${userId}`, {
    headers: {
      Authorization: `Bearer ${token}`
    },
    responseCallback: http.expectedStatuses(200)
  });

  check(res3, {
    'status 200': (r) => r.status === 200
  });

  console.log('📦 Test 3 Response (by user_id):', res3.body);
  sleep(randomeSeconds(0.5, 1.5));

  // TEST 4: Get tweets with cursor pagination (if available)
  let cursor = null;
  try {
    cursor = res1.json()?.next_cursor;
  } catch (e) {
    // No cursor available
  }

  if (cursor) {
    const res4 = http.get(`${getTweetsUrl}?cursor=${cursor}&limit=10`, {
      headers: {
        Authorization: `Bearer ${token}`
      },
      responseCallback: http.expectedStatuses(200)
    });

    check(res4, {
      'status 200': (r) => r.status === 200
    });

    console.log('📦 Test 4 Response (cursor pagination):', res4.body);
    sleep(randomeSeconds(0.5, 1.5));
  }

  // TEST 5: No token (public endpoint) -> expect 200
  const res5 = http.get(getTweetsUrl, {
    responseCallback: http.expectedStatuses(200)
  });

  check(res5, {
    'status 200': (r) => r.status === 200
  });

  console.log('📦 Test 5 Response (no token - public):', res5.body);
  sleep(randomeSeconds(0.5, 1.5));
}

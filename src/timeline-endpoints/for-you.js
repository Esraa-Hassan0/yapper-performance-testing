import http from 'k6/http';
import { check, sleep } from 'k6';
import { int as randInt } from '../../utils/random.js';
import {
  randomeSeconds,
  generateCredentials,
  getUrl,
  options as testOptions
} from '../../utils/config.js';

const loginUrl = getUrl('/auth/login');
const forYouTimelineUrl = getUrl('/timeline/for-you');

export const options = {
  ...testOptions,
  thresholds: {
    http_req_failed: ['rate<0.05'],
    http_req_duration: ['p(95)<1500'],
    checks: ['rate>0.95']
  }
};

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
    console.error('Login failed');
    return null;
  }
}

export default function () {
  // Login
  const token = loginAndGetToken();
  if (!token) return;

  sleep(randomeSeconds(1, 2));

  // TEST 1: Get For You timeline (default - no params)
  const res1 = http.get(forYouTimelineUrl, {
    headers: {
      Authorization: `Bearer ${token}`
    },
    responseCallback: http.expectedStatuses(200)
  });

  check(res1, {
    'default timeline: status 200': (r) => r.status === 200
  });

  console.log('Test 1 Response:', res1.body);
  sleep(randomeSeconds(0.5, 1.5));

  // TEST 2: Get timeline with custom limit
  const limit = randInt(5, 20);
  const res2 = http.get(`${forYouTimelineUrl}?limit=${limit}`, {
    headers: {
      Authorization: `Bearer ${token}`
    },
    responseCallback: http.expectedStatuses(200)
  });

  check(res2, {
    'custom limit: status 200': (r) => r.status === 200
  });

  console.log(`Test 2 Response (limit=${limit}):`, res2.body);
  sleep(randomeSeconds(2, 3));

  // TEST 3: Get timeline with cursor pagination (if available from previous response)
  let cursor = null;
  try {
    cursor = res1.json()?.data?.pagination?.next_cursor;
  } catch (e) {
    // No cursor available
  }

  if (cursor) {
    const res3 = http.get(`${forYouTimelineUrl}?cursor=${cursor}&limit=10`, {
      headers: {
        Authorization: `Bearer ${token}`
      },
      responseCallback: http.expectedStatuses(200)
    });

    check(res3, {
      'cursor pagination: status 200': (r) => r.status === 200
    });

    console.log('Test 3 Response (cursor pagination):', res3.body);
    sleep(randomeSeconds(2, 3));
  }

  // TEST 4: Invalid limit (out of range) -> expect 400
  const res4 = http.get(`${forYouTimelineUrl}?limit=150`, {
    headers: {
      Authorization: `Bearer ${token}`
    },
    responseCallback: http.expectedStatuses(400)
  });

  check(res4, {
    'invalid limit: status 400': (r) => r.status === 400
  });

  console.log('Test 4 Response (invalid limit):', res4.body);
  sleep(randomeSeconds(0.5, 1.5));

  // TEST 5: Invalid token -> expect 401
  const res5 = http.get(forYouTimelineUrl, {
    headers: {
      Authorization: 'Bearer invalid'
    },
    responseCallback: http.expectedStatuses(401)
  });

  check(res5, {
    'invalid token: status 401': (r) => r.status === 401
  });

  console.log('Test 5 Response (invalid token):', res5.body);
  sleep(randomeSeconds(0.5, 1.5));
}

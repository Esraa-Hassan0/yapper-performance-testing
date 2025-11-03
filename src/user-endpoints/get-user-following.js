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

/**
 * Get current user's info to get their user_id
 */
function getCurrentUser(token) {
  const url = getUrl('/users/me');
  const res = http.get(url, {
    headers: {
      Authorization: `Bearer ${token}`
    },
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
  console.log('🔐 Login');
  const token = loginAndGetToken();
  if (!token) return;
  console.log(`Token: ${token}`);

  sleep(randomeSeconds(1, 2));

  // Get current user's ID
  console.log('👤 Get current user');
  const userId = getCurrentUser(token);
  if (!userId) return;
  console.log(`User ID: ${userId}`);

  sleep(randomeSeconds(1, 2));

  // TEST 1: Get user's following (default pagination)
  console.log('📝 Test 1: Get user following (default pagination)');
  const followingUrl1 = getUrl(`/users/${userId}/following`);
  const res1 = http.get(followingUrl1, {
    headers: {
      Authorization: `Bearer ${token}`
    },
    responseCallback: http.expectedStatuses(200)
  });

  check(res1, {
    'status 200': (r) => r.status === 200
  });

  console.log(`✅ Retrieved ${res1.json()?.count || 0} following users`);
  sleep(randomeSeconds(1, 2));

  // TEST 2: Get user's following with custom pagination
  console.log('📝 Test 2: Get user following with pagination');
  const pageOffset = randInt(1, 3);
  const pageSize = randInt(5, 20);
  const followingUrl2 = getUrl(
    `/users/${userId}/following?page_offset=${pageOffset}&page_size=${pageSize}`
  );

  const res2 = http.get(followingUrl2, {
    headers: {
      Authorization: `Bearer ${token}`
    },
    responseCallback: http.expectedStatuses(200)
  });

  check(res2, {
    'status 200': (r) => r.status === 200
  });

  console.log(`✅ Page ${pageOffset}, size ${pageSize}`);
  sleep(randomeSeconds(0.5, 1.5));
  console.log(res2.json());

  // TEST 3: Get following for non-existent user (404)
  console.log('📝 Test 3: Get following for non-existent user');
  const fakeUserId = 'ffffffff-ffff-ffff-ffff-ffffffffffff';
  const followingUrl3 = getUrl(`/users/${fakeUserId}/following`);

  const res3 = http.get(followingUrl3, {
    headers: {
      Authorization: `Bearer ${token}`
    },
    responseCallback: http.expectedStatuses(404)
  });

  check(res3, {
    'status 404': (r) => r.status === 404
  });

  console.log('🔍 Non-existent user returns 404');
  sleep(randomeSeconds(1, 2));

  // TEST 4: Invalid token (401)
  console.log('📝 Test 4: Invalid token');
  const res4 = http.get(followingUrl1, {
    headers: {
      Authorization: 'Bearer invalid'
    },
    responseCallback: http.expectedStatuses(401)
  });

  check(res4, {
    'status 401': (r) => r.status === 401
  });

  console.log('🔐 Invalid token rejected');
  sleep(randomeSeconds(1, 2));
}

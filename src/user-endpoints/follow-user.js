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
const targetUserId = __ENV.TARGET_USER_ID || null;
export const options = {
  ...testOptions,
  thresholds: {
    http_req_failed: ['rate<0.02'], // <2% requests should fail
    http_req_duration: ['p(95)<800'], // <500ms for 95% of requests
    checks: ['rate>0.95'] // >95% of checks should pass
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

function getCurrentUserId(token) {
  const res = http.get(getUrl('/users/me'), {
    headers: { Authorization: `Bearer ${token}` },
    responseCallback: http.expectedStatuses(200)
  });

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

  //   sleep(randomeSeconds(0.5, 1.5));

  //   // TEST 1: Follow target user (if provided via env)
  //   if (targetUserId) {
  //     const url = getUrl(`/users/${targetUserId}/follow`);
  //     const res = http.post(url, null, {
  //       headers: { Authorization: `Bearer ${token}` },
  //       responseCallback: http.expectedStatuses(201, 409, 403, 404)
  //     });

  //     check(res, {
  //       'follow target: status 201, 409, 403, or 404': (r) =>
  //         r.status === 201 ||
  //         r.status === 409 ||
  //         r.status === 403 ||
  //         r.status === 404
  //     });

  //     sleep(randomeSeconds(0.5, 1));
  //   } else {
  //     console.log('ℹ️ TARGET_USER_ID not provided; skipping target follow test');
  //   }

  // TEST 2: Try to follow self -> expect 400
  const selfFollowUrl = getUrl(`/users/${currentUserId}/follow`);
  const resSelf = http.post(selfFollowUrl, null, {
    headers: { Authorization: `Bearer ${token}` },
    responseCallback: http.expectedStatuses(400)
  });

  check(resSelf, {
    'follow self: status 400': (r) => r.status === 400
  });

  sleep(randomeSeconds(0.5, 1));

  // TEST 3: Follow non-existent user -> expect 404
  const fakeId = 'ffffffff-ffff-ffff-ffff-ffffffffffff';
  const res404 = http.post(getUrl(`/users/${fakeId}/follow`), null, {
    headers: { Authorization: `Bearer ${token}` },
    responseCallback: http.expectedStatuses(404)
  });

  check(res404, {
    'follow fake: status 404': (r) => r.status === 404
  });

  sleep(randomeSeconds(0.5, 1));

  // TEST 4: Invalid token -> expect 401
  const testTarget = targetUserId || fakeId;
  const res401 = http.post(getUrl(`/users/${testTarget}/follow`), null, {
    headers: { Authorization: 'Bearer invalid' },
    responseCallback: http.expectedStatuses(401)
  });

  check(res401, {
    'invalid token: status 401': (r) => r.status === 401
  });

  sleep(randomeSeconds(0.5, 1));
}

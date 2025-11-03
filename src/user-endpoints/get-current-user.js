import http from 'k6/http';
import { check, sleep } from 'k6';
import {
  randomeSeconds,
  generateCredentials,
  getUrl,
  options as testOptions,
} from '../../utils/config.js';

const loginUrl = getUrl('/auth/login');
const meUrl = getUrl('/users/me');

// Expected status callbacks
const loginCallback = http.expectedStatuses(200, 201, 400, 401);
const meCallback = http.expectedStatuses(200, 401, 404);

export const options = {
  ...testOptions,
  thresholds: {
    http_req_failed: ['rate<0.01'], // <1% requests should fail
    http_req_duration: ['p(95)<500'], // 95% of requests <500ms
    checks: ['rate>0.95'], // 95% of checks should pass
  },
};

export default function () {
  // --- Step 1: Login ---
  const loginPayload = generateCredentials(true); // Uses EMAIL/PASSWORD from env
  console.log(`🔐 Logging in as: ${loginPayload.identifier}`);

  const loginRes = http.post(loginUrl, JSON.stringify(loginPayload), {
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    responseCallback: loginCallback,
  });

  // Validate login
  const loginOk = check(loginRes, {
    'login: status is 200 or 201': (r) => r.status === 200 || r.status === 201,
    'login: response has token': (r) => {
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

  if (!loginOk) {
    console.error(`❌ Login failed: ${loginRes.status}`);
    console.log('📦 Login response:', loginRes.body);
    return;
  }

  // Extract access token
  let accessToken = '';
  try {
    const body = loginRes.json();
    accessToken = body?.data?.access_token || '';
  } catch {
    console.error('🚫 Failed to parse token from login response.');
  }

  if (!accessToken) {
    console.error('🚫 No token received — cannot test /users/me endpoint.');
    return;
  }

  const randWait = randomeSeconds(1, 2);
  sleep(randWait);

  // --- Step 2: Fetch current user (/users/me) ---
  console.log(`🔍 Sending authorized request to: ${meUrl}`);

  const meRes = http.get(meUrl, {
    headers: {
      Accept: 'application/json',
      Authorization: `Bearer ${accessToken}`,
    },
    responseCallback: meCallback,
  });

  // Validate /users/me response
  check(meRes, {
    'me: status is 200 or 401 or 404': (r) =>
      r.status === 200 || r.status === 401 || r.status === 404,

    'me: data present when 200': (r) => {
      if (r.status !== 200) return true; // skip if not 200
      try {
        const body = r.json();
        return body.data && typeof body.data.user_id === 'string';
      } catch {
        return false;
      }
    },

    'me: 401 includes Unauthorized message': (r) => {
      if (r.status !== 401) return true;
      try {
        const body = r.json();
        return (
          (body.message &&
            body.message.toLowerCase().includes('unauthorized')) ||
          body.message.toLowerCase().includes('invalid')
        );
      } catch {
        return false;
      }
    },

    'me: 404 includes "not found"': (r) => {
      if (r.status !== 404) return true;
      try {
        const body = r.json();
        return body.message && body.message.toLowerCase().includes('not found');
      } catch {
        return false;
      }
    },
  });

  console.log(`📦 /users/me response: ${meRes.status} - ${meRes.body}`);

  sleep(randWait);
}

import http from 'k6/http';
import { check, sleep } from 'k6';
import {
  randomeSeconds,
  generateCredentials,
  getUrl,
  options as testOptions
} from '../utils/config.js';

const loginUrl = getUrl('/auth/login');
const logoutUrl = getUrl('/auth/logout-all');

// Shared token across all VUs (set only once by first VU)
let sharedToken = '';

// Response callbacks for expected statuses
const loginSuccessCallback = http.expectedStatuses(201);
const logoutSuccessCallback = http.expectedStatuses(201);

export const options = {
  ...testOptions,
  thresholds: {
    http_req_duration: ['p(95)<500'],
    checks: ['rate>0.95'],
    http_req_failed: ['rate<0.01']
  },
};

export default function () {
  // ONLY VU 1 on iteration 0: Login once, then logout to invalidate token
  console.log('🔐 VU 1: Logging in and logging out to set invalid token...');

  const creds = generateCredentials(true);
  const loginRes = http.post(loginUrl, JSON.stringify(creds), {
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json'
    },
    responseCallback: loginSuccessCallback
  });

  check(loginRes, {
    'login: status 201': (r) => r.status === 201,
    'login: has token': (r) => {
      try {
        return r.json()?.data?.access_token?.length > 0;
      } catch {
        return false;
      }
    }
  });

  try {
    sharedToken = loginRes.json().data.access_token;
    tokenSet = true;
    console.log(`✅ Got token: ${sharedToken.substring(0, 15)}...`);
  } catch (e) {
    console.error('❌ Failed to extract token');
    return;
  }

  sleep(randomeSeconds(1, 2));

  // Logout to invalidate the token
  const logoutRes = http.post(logoutUrl, JSON.stringify({}), {
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
      Authorization: `Bearer ${sharedToken}`
    },
    responseCallback: logoutSuccessCallback
  });

  check(logoutRes, {
    'logout: status 201': (r) => r.status === 201
  });
  sleep(randomeSeconds(0.5, 1.5));
}

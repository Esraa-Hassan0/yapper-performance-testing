// src/bottleneck/following.js
import http from 'k6/http';
import { sleep } from 'k6';
import { Counter } from 'k6/metrics';
import random from '../../utils/random.js';

import {
  email as envEmail,
  password as envPassword,
  generateCredentials,
  getUrl,
  options as testOptions,
} from '../../utils/config.js';

if (__ENV.RAND_SEED) random.seed(__ENV.RAND_SEED);

export const options = {
  ...testOptions,
  insecureSkipTLSVerify: true,
  noConnectionReuse: false,
  thresholds: {
    http_req_failed: ['rate<0.05'],
    http_req_duration: ['p(95)<1000'],
  },
};

const following200 = new Counter('following_200');
const followingHTML = new Counter('following_returns_html'); // ← new
const followingOther = new Counter('following_other');

function logStatus(res, label) {
  console.log(
    `${label} - Status: ${res.status} | VU: ${__VU} | Iter: ${__ITER}`
  );
}

function getCredentials() {
  if (envEmail && envPassword) {
    console.log(`Using real user: ${envEmail}`);
    return { identifier: envEmail, type: 'email', password: envPassword };
  }
  return generateCredentials(false);
}

// Simple float helper
function float(min, max) {
  return min + Math.random() * (max - min);
}

export default function () {
  const headers = { 'Content-Type': 'application/json' };

  // === Login ===
  const creds = getCredentials();
  const loginRes = http.post(getUrl('/auth/login'), JSON.stringify(creds), {
    headers,
    timeout: '60s',
  });
  logStatus(loginRes, 'Login');

  if (![200, 201].includes(loginRes.status)) return;

  const token =
    loginRes.json()?.data?.access_token || loginRes.json()?.access_token;
  if (!token) return;

  const authHeaders = { ...headers, Authorization: `Bearer ${token}` };
  sleep(0.5);

  // === GET /following ===
  const res = http.get(getUrl('/timeline/following'), {
    headers: authHeaders,
    timeout: '30s',
  });
  logStatus(res, 'GET /following');

  // ——— THIS IS THE KEY PART ———
  if (res.status === 200) {
    // Try to parse JSON — if it fails → it's HTML
    let json;
    try {
      json = res.json();
      following200.add(1);
      const count = json?.data?.users?.length || json?.users?.length || 0;
      console.log(`VU ${__VU} | Following → ${count} users`);
    } catch (e) {
      followingHTML.add(1);
      console.error(
        `NOT JSON! Received HTML or invalid JSON. First 400 chars:`
      );
      console.error(res.body.substring(0, 400));
      console.error(`Full headers: ${JSON.stringify(res.headers)}`);
    }
  } else {
    followingOther.add(1);
    console.log(
      `Non-200 response. Body preview: ${res.body.substring(0, 300)}`
    );
  }

  // Cleanup
  http.post(getUrl('/auth/logout'), null, { headers: authHeaders });
  sleep(float(2, 6));
}

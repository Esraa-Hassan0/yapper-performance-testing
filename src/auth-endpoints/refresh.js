// src/bottleneck/refresh.js
import http from 'k6/http';
import { sleep } from 'k6';
import { Counter } from 'k6/metrics';
import random from '../../utils/random.js';

import {
  email as envEmail,
  password as envPassword,
  randomeSeconds,
  generateCredentials,
  getUrl,
  BASE_URL,
  options as testOptions,
} from '../../utils/config.js';

// === Override: Only 500 counts as failed ===
const only500Fails = http.expectedStatuses({ min: 200, max: 499 });

if (__ENV.RAND_SEED) random.seed(__ENV.RAND_SEED);

export const options = {
  ...testOptions,
  insecureSkipTLSVerify: true,
  noConnectionReuse: false,
  thresholds: {
    http_req_failed: ['rate<0.01'], // now tracks ONLY 500s
    http_req_duration: ['p(90)<600', 'p(95)<900'],
    checks: ['rate>0.95'],
  },
};

// Custom counters
const login201 = new Counter('refresh_login_201');
const refreshSuccess = new Counter('refresh_success_2xx');
const refreshInvalid = new Counter('refresh_invalid_4xx');
const refreshUnexpected = new Counter('refresh_unexpected_status');
const refreshJsonFail = new Counter('refresh_json_parse_fail');
const refresh500 = new Counter('refresh_server_500'); // optional, explicit 500 counter

function logStatus(res, label) {
  console.log(
    `${label} | Status: ${res.status} | VU: ${__VU} | Iter: ${__ITER}`
  );
}

function getCredentials(real = true) {
  if (real && envEmail && envPassword) {
    console.log(`Using real user: ${envEmail}`);
    return {
      identifier: envEmail,
      type: 'email',
      password: envPassword,
    };
  }
  return generateCredentials(false);
}

function float(min, max) {
  return min + Math.random() * (max - max);
}

const loginUrl = getUrl('/auth/login');
const refreshUrl = getUrl('/auth/refresh');

export default function () {
  const headers = {
    'Content-Type': 'application/json',
    Accept: 'application/json',
  };

  // ==================================================
  // LOGIN (Refresh cookie stored automatically by k6)
  // ==================================================
  const creds = getCredentials(true);

  const loginRes = http.post(loginUrl, JSON.stringify(creds), {
    headers,
    timeout: '60s',
    responseCallback: only500Fails, // <<< override applied
  });

  logStatus(loginRes, 'Login');

  if (loginRes.status === 500) {
    refresh500.add(1);
  }

  if (loginRes.status === 201) {
    login201.add(1);
  } else {
    refreshUnexpected.add(1);
    return;
  }

  let accessToken = '';
  try {
    accessToken = loginRes.json().data.access_token;
  } catch (err) {
    refreshJsonFail.add(1);
    return;
  }

  sleep(randomeSeconds(1, 2));

  // ==================================================
  // REFRESH
  // ==================================================
  const refreshRes = http.post(refreshUrl, null, {
    headers,
    timeout: '60s',
    responseCallback: only500Fails,
  });

  logStatus(refreshRes, 'Refresh');

  if (refreshRes.status === 500) {
    refresh500.add(1);
  }

  if (refreshRes.status === 200 || refreshRes.status === 201) {
    refreshSuccess.add(1);

    try {
      const json = refreshRes.json();
      const newToken = json?.data?.access_token;

      if (typeof newToken !== 'string' || newToken.length === 0) {
        console.error('Refresh returned invalid token');
      } else if (newToken !== accessToken) {
        console.log(`New token: ${newToken.slice(0, 15)}...`);
      }
    } catch (e) {
      refreshJsonFail.add(1);
    }
  } else {
    refreshUnexpected.add(1);
  }

  sleep(randomeSeconds(1, 2));
}

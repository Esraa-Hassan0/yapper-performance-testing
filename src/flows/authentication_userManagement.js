import http from 'k6/http';
import { check, sleep } from 'k6';
import { Counter } from 'k6/metrics';
import // randEmail,
// randString,
// randInt,
// randSeed,
'../../utils/random.js';
import {
  BASE_URL,
  WAIT_TIME,
  email as envEmail,
  password as envPassword,
  generateCredentials,
  randomeSeconds,
  getUrl,
  options as testOptions,
  generateStrongPassword,
} from '../../utils/config.js';

// Apply random seed if provided (for reproducible tests)
if (__ENV.RAND_SEED) {
  randSeed(Number(__ENV.RAND_SEED));
}

export const options = {
  ...testOptions,
  insecureSkipTLSVerify: true,
  noConnectionReuse: false,
  thresholds: {
    http_req_failed: ['rate<0.01'],
    http_req_duration: ['p(95)<800'],
  },
};

// Custom metrics
const status200 = new Counter('status_200');
const status201 = new Counter('status_201');
const status400 = new Counter('status_400');
const status401 = new Counter('status_401');
const status404 = new Counter('status_404');
const status500 = new Counter('status_500');

function logStatus(res, label) {
  console.log(
    `${label} - Status: ${res.status} | VU: ${__VU} | Iter: ${__ITER}`
  );

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
  }
}

function safeJsonParse(res, label) {
  if (res.status === 0) {
    console.error(`${label} - Connection refused or timeout`);
    return null;
  }

  if (!res.body) {
    console.error(`${label} - Empty response body`);
    return null;
  }

  try {
    return res.json();
  } catch (e) {
    console.error(`${label} - JSON parse failed: ${e.message}`);
    console.error(`Raw body (first 500 chars): ${res.body.substring(0, 500)}`);
    return null;
  }
}

// Updated credential selection logic
function getCredentials() {
  const hasEnvCreds = envEmail && envPassword;

  if (hasEnvCreds) {
    console.log(`Using real user from env: ${envEmail}`);
    return {
      identifier: envEmail,
      type: 'email',
      password: envPassword,
    };
  }

  console.log('No valid env credentials, using generated test user');
  return generateCredentials(false); // false = fake user
}

export default function () {
  const headers = { 'Content-Type': 'application/json' };

  // === TEST 1: Login ===
  const creds = getCredentials();
  console.log(`VU ${__VU} | Login attempt → ${creds.identifier}`);

  const loginPayload = JSON.stringify({
    identifier: creds.identifier,
    password: creds.password,
    type: creds.type,
  });

  const loginRes = http.post(getUrl('/auth/login'), loginPayload, {
    headers,
    timeout: '60s',
  });

  logStatus(loginRes, 'Login');

  const loginData = safeJsonParse(loginRes, 'Login');
  if (!loginData || (loginRes.status !== 200 && loginRes.status !== 201)) {
    console.error(
      `Login failed for ${creds.identifier} | Status: ${loginRes.status}`
    );
    return;
  }

  const token = loginData.data?.access_token || loginData.access_token;
  if (!token) {
    console.error('No access token in login response');
    return;
  }

  const authHeaders = {
    ...headers,
    Authorization: `Bearer ${token}`,
  };

  // Small delay to allow session propagation
  sleep(0.5 + Math.random() * 0.5);

  // === TEST 2: Get Current User ===
  const userRes = http.get(getUrl('/users/me'), {
    headers: authHeaders,
    timeout: '30s',
  });
  logStatus(userRes, 'Get Current User');
  const userData = safeJsonParse(userRes, 'Get Current User');
  const userId = userData?.data?.user_id || userData?.user_id;

  sleep(randomeSeconds(0.5, 2));

  // === TEST 3: Update Profile ===
  const updateRes = http.patch(
    getUrl('/users/me'),
    JSON.stringify({
      bio: `k6 load test - ${Date.now()} - VU${__VU}`,
      location: 'Load Test City',
      display_name: `TestUser_${__VU}_${__ITER}`,
    }),
    { headers: authHeaders, timeout: '30s' }
  );
  logStatus(updateRes, 'Update Profile');
  sleep(randomeSeconds(0.5, 1.5));

  // === TEST 4: Username Recommendations ===
  const recommendRes = http.get(getUrl('/users/me/username-recommendations'), {
    headers: authHeaders,
    timeout: '30s',
  });
  logStatus(recommendRes, 'Username Recommendations');
  sleep(randomeSeconds(0.3, 1));

  // === TEST 5: Check Identifier Availability ===
  const checkRes = http.post(
    getUrl('/auth/check-identifier'),
    JSON.stringify({
      identifier: envEmail,
    }),
    { headers: authHeaders, timeout: '30s' }
  );
  logStatus(checkRes, 'Check Identifier');
  sleep(randomeSeconds(0.3, 1));

  // === TEST 6: Confirm Password ===
  const confirmRes = http.post(
    getUrl('/auth/confirm-password'),
    JSON.stringify({ password: creds.password }),
    { headers: authHeaders, timeout: '30s' }
  );
  logStatus(confirmRes, 'Confirm Password');
  sleep(randomeSeconds(0.5, 1.5));

  // === TEST 7: Get User by ID (if available) ===
  if (userId) {
    const usersRes = http.get(getUrl(`/users?ids=${userId}`), {
      headers: authHeaders,
      timeout: '30s',
    });
    logStatus(usersRes, 'Get Users by ID');
  }
  sleep(randomeSeconds(0.5, 1));

  // === TEST 8: Refresh Token ===
  const refreshRes = http.post(getUrl('/auth/refresh'), null, {
    headers: authHeaders,
    timeout: '30s',
  });
  logStatus(refreshRes, 'Refresh Token');
  sleep(randomeSeconds(0.5, 1));

  // === TEST 9: Captcha Site Key (public endpoint) ===
  const captchaRes = http.get(getUrl('/auth/captcha/site-key'), {
    timeout: '30s',
  });
  logStatus(captchaRes, 'Captcha Site Key');
  sleep(randomeSeconds(0.3, 1));

  // === TEST 10: Logout ===
  const logoutRes = http.post(getUrl('/auth/logout'), null, {
    headers: authHeaders,
    timeout: '30s',
  });
  logStatus(logoutRes, 'Logout');
}

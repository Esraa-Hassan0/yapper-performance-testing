// file: tests/auth/full-signup-login-change.test.js
import http from 'k6/http';
import { check, sleep } from 'k6';
import {
  randomeSeconds,
  getUrl,
  password,
  options as testOptions,
} from '../../utils/config.js';
import { email as randEmail } from '../../utils/random.js';

// --- URLs
const signup1Url = getUrl('/auth/signup/step1');
const signup2Url = getUrl('/auth/signup/step2');
const signup3Url = getUrl('/auth/signup/step3');
const loginUrl = getUrl('/auth/login');
const changePasswordUrl = getUrl('/auth/change-password');

// --- Captcha token placeholder
const captcha_token = '03AGdBq25SxXT-pm...';

// --- K6 options
export const options = {
  ...testOptions,
  insecureSkipTLSVerify: true,
  noConnectionReuse: false,
  thresholds: {
    http_req_failed: ['rate<0.01'],
    http_req_duration: ['p(95)<500'],
    checks: ['rate>0.95'],
  },
};

// --- Helpers
function generateUsername() {
  return `signup_user_${Math.random().toString(36).slice(2, 8)}`;
}

function generateOTP() {
  return String(Math.floor(100000 + Math.random() * 900000)); // 6-digit
}

function generateSignupData() {
  return {
    name: `User ${Math.random().toString(36).substring(7)}`,
    birth_date: '1990-01-15',
    email: randEmail('signup_change_pw'),
    captcha_token,
  };
}

export default function () {
  // ---------------------------------------------------------------------
  // STEP 1: SIGNUP STEP 1 (Send email)
  // ---------------------------------------------------------------------
  const signupData = generateSignupData();
  const signup1Res = http.post(signup1Url, JSON.stringify(signupData), {
    headers: { 'Content-Type': 'application/json' },
    responseCallback: http.expectedStatuses(200, 201, 409),
  });

  check(signup1Res, {
    'step1: status 200/201/409': (r) =>
      r.status === 200 || r.status === 201 || r.status === 409,
  });

  console.log(`Step1 → ${signup1Res.status} | Email: ${signupData.email}`);

  if (signup1Res.status === 409) {
    console.warn(`Email already exists → ${signupData.email} → stopping`);
    return;
  }

  sleep(randomeSeconds(1, 2));

  // ---------------------------------------------------------------------
  // STEP 2: SIGNUP STEP 2 (Verify OTP)
  // OTP can be any 6-digit small characters → using random valid OTP
  // ---------------------------------------------------------------------
  const otp = generateOTP();
  const step2Payload = { email: signupData.email, token: otp };

  const signup2Res = http.post(signup2Url, JSON.stringify(step2Payload), {
    headers: { 'Content-Type': 'application/json' },
    responseCallback: http.expectedStatuses(201, 400, 404),
  });

  check(signup2Res, {
    'step2: status 201': (r) => r.status === 201,
  });

  if (signup2Res.status !== 201) {
    console.error(`Step2 failed → ${signup2Res.status}`);
    return;
  }

  console.log(`Step2 → Email verified: ${signupData.email}`);

  sleep(randomeSeconds(1, 2));

  // ---------------------------------------------------------------------
  // STEP 3: SIGNUP STEP 3 (Create final account)
  // ---------------------------------------------------------------------
  const username = generateUsername();

  const step3Payload = {
    email: signupData.email,
    password: password,
    username: username,
    language: 'en',
  };

  const signup3Res = http.post(signup3Url, JSON.stringify(step3Payload), {
    headers: { 'Content-Type': 'application/json' },
    responseCallback: http.expectedStatuses(200, 201, 409),
  });

  check(signup3Res, {
    'step3: status 200/201': (r) => r.status === 200 || r.status === 201,
  });

  if (!(signup3Res.status === 200 || signup3Res.status === 201)) {
    console.error(`Step3 failed → ${signup3Res.status}`);
    return;
  }

  console.log(
    `Step3 → Account created | Username: ${username} | Email: ${signupData.email}`
  );

  sleep(randomeSeconds(1, 2));

  // ---------------------------------------------------------------------
  // STEP 4: LOGIN AFTER SIGNUP
  // ---------------------------------------------------------------------
  const loginPayload = {
    email: signupData.email,
    password: password,
  };

  const loginRes = http.post(loginUrl, JSON.stringify(loginPayload), {
    headers: { 'Content-Type': 'application/json' },
    responseCallback: http.expectedStatuses(200, 201, 401),
  });

  check(loginRes, {
    'login: status 200/201': (r) => r.status === 200 || r.status === 201,
    'login: token exists': (r) => {
      try {
        return !!r.json()?.data?.access_token;
      } catch {
        return false;
      }
    },
  });

  const token = loginRes.json()?.data?.access_token;
  if (!token) {
    console.error('Login failed — access_token missing');
    return;
  }

  console.log(`Login → success → token: ${token.substring(0, 20)}...`);

  sleep(randomeSeconds(1, 2));

  // ---------------------------------------------------------------------
  // STEP 5: CHANGE PASSWORD
  // ---------------------------------------------------------------------
  const changePayload = {
    old_password: password,
    new_password: password + '1',
  };

  const changeRes = http.post(
    changePasswordUrl,
    JSON.stringify(changePayload),
    {
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`, // why: required for auth
      },
      responseCallback: http.expectedStatuses(200, 201, 401),
    }
  );

  check(changeRes, {
    'change: status 200/201': (r) => r.status === 200 || r.status === 201,
    'change: success message': (r) => {
      try {
        return r.json()?.message?.toLowerCase().includes('success');
      } catch {
        return false;
      }
    },
  });

  console.log(
    `Change password → ${changeRes.status} | Body: ${changeRes.body}`
  );

  sleep(randomeSeconds(1, 2));
}

import http from 'k6/http';
import { check, sleep } from 'k6';
import {
  randomeSeconds,
  generateCredentials,
  getUrl,
  generateStrongPassword,
  options as testOptions
} from '../utils/config.js';

const loginUrl = getUrl('/auth/login');
const changePasswordUrl = getUrl('/auth/change-password');

// Response callbacks for expected statuses
const successCallback = http.expectedStatuses(201);
const unauthorizedCallback = http.expectedStatuses(401);

export const options = {
  ...testOptions,
  thresholds: {
    http_req_failed: ['rate<0.01'], // <1% requests should fail
    http_req_duration: ['p(95)<500'], // 95% of requests <500ms
    checks: ['rate>0.95']
  }
};

export default function () {
  // Step 1: Login to get access token
  const loginPayload = generateCredentials(true); // Use real user from env

  const loginRes = http.post(loginUrl, JSON.stringify(loginPayload), {
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json'
    },
    responseCallback: successCallback
  });

  check(loginRes, {
    'login: status is 201': (r) => r.status === 201,
    'login: has access token': (r) => {
      try {
        const body = r.json();
        return (
          typeof body?.data?.access_token === 'string' &&
          body.data.access_token.length > 0
        );
      } catch {
        return false;
      }
    }
  });

  // Extract access token from login response
  let accessToken = '';
  try {
    const loginBody = loginRes.json();
    accessToken = loginBody?.data?.access_token;
    console.log(`Got token: ${accessToken.substring(0, 20)}...`);
  } catch (e) {
    console.error('Failed to extract token from login response');
    return;
  }

  if (!accessToken) {
    console.error('No access token found in login response');
    return;
  }

  const randWait = randomeSeconds(1, 2);
  sleep(randWait);

  // Step 2: Try to change password with WRONG old password
  const changePasswordPayload = {
    old_password: 'WrongPassword123!@#', // Deliberately wrong password
    new_password: generateStrongPassword(12)
  };

  const changePasswordRes = http.post(
    changePasswordUrl,
    JSON.stringify(changePasswordPayload),
    {
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
        Authorization: `Bearer ${accessToken}` // Add Bearer token
      },
      responseCallback: unauthorizedCallback
    }
  );

  check(changePasswordRes, {
    'wrong password: status is 401': (r) => r.status === 401,
    'wrong password: error message says "Wrong password"': (r) => {
      try {
        const body = r.json();
        return body.message && body.message.toLowerCase().includes('wrong');
      } catch {
        return false;
      }
    }
  });

  console.log(
    `Change password response: ${changePasswordRes.status} - ${changePasswordRes.body}`
  );

  sleep(randWait);
}

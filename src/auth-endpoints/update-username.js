import http from 'k6/http';
import { check, sleep } from 'k6';
import {
  randomeSeconds,
  randString,
  generateCredentials,
  getUrl,
  options as testOptions
} from '../../utils/config.js';

const loginUrl = getUrl('/auth/login');
const updateUsernameUrl = getUrl('/auth/update-username');

// Response callbacks
const successCallback = http.expectedStatuses(200, 201);
const unauthorizedCallback = http.expectedStatuses(401);
const badRequestCallback = http.expectedStatuses(400, 404);

export const options = {
  ...testOptions,
  thresholds: {
    http_req_failed: ['rate<0.05'],
    http_req_duration: ['p(95)<1500'],
    checks: ['rate>0.95']
  },
  cloud: {
    projectID: 5399990
  }
};

/**
 * Helper function to login and get access token
 */
function loginAndGetToken() {
  const loginCreds = generateCredentials(true);
  const loginRes = http.post(loginUrl, JSON.stringify(loginCreds), {
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json'
    },
    responseCallback: http.expectedStatuses(201, 200)
  });

  check(loginRes, {
    'login: status 201': (r) => r.status === 201,
    'login: has access token': (r) => {
      try {
        return r.json()?.data?.access_token?.length > 0;
      } catch {
        return false;
      }
    }
  });

  try {
    const data = loginRes.json().data;
    return data.access_token;
  } catch (e) {
    console.error('Failed to extract token from login');
    return null;
  }
}

/**
 * Generate a valid username (3-30 chars, letters/numbers/underscores)
 */
function generateValidUsername() {
  return `user_${randString(8, 'abcdefghijklmnopqrstuvwxyz0123456789_')}`;
}

/**
 * Helper function to update username with given token and username
 */
function updateUsername(token, username, expectedCallback) {
  const payload = JSON.stringify({ username });
  return http.post(updateUsernameUrl, payload, {
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
      Authorization: `Bearer ${token}`
    },
    responseCallback: expectedCallback
  });
}

export default function () {
  // Login to get access token
  const accessToken = loginAndGetToken();
  if (!accessToken) return;

  sleep(randomeSeconds(0.5, 1));

  const newUsername = generateValidUsername();
  const validRes = updateUsername(accessToken, newUsername, successCallback);
  check(validRes, {
    'valid: status 200 or 201': (r) => r.status === 200 || r.status === 201,
    'valid: username matches': (r) => {
      try {
        return r.json()?.data?.username === newUsername;
      } catch {
        return false;
      }
    }
  });
  sleep(randomeSeconds(1, 2));

  const invalidUsername = generateValidUsername();
  const payload = JSON.stringify({ username: invalidUsername });
  const tokenRes = http.post(updateUsernameUrl, payload, {
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
      Authorization: 'Bearer invalid_token_xyz'
    },
    responseCallback: unauthorizedCallback
  });
  check(tokenRes, {
    'invalid token: status 401': (r) => r.status === 401,
    'invalid token: has error': (r) => {
      try {
        const msg = r.json()?.message?.toLowerCase();
        return msg?.includes('invalid') || msg?.includes('expired');
      } catch {
        return false;
      }
    }
  });
  console.log('Invalid token rejected');
  sleep(randomeSeconds(1, 2));

  const formatRes = updateUsername(accessToken, 'ab', badRequestCallback);
  check(formatRes, {
    'invalid: status 400 or 422': (r) => r.status === 400 || r.status === 422,
    'invalid: has error': (r) => {
      try {
        return r.json()?.message?.length > 0;
      } catch {
        return false;
      }
    }
  });
  sleep(randomeSeconds(1, 2));
}

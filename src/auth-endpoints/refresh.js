import http from 'k6/http';
import { check, sleep } from 'k6';
import { options as testOptions } from '../utils/config.js';
import {
  randomeSeconds,
  generateCredentials,
  getUrl,
  BASE_URL
} from '../utils/config.js';

const loginUrl = getUrl('/auth/login');
const refreshUrl = getUrl('/auth/refresh');

// Response callbacks for expected statuses
const refreshSuccessCallback = http.expectedStatuses(200, 201);
const refreshFailCallback = http.expectedStatuses(400, 401);

export const options = {
  ...testOptions,
  thresholds: {
    http_req_failed: ['rate<0.01'], // <1% requests should fail
    http_req_duration: ['p(90)<600', 'p(95)<900'], // 90% of requests <600ms, 95% <800ms
    checks: ['rate>0.95']
  }
};

export default function () {
  // Step 1: Login to get refresh token in HttpOnly cookies
  const loginCreds = generateCredentials(true);

  const loginRes = http.post(loginUrl, JSON.stringify(loginCreds), {
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json'
    },
    responseCallback: http.expectedStatuses(201)
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

  let accessToken = '';
  try {
    accessToken = loginRes.json().data.access_token;
  } catch (e) {
    console.error('Failed to extract token from login');
    return;
  }

  sleep(randomeSeconds(1, 2));

  // Step 2: Use refresh endpoint with HttpOnly cookies (automatically sent)
  // k6 automatically manages cookies, so the refresh_token cookie from login response
  // will be sent automatically to the refresh endpoint
  const refreshRes = http.post(refreshUrl, null, {
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json'
    },
    responseCallback: refreshSuccessCallback
  });

  check(refreshRes, {
    'refresh: status 200 or 201': (r) => r.status === 200 || r.status === 201,
    'refresh: has new access token': (r) => {
      try {
        const newToken = r.json()?.data?.access_token;
        return typeof newToken === 'string' && newToken.length > 0;
      } catch {
        return false;
      }
    },
    'refresh: message is correct': (r) => {
      try {
        return r.json()?.message?.toLowerCase().includes('new access token');
      } catch {
        return false;
      }
    }
  });

  let newAccessToken = '';
  try {
    newAccessToken = refreshRes.json().data.access_token;
  } catch (e) {
    console.error('Failed to extract new token from refresh');
  }

  // Verify new token is different from old token (to ensure fresh token generated)
  if (newAccessToken && newAccessToken !== accessToken) {
    console.log(`New token generated: ${newAccessToken.substring(0, 15)}...`);
  }

  sleep(randomeSeconds(1, 2));

  // Step 3: Test invalid/expired token scenario
  if (Math.random() < 0.3) {
    console.log('Testing invalid token scenario...');

    // Clear cookies to simulate no refresh token
    http.cookieJar().set(BASE_URL, 'refresh_token', '');

    const invalidRefreshRes = http.post(refreshUrl, null, {
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json'
      },
      responseCallback: refreshFailCallback
    });

    check(invalidRefreshRes, {
      'invalid refresh: status 400 or 401': (r) =>
        r.status === 400 || r.status === 401,
      'invalid refresh: has error message': (r) => {
        try {
          const msg = r.json()?.message?.toLowerCase();
          return (
            msg?.includes('no refresh token') ||
            msg?.includes('invalid') ||
            msg?.includes('expired')
          );
        } catch {
          return false;
        }
      }
    });
  }

  sleep(randomeSeconds(1, 2));
}

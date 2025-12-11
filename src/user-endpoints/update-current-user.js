import http from 'k6/http';
import { check, sleep } from 'k6';
import {
  randomeSeconds,
  generateCredentials,
  getUrl,
  countersStatus,
  secondaryOptions
} from '../../utils/config.js';

const loginUrl = getUrl('/auth/login');
const updateMeUrl = getUrl('/users/me');

// Expected status callbacks
const updateMeCallback = http.expectedStatuses(200, 400, 401);
const { logStatus, counters } = countersStatus();
export const options = secondaryOptions;

// Main test function
export default function () {
  const randWait = randomeSeconds(1, 2);

  // Step 1: Login
  const loginPayload = generateCredentials(true);
  console.log(`Logging in as: ${loginPayload.identifier}`);

  const loginRes = http.post(loginUrl, JSON.stringify(loginPayload), {
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json'
    }
  });
  logStatus(loginRes, 'Step 1 (login)', 'step_1_login');

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
    }
  });

  if (!loginOk) {
    console.error(`Login failed: ${loginRes.status}`);
    console.log('Login response:', loginRes.body);
    return; // Skip the rest of the test for this VU
  }

  // Extract access token
  const body = loginRes.json();
  const accessToken = body?.data?.access_token || '';
  if (!accessToken) {
    console.error('No access token received.');
    return; // Skip the rest of the test for this VU
  }

  sleep(randWait);

  // Step 2: Update current user (/users/me)
  const randomBio = `Random bio ${Math.random().toString(36).substring(7)}`;
  const updatePayload = { bio: randomBio };
  console.log(`Updating user bio to: ${randomBio}`);

  const updateRes = http.patch(updateMeUrl, JSON.stringify(updatePayload), {
    headers: {
      Accept: 'application/json',
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json'
    },
    responseCallback: updateMeCallback
  });

  logStatus(updateRes, 'Step 2 (update current user)', 'step_2_update_me');

  // Validate /users/me update response
  check(updateRes, {
    'update: status is 200': (r) => r.status === 200,
    'update: bio is updated': (r) => {
      try {
        const body = r.json();
        return body.data && body.data.bio === randomBio;
      } catch {
        return false;
      }
    }
  });

  console.log(`/users/me update response body: ${updateRes.body}`);

  sleep(randWait);
}

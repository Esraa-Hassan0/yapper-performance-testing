import http from 'k6/http';
import { check, sleep } from 'k6';
import {
  randomeSeconds,
  generateCredentials,
  getUrl,
  options as testOptions
} from '../utils/config.js';

const url = getUrl('/auth/login');

// Define response callbacks for different scenarios
// Valid request: only 201 is expected
const validCallback = http.expectedStatuses(201);

// Invalid request: 400, 401, 404 are expected (not counted as failures)
const invalidCallback = http.expectedStatuses(400, 401, 404);

export const options = testOptions

export default function () {
  // Test 1: Valid credentials (realUser = true)
  const validCreds = generateCredentials(true);

  const validRes = http.post(url, JSON.stringify(validCreds), {
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json'
    },
    responseCallback: validCallback // Use response callback to exclude from failures
  });

  check(validRes, {
    'valid user: status is 201 created': (r) => r.status === 201,
    'valid user: has token': (r) => {
      try {
        const body = r.json();
        const token = body?.data?.access_token;
        return typeof token === 'string' && token.length > 0;
      } catch {
        return false;
      }
    }
  });

  const randWait = randomeSeconds(1, 2);
  sleep(randWait);

  // Test 2: Invalid credentials (realUser = false - random/fake credentials)
  const invalidCreds = generateCredentials(false);

  const invalidRes = http.post(url, JSON.stringify(invalidCreds), {
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json'
    },
    responseCallback: invalidCallback // Use response callback to exclude from failures
  });

  check(invalidRes, {
    'invalid user: status is 401 or 404': (r) =>
      r.status >= 400 && r.status < 500
  });

  sleep(randWait);
}

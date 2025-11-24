// filepath: tests/getUsersByUsername.test.js
import http from 'k6/http';
import { check, sleep } from 'k6';
import {
  randomeSeconds,
  getUrl,
  options as testOptions
} from '../../utils/config.js';

const url = getUrl('/users/by/username');

const validCallback = http.expectedStatuses(200);
const invalidCallback = http.expectedStatuses(200, 400, 404);

export const options = testOptions;

export default function () {
  // --- Test 1: Valid usernames ---
  const validUsernames = 'alyaa242,amira999';
  const fullValidUrl = `${url}?usernames=${validUsernames}`;
  console.log(`Sending request to: ${fullValidUrl}`);

  const validRes = http.get(fullValidUrl, {
    headers: { Accept: 'application/json' },
    responseCallback: validCallback
  });

  if (validRes.error) {
    console.error('Request failed:', validRes.error);
  } else {
    console.log(`Response status: ${validRes.status}`);
    console.log('Response body:', validRes.body);
  }

  check(validRes, {
    'valid usernames: status is 200': (r) => r.status === 200,
    'valid usernames: contains data array': (r) => {
      try {
        const body = r.json();
        return Array.isArray(body.data);
      } catch {
        return false;
      }
    },
    'valid usernames: at least one success': (r) => {
      try {
        const body = r.json();
        return body.data.some((u) => u.success === true);
      } catch {
        return false;
      }
    }
  });

  const randWait = randomeSeconds(1, 2);
  sleep(randWait);

  // --- Test 2: Invalid usernames ---
  const invalidUsernames = 'user_does_not_exist_123,user_invalid_999';
  const fullInvalidUrl = `${url}?usernames=${invalidUsernames}`;
  console.log(`Sending request to: ${fullInvalidUrl}`);

  const invalidRes = http.get(fullInvalidUrl, {
    headers: { Accept: 'application/json' },
    responseCallback: invalidCallback
  });

  if (invalidRes.error) {
    console.error('Invalid request failed:', invalidRes.error);
  } else {
    console.log(`Invalid response status: ${invalidRes.status}`);
    console.log('Invalid response body:', invalidRes.body);
  }

  check(invalidRes, {
    'invalid usernames: status is 200': (r) => r.status === 200,
    'invalid usernames: contains data array': (r) => {
      try {
        const body = r.json();
        return Array.isArray(body.data);
      } catch {
        return false;
      }
    },
    'invalid usernames: all records failed': (r) => {
      try {
        const body = r.json();
        return body.data.every((u) => u.success === false);
      } catch {
        return false;
      }
    }
  });

  sleep(randWait);
}

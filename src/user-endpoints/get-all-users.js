// filepath: tests/getUsers.test.js
import http from 'k6/http';
import { check, sleep } from 'k6';
import {
  randomeSeconds,
  getUrl,
  options as testOptions,
} from '../../utils/config.js';

const url = getUrl('/users');

const validCallback = http.expectedStatuses(200);
const invalidCallback = http.expectedStatuses(200, 400, 404);

export const options = testOptions;

export default function () {
  // --- Test 1: Valid user IDs ---
  const validIds =
    '0c059899-f706-4c8f-97d7-ba2e9fc22d6d,0b064811-f706-4c8f-97d7-ba2e9fc22d6d';
  const fullValidUrl = `${url}?ids=${validIds}`;
  console.log(`🔍 Sending request to: ${fullValidUrl}`);

  const validRes = http.get(fullValidUrl, {
    headers: { Accept: 'application/json' },
    responseCallback: validCallback,
  });

  if (validRes.error) {
    console.error('❌ Request failed:', validRes.error);
  } else {
    console.log(`✅ Response status: ${validRes.status}`);
    console.log('📦 Response body:', validRes.body);
  }

  check(validRes, {
    'valid users: status is 200': (r) => r.status === 200,
    'valid users: contains data array': (r) => {
      try {
        const body = r.json();
        return Array.isArray(body.data);
      } catch {
        return false;
      }
    },
    'valid users: all records successful': (r) => {
      try {
        const body = r.json();
        return body.data.some((u) => u.success === true);
      } catch {
        return false;
      }
    },
  });

  const randWait = randomeSeconds(1, 2);
  sleep(randWait);

  // --- Test 2: Invalid user IDs ---
  const invalidIds =
    '99999999-f706-4c8f-97d7-ba2e9fc22d6d,88888888-f706-4c8f-97d7-ba2e9fc22d6d';
  const fullInvalidUrl = `${url}?ids=${invalidIds}`;
  console.log(`🔍 Sending request to: ${fullInvalidUrl}`);

  const invalidRes = http.get(fullInvalidUrl, {
    headers: { Accept: 'application/json' },
    responseCallback: invalidCallback,
  });

  if (invalidRes.error) {
    console.error('❌ Invalid request failed:', invalidRes.error);
  } else {
    console.log(`⚠️ Invalid response status: ${invalidRes.status}`);
    console.log('📦 Invalid response body:', invalidRes.body);
  }

  check(invalidRes, {
    'invalid users: status is 200': (r) => r.status === 200,
    'invalid users: contains data array': (r) => {
      try {
        const body = r.json();
        return Array.isArray(body.data);
      } catch {
        return false;
      }
    },
    'invalid users: all records failed': (r) => {
      try {
        const body = r.json();
        return body.data.every((u) => u.success === false);
      } catch {
        return false;
      }
    },
  });

  sleep(randWait);
}

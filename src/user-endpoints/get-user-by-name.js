import http from 'k6/http';
import { check, sleep } from 'k6';
import {
  randomeSeconds,
  getUrl,
  countersStatus,
  secondaryOptions,
} from '../../utils/config.js';

const url = getUrl('/users/by/username');
const validCallback = http.expectedStatuses(200);

export const options = secondaryOptions;

// Initialize counters and logStatus function
const { logStatus, counters } = countersStatus();

export default function () {
  // TEST 1: Valid usernames
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
    logStatus(validRes, 'Test 1 (valid usernames)', 'test_1_valid_usernames');
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
}

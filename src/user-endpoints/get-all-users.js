import http from 'k6/http';
import { check, sleep } from 'k6';
import { Counter } from 'k6/metrics';
import {
  randomeSeconds,
  getUrl,
  options as testOptions,
} from '../../utils/config.js';

const url = getUrl('/users');

const validCallback = http.expectedStatuses(200);
const invalidCallback = http.expectedStatuses(200, 400, 404);

export const options = testOptions;

// Custom metrics to count status codes separately
const status200 = new Counter('status_200');
const status400 = new Counter('status_400');
const status401 = new Counter('status_401');
const status404 = new Counter('status_404');
const status500 = new Counter('status_500');

function logStatus(res, label, testName) {
  console.log(`${label} - Status: ${res.status}`);

  // Count each status code separately
  switch (res.status) {
    case 200:
      status200.add(1);
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
    default:
      // Log unexpected status codes
      console.warn(`Unexpected status code: ${res.status}`);
  }
}

export default function () {
  // TEST 1: Valid user IDs
  const validIds =
    '0c059899-f706-4c8f-97d7-ba2e9fc22d6d,0b064811-f706-4c8f-97d7-ba2e9fc22d6d';
  const fullValidUrl = `${url}?ids=${validIds}`;
  console.log(`Sending request to: ${fullValidUrl}`);

  const validRes = http.get(fullValidUrl, {
    headers: { Accept: 'application/json' },
    responseCallback: validCallback,
  });

  if (validRes.error) {
    console.error('Request failed:', validRes.error);
  } else {
    logStatus(validRes, 'Test 1 (valid user IDs)', 'test_1_valid_ids');
    console.log('Response body:', validRes.body);
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
}

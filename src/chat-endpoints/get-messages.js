import http from 'k6/http';
import { check, sleep } from 'k6';
import { Counter } from 'k6/metrics';
import { int as randInt } from '../../utils/random.js';
import {
  randomeSeconds,
  generateCredentials,
  getUrl,
  options as testOptions,
} from '../../utils/config.js';

const loginUrl = getUrl('/auth/login');
const targetChatId = __ENV.TARGET_CHAT_ID || null;

export const options = {
  ...testOptions,
  thresholds: {
    http_req_failed: ['rate<0.05'],
    http_req_duration: ['p(95)<1000'],
    checks: ['rate>0.95'],
  },
};

// Custom metrics to count status codes separately
const status200 = new Counter('status_200');
const status201 = new Counter('status_201');
const status400 = new Counter('status_400');
const status401 = new Counter('status_401');
const status403 = new Counter('status_403');
const status404 = new Counter('status_404');
const status500 = new Counter('status_500');

function logStatus(res, label, testName) {
  console.log(`${label} - Status: ${res.status}`);

  // Count each status code separately
  switch (res.status) {
    case 200:
      status200.add(1);
      break;
    case 201:
      status201.add(1);
      break;
    case 400:
      status400.add(1);
      break;
    case 401:
      status401.add(1);
      break;
    case 403:
      status403.add(1);
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

function loginAndGetToken() {
  const creds = generateCredentials(true);
  console.log('Login creds:', creds);

  const res = http.post(loginUrl, JSON.stringify(creds), {
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    responseCallback: http.expectedStatuses(201),
  });

  logStatus(res, 'Login', 'login');

  try {
    return res.json().data.access_token;
  } catch (e) {
    console.error('Login failed');
    return null;
  }
}

export default function () {
  // Login
  const token = loginAndGetToken();
  if (!token) return;

  sleep(randomeSeconds(1, 2));

  if (!targetChatId) {
    console.log('TARGET_CHAT_ID not provided; skipping chat messages tests');
    return;
  }

  // TEST 1: Get chat messages (default pagination)
  const chatMessagesUrl = getUrl(`/messages/chats/${targetChatId}/messages`);
  const res1 = http.get(chatMessagesUrl, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
    responseCallback: http.expectedStatuses(200, 403, 404),
  });

  check(res1, {
    'default messages: status 200, 403, or 404': (r) =>
      r.status === 200 || r.status === 403 || r.status === 404,
    'default messages: has data when 200': (r) => {
      if (r.status !== 200) return true;
      try {
        const body = r.json();
        return body.data && Array.isArray(body.data.messages);
      } catch {
        return false;
      }
    },
  });

  logStatus(res1, 'Test 1 (default messages)', 'test_1_default');
  console.log('Test 1 Response:', res1.body);
  sleep(randomeSeconds(1, 2));

  // TEST 2: Get chat messages with custom limit
  const limit = randInt(10, 50);
  const res2 = http.get(`${chatMessagesUrl}?limit=${limit}`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
    responseCallback: http.expectedStatuses(200, 403, 404),
  });

  check(res2, {
    'custom limit: status 200, 403, or 404': (r) =>
      r.status === 200 || r.status === 403 || r.status === 404,
    'custom limit: has data when 200': (r) => {
      if (r.status !== 200) return true;
      try {
        const body = r.json();
        return body.data && Array.isArray(body.data.messages);
      } catch {
        return false;
      }
    },
  });

  logStatus(res2, `Test 2 (limit=${limit})`, 'test_2_limit');
  console.log(`Test 2 Response (limit=${limit}):`, res2.body);
  sleep(randomeSeconds(1, 2));

  // TEST 3: Get chat messages with cursor pagination (if available)
  let cursor = null;
  try {
    if (res1.status === 200) {
      cursor = res1.json()?.data?.pagination?.next_cursor;
    }
  } catch (e) {
    // No cursor available
  }

  if (cursor) {
    const res3 = http.get(`${chatMessagesUrl}?cursor=${cursor}&limit=20`, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
      responseCallback: http.expectedStatuses(200, 403, 404),
    });

    check(res3, {
      'cursor pagination: status 200, 403, or 404': (r) =>
        r.status === 200 || r.status === 403 || r.status === 404,
      'cursor pagination: has data when 200': (r) => {
        if (r.status !== 200) return true;
        try {
          const body = r.json();
          return body.data && Array.isArray(body.data.messages);
        } catch {
          return false;
        }
      },
    });

    logStatus(res3, 'Test 3 (cursor pagination)', 'test_3_cursor');
    console.log('Test 3 Response (cursor pagination):', res3.body);
    sleep(randomeSeconds(1, 2));
  } else {
    console.log('Test 3: Skipped - no cursor available or chat not accessible');
  }

  
}
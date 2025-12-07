import http from 'k6/http';
import { check, sleep } from 'k6';
import { Counter } from 'k6/metrics';
import { string as randString } from '../../utils/random.js';
import {
  randomeSeconds,
  generateCredentials,
  getUrl,
  options as testOptions,
} from '../../utils/config.js';

const loginUrl = getUrl('/auth/login');
const createTweetUrl = getUrl('/tweets');

export const options = {
  ...testOptions,
  thresholds: {
    http_req_failed: ['rate<0.05'],
    http_req_duration: ['p(95)<1500'],
    checks: ['rate>0.95'],
  },
};

// Custom metrics to count status codes separately
const status200 = new Counter('status_200');
const status201 = new Counter('status_201');
const status204 = new Counter('status_204');
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
    case 204:
      status204.add(1);
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

function generateTweetContent() {
  const randomPart = randString(8);
  return `Test tweet ${randomPart} - Load testing from k6`;
}

export default function () {
  // Login
  const token = loginAndGetToken();
  if (!token) return;

  sleep(randomeSeconds(1, 2));

  // TEST 1: Create a tweet
  const tweetContent1 = generateTweetContent();
  const payload1 = JSON.stringify({
    content: tweetContent1,
  });

  const createRes = http.post(createTweetUrl, payload1, {
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
      Authorization: `Bearer ${token}`,
    },
    responseCallback: http.expectedStatuses(201),
  });

  check(createRes, {
    'create: status 201': (r) => r.status === 201,
  });

  logStatus(createRes, 'Test 1 (create tweet)', 'test_1_create');
  console.log(`Created tweet: "${tweetContent1}"`);

  let tweetId = null;
  try {
    tweetId = createRes.json().data.tweet_id;
    console.log(`Tweet ID: ${tweetId}`);
  } catch (e) {
    console.error('Failed to get tweet ID from response');
    console.log('Create response:', createRes.body);
    return;
  }

  sleep(randomeSeconds(1, 2));

  // TEST 2: Delete the tweet
  const deleteTweetUrl = getUrl(`/tweets/${tweetId}`);
  const deleteRes = http.del(deleteTweetUrl, null, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
    responseCallback: http.expectedStatuses(204),
  });

  check(deleteRes, {
    'delete: status 204': (r) => r.status === 204,
  });

  logStatus(deleteRes, 'Test 2 (delete tweet)', 'test_2_delete');
  console.log('Tweet deleted successfully');
  console.log('Delete response:', deleteRes.body);
  sleep(randomeSeconds(1, 2));

 
 
}
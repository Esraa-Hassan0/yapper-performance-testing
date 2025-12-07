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

export const options = testOptions;

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
  return `This is a test tweet ${randomPart}`;
}

export default function () {
  // Login
  const token = loginAndGetToken();
  if (!token) return;

  sleep(randomeSeconds(1, 2));

  // TEST 1: Create a tweet
  const tweetContent = generateTweetContent();
  const createPayload = JSON.stringify({
    content: tweetContent,
  });

  const createRes = http.post(createTweetUrl, createPayload, {
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

  let tweetId = null;
  try {
    tweetId = createRes.json().data.tweet_id;
    console.log(`Created tweet with ID: ${tweetId}`);
    console.log(`Content: "${tweetContent}"`);
  } catch (e) {
    console.error('Failed to get tweet ID from response');
    return;
  }

  sleep(randomeSeconds(1, 2));

  // TEST 2: Like the tweet
  const likeUrl = getUrl(`/tweets/${tweetId}/like`);
  const likeRes = http.post(likeUrl, null, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
    responseCallback: http.expectedStatuses(204),
  });

  check(likeRes, {
    'like: status 204': (r) => r.status === 204,
  });

  logStatus(likeRes, 'Test 2 (like tweet)', 'test_2_like');
  console.log('Liked tweet successfully');
  console.log('Like response:', likeRes.body);
  sleep(randomeSeconds(1, 2));

  // TEST 3: Unlike the tweet
  const unlikeRes = http.del(likeUrl, null, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
    responseCallback: http.expectedStatuses(204),
  });

  check(unlikeRes, {
    'unlike: status 204': (r) => r.status === 204,
  });

  logStatus(unlikeRes, 'Test 3 (unlike tweet)', 'test_3_unlike');
  console.log('Unliked tweet successfully');
  console.log('Unlike response:', unlikeRes.body);
  sleep(randomeSeconds(1, 2));
}

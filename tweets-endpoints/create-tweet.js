import http from 'k6/http';
import { check, sleep } from 'k6';
import { string as randString } from '../utils/random.js';
import {
  randomeSeconds,
  generateCredentials,
  getUrl,
  options as testOptions
} from '../utils/config.js';

const imagePath = open('../test-data/image.png', 'b');

const loginUrl = getUrl('/auth/login');
const createTweetUrl = getUrl('/tweets');

export const options = {
    ...testOptions,
    thresholds: {
        http_req_failed: ['rate<0.05'],
        http_req_duration: ['p(95)<1500'],
        checks: ['rate>0.95']
    }
}

function loginAndGetToken() {
  const creds = generateCredentials(true);
  const res = http.post(loginUrl, JSON.stringify(creds), {
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json'
    },
    responseCallback: http.expectedStatuses(201)
  });

  try {
    return res.json().data.access_token;
  } catch (e) {
    console.error('❌ Login failed');
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

  // TEST 1: Create tweet with only content
  const tweetContent1 = generateTweetContent();
  const payload1 = JSON.stringify({
    content: tweetContent1
  });

  const res1 = http.post(createTweetUrl, payload1, {
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
      Authorization: `Bearer ${token}`
    },
    responseCallback: http.expectedStatuses(201)
  });

  check(res1, {
    'status 201': (r) => r.status === 201
  });

  console.log('📦 Test 1 Response (text only):', res1.body);
  sleep(randomeSeconds(1, 2));

  // TEST 2: Create tweet with image
  const tweetContent2 = generateTweetContent();

  const formData2 = {
    content: tweetContent2,
    image: http.file(imagePath, 'image.png', 'image/png')
  };

  const res2 = http.post(createTweetUrl, formData2, {
    headers: {
      Authorization: `Bearer ${token}`
    },
    responseCallback: http.expectedStatuses(201)
  });

  check(res2, {
    'status 201': (r) => r.status === 201
  });

  console.log('📦 Test 2 Response (with image):', res2.body);
  sleep(randomeSeconds(1, 2));

  // TEST 3: Invalid token -> expect 401
  const tweetContent3 = generateTweetContent();
  const payload3 = JSON.stringify({
    content: tweetContent3
  });

  const res3 = http.post(createTweetUrl, payload3, {
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
      Authorization: 'Bearer invalid'
    },
    responseCallback: http.expectedStatuses(401)
  });

  check(res3, {
    'status 401': (r) => r.status === 401
  });

  console.log('📦 Test 3 Response (invalid token):', res3.body);
  sleep(randomeSeconds(0.5, 1.5));

  // TEST 4: Empty content -> expect 400
  const payload4 = JSON.stringify({
    content: ''
  });

  const res4 = http.post(createTweetUrl, payload4, {
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
      Authorization: `Bearer ${token}`
    },
    responseCallback: http.expectedStatuses(400, 201)
  });

  check(res4, {
    'status 400 or 201': (r) => r.status === 400 || r.status === 201
  });

  console.log('📦 Test 4 Response (empty content):', res4.status, res4.body);
  sleep(randomeSeconds(0.5, 1.5));
}

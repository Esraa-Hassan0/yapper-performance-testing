import http from 'k6/http';
import { check, sleep } from 'k6';
import { string as randString } from '../utils/random.js';
import {
  randomeSeconds,
  generateCredentials,
  getUrl,
  options as testOptions
} from '../utils/config.js';

const loginUrl = getUrl('/auth/login');
const createTweetUrl = getUrl('/tweets');

export const options = testOptions;

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
    content: tweetContent
  });

  const createRes = http.post(createTweetUrl, createPayload, {
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
      Authorization: `Bearer ${token}`
    },
    responseCallback: http.expectedStatuses(201)
  });

  check(createRes, {
    'create: status 201': (r) => r.status === 201
  });

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

  // TEST 2: Repost the tweet
  const repostUrl = getUrl(`/tweets/${tweetId}/repost`);
  const repostRes = http.post(repostUrl, null, {
    headers: {
      Authorization: `Bearer ${token}`
    },
    responseCallback: http.expectedStatuses(201)
  });

  check(repostRes, {
    'repost: status 201': (r) => r.status === 201
  });

  console.log('Reposted tweet successfully');
  console.log('Repost response:', repostRes.body);
  sleep(randomeSeconds(1, 2));

  // TEST 3: Try to repost same tweet again -> expect 400 (already reposted)
  const repost400Res = http.post(repostUrl, null, {
    headers: {
      Authorization: `Bearer ${token}`
    },
    responseCallback: http.expectedStatuses(400, 409)
  });

  check(repost400Res, {
    'repost again: status 400 or 409': (r) =>
      r.status === 400 || r.status === 409
  });

  console.log('Already reposted response:', repost400Res.body);
  sleep(randomeSeconds(1, 2));

  // TEST 4: Repost non-existent tweet -> expect 404
  const fakeTweetId = 'ffffffff-ffff-ffff-ffff-ffffffffffff';
  const repost404Url = getUrl(`/tweets/${fakeTweetId}/repost`);
  const res404 = http.post(repost404Url, null, {
    headers: {
      Authorization: `Bearer ${token}`
    },
    responseCallback: http.expectedStatuses(404)
  });

  check(res404, {
    'status 404': (r) => r.status === 404
  });

  console.log('Non-existent tweet response:', res404.body);
  sleep(randomeSeconds(0.5, 1.5));

  // TEST 5: Repost with invalid token -> expect 401
  const res401 = http.post(repostUrl, null, {
    headers: {
      Authorization: 'Bearer invalid'
    },
    responseCallback: http.expectedStatuses(401)
  });

  check(res401, {
    'status 401': (r) => r.status === 401
  });

  console.log('Invalid token response:', res401.body);
  sleep(randomeSeconds(0.5, 1.5));
}

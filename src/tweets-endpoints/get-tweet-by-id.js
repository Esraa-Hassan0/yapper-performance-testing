import http from 'k6/http';
import { check, sleep } from 'k6';
import { string as randString } from '../../utils/random.js';
import {
  randomeSeconds,
  generateCredentials,
  getUrl,
  options as testOptions
} from '../../utils/config.js';

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
  const payload = JSON.stringify({
    content: tweetContent
  });

  const createRes = http.post(createTweetUrl, payload, {
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

  // TEST 2: Get the tweet by ID
  const getTweetUrl = getUrl(`/tweets/${tweetId}`);
  const getRes = http.get(getTweetUrl, {
    headers: {
      Authorization: `Bearer ${token}`
    },
    responseCallback: http.expectedStatuses(200)
  });

  check(getRes, {
    'get: status 200': (r) => r.status === 200,
    'get: content matches': (r) => {
      try {
        return r.json().data.content === tweetContent;
      } catch {
        return false;
      }
    },
    'get: tweet_id matches': (r) => {
      try {
        return r.json().data.tweet_id === tweetId;
      } catch {
        return false;
      }
    }
  });

  console.log('Retrieved tweet:', getRes.body);
  sleep(randomeSeconds(1, 2));

  // TEST 3: Get non-existent tweet -> expect 404
  const fakeTweetId = 'ffffffff-ffff-ffff-ffff-ffffffffffff';
  const get404Url = getUrl(`/tweets/${fakeTweetId}`);
  const res404 = http.get(get404Url, {
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

  // TEST 4: Invalid token -> expect 401
  const res401 = http.get(getTweetUrl, {
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

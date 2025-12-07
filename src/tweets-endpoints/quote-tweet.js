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
    case 201:
      status201.add(1);
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

  // TEST 1: Create an original tweet
  const originalContent = generateTweetContent();
  const createPayload = JSON.stringify({
    content: originalContent,
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

  logStatus(createRes, 'Test 1 (create original tweet)', 'test_1_create');

  let tweetId = null;
  try {
    tweetId = createRes.json().data.tweet_id;
    console.log(`Created original tweet with ID: ${tweetId}`);
    console.log(`Original content: "${originalContent}"`);
  } catch (e) {
    console.error('Failed to get tweet ID from response');
    return;
  }

  sleep(randomeSeconds(1, 2));

  // TEST 2: Quote the tweet with commentary
  const quoteContent = `Quote: ${generateTweetContent()}`;
  const quotePayload = JSON.stringify({
    content: quoteContent,
  });

  const quoteUrl = getUrl(`/tweets/${tweetId}/quote`);
  const quoteRes = http.post(quoteUrl, quotePayload, {
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
      Authorization: `Bearer ${token}`,
    },
    responseCallback: http.expectedStatuses(201),
  });

  check(quoteRes, {
    'quote: status 201': (r) => r.status === 201,
    'quote: type is quote': (r) => {
      try {
        return r.json().data.type === 'quote';
      } catch {
        return false;
      }
    },
    'quote: has quoted_tweet': (r) => {
      try {
        return r.json().data.quoted_tweet.tweet_id === tweetId;
      } catch {
        return false;
      }
    },
  });

  logStatus(quoteRes, 'Test 2 (quote tweet)', 'test_2_quote');
  console.log('Quote tweet created successfully');
  console.log(`Quote content: "${quoteContent}"`);
  console.log('Quote response:', quoteRes.body);
  sleep(randomeSeconds(1, 2));
}

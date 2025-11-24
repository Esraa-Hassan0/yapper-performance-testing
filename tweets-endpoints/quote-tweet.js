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

  // TEST 1: Create an original tweet
  const originalContent = generateTweetContent();
  const createPayload = JSON.stringify({
    content: originalContent
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
    content: quoteContent
  });

  const quoteUrl = getUrl(`/tweets/${tweetId}/quote`);
  const quoteRes = http.post(quoteUrl, quotePayload, {
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
      Authorization: `Bearer ${token}`
    },
    responseCallback: http.expectedStatuses(201)
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
    }
  });

  console.log('Quote tweet created successfully');
  console.log(`Quote content: "${quoteContent}"`);
  console.log('Quote response:', quoteRes.body);
  sleep(randomeSeconds(1, 2));

  // TEST 3: Quote non-existent tweet -> expect 404
  const fakeTweetId = 'ffffffff-ffff-ffff-ffff-ffffffffffff';
  const quote404Url = getUrl(`/tweets/${fakeTweetId}/quote`);
  const res404 = http.post(quote404Url, quotePayload, {
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
      Authorization: `Bearer ${token}`
    },
    responseCallback: http.expectedStatuses(404)
  });

  check(res404, {
    'status 404': (r) => r.status === 404
  });

  console.log('Non-existent tweet response:', res404.body);
  sleep(randomeSeconds(0.5, 1.5));

  // TEST 4: Quote with invalid token -> expect 401
  const res401 = http.post(quoteUrl, quotePayload, {
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
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

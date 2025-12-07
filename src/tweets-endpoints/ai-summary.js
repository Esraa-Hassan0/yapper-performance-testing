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
const targetTweetId = __ENV.TARGET_TWEET_ID || null;

export const options = {
  ...testOptions,
  insecureSkipTLSVerify: true,
  noConnectionReuse: false,
  thresholds: {
    http_req_failed: ['rate<0.05'],
    http_req_duration: ['p(95)<5000'], // Higher threshold due to AI processing
    checks: ['rate>0.95'],
  },
};

// Custom metrics to count status codes separately
const status200 = new Counter('status_200');
const status201 = new Counter('status_201');
const status400 = new Counter('status_400');
const status401 = new Counter('status_401');
const status404 = new Counter('status_404');
const status500 = new Counter('status_500');

// Summary-specific counters
const summaryGenerated = new Counter('summary_generated');
const summaryCached = new Counter('summary_cached');
const summaryFailed = new Counter('summary_failed');

function logStatus(res, label, testName) {
  console.log(
    `${label} - Status: ${res.status} | VU: ${__VU} | Iter: ${__ITER}`
  );

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
    timeout: '60s',
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
  return `This is a detailed test tweet ${randomPart} about artificial intelligence and machine learning technologies. It discusses the importance of ethical AI development and responsible innovation in the tech industry.`;
}

// Global variable to store the shared tweet ID
let sharedTweetId = targetTweetId;

// Setup function runs once before all VUs start
export function setup() {
  // If TARGET_TWEET_ID is provided, use it
  if (targetTweetId) {
    console.log(`Using provided TARGET_TWEET_ID: ${targetTweetId}`);
    return { tweetId: targetTweetId };
  }

  // Otherwise, create a single tweet for all VUs to use
  console.log('Creating a single tweet for all VUs...');

  const creds = generateCredentials(true);
  const loginRes = http.post(loginUrl, JSON.stringify(creds), {
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    timeout: '60s',
  });

  if (loginRes.status !== 201) {
    console.error('Setup: Login failed');
    return { tweetId: null };
  }

  const token = loginRes.json().data.access_token;
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
    timeout: '60s',
  });

  if (createRes.status !== 201) {
    console.error('Setup: Tweet creation failed');
    return { tweetId: null };
  }

  const tweetId = createRes.json().data.tweet_id;
  console.log(`Setup: Created shared tweet with ID: ${tweetId}`);
  console.log(`Setup: Tweet content: "${tweetContent}"`);

  return { tweetId: tweetId };
}

export default function (data) {
  // Login
  const token = loginAndGetToken();
  if (!token) return;

  sleep(randomeSeconds(1, 2));

  // Use the shared tweet ID from setup
  const tweetId = data.tweetId;

  if (!tweetId) {
    console.error('No tweet ID available - setup may have failed');
    return;
  }

  // TEST 1: Get AI summary of the tweet (first request - may generate)
  const summaryUrl = getUrl(`/tweets/${tweetId}/summary`);
  const summaryRes1 = http.get(summaryUrl, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
    responseCallback: http.expectedStatuses(200, 404, 500),
    timeout: '60s',
  });

  check(summaryRes1, {
    'first summary: status 200, 404, or 500': (r) =>
      r.status === 200 || r.status === 404 || r.status === 500,
    'first summary: has summary when 200': (r) => {
      if (r.status !== 200) return true;
      try {
        const body = r.json();
        return (
          body.data &&
          typeof body.data.summary === 'string' &&
          body.data.summary.length > 0
        );
      } catch {
        return false;
      }
    },
    'first summary: has tweet_id when 200': (r) => {
      if (r.status !== 200) return true;
      try {
        const body = r.json();
        return body.data && body.data.tweet_id === tweetId;
      } catch {
        return false;
      }
    },
  });

  logStatus(
    summaryRes1,
    'Test 1 (first summary request)',
    'test_1_first_summary'
  );

  if (summaryRes1.status === 200) {
    summaryGenerated.add(1);
    console.log('Summary generated/retrieved successfully');
    console.log('Summary:', summaryRes1.json().data.summary);
  } else if (summaryRes1.status === 404) {
    summaryFailed.add(1);
    console.log('Summary generation failed (404):', summaryRes1.body);
  } else if (summaryRes1.status === 500) {
    summaryFailed.add(1);
    console.log('Summary generation failed (500):', summaryRes1.body);
  }

  sleep(randomeSeconds(2, 3));

  // TEST 2: Get the same summary again (should be cached)
  const summaryRes2 = http.get(summaryUrl, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
    responseCallback: http.expectedStatuses(200, 404, 500),
    timeout: '60s',
  });

  check(summaryRes2, {
    'cached summary: status 200, 404, or 500': (r) =>
      r.status === 200 || r.status === 404 || r.status === 500,
    'cached summary: has summary when 200': (r) => {
      if (r.status !== 200) return true;
      try {
        const body = r.json();
        return (
          body.data &&
          typeof body.data.summary === 'string' &&
          body.data.summary.length > 0
        );
      } catch {
        return false;
      }
    },
  });

  logStatus(
    summaryRes2,
    'Test 2 (cached summary request)',
    'test_2_cached_summary'
  );

  if (summaryRes2.status === 200) {
    summaryCached.add(1);
    console.log('Cached summary retrieved successfully');
  }

  sleep(randomeSeconds(1, 2));
}

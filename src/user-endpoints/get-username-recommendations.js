import http from 'k6/http';
import { check, sleep } from 'k6';
import {
  randomeSeconds,
  getUrl,
  countersStatus,
  secondaryOptions,
  generateCredentials
} from '../../utils/config.js';

const usernameRecommendationsUrl = getUrl('/users/me/username-recommendations');
const loginUrl = getUrl('/auth/login');
const { logStatus, counters } = countersStatus();

export const options = {
  ...secondaryOptions,
};

// Setup function to log in and get the token
export function setup() {
  const creds = generateCredentials(true);
  console.log('Logging in with credentials:', creds);

  const res = http.post(loginUrl, JSON.stringify(creds), {
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json'
    }
  });

  logStatus(res, 'Login', 'setup_login');

  const body = res.json();
  const token = body?.data?.access_token;

  if (!token) {
    throw new Error('Failed to log in and retrieve token');
  }

  console.log('Token retrieved:', token);
  return { token };
}

export default function (data) {
  const token = data.token; // Use the token from setup
  const headers = {
    Authorization: `Bearer ${token}`
  };

  console.log('Fetching username recommendations...');

  const res = http.get(usernameRecommendationsUrl, { headers });

  logStatus(
    res,
    'Getting username recommendations',
    'get_username_recommendations'
  );
  console.log('Username recommendations response status:', res.status);
  console.log('Username recommendations response body:', res.body);

  check(res, {
    'username recommendations status is 200': (r) => r.status === 200,
    'username recommendations success message': (r) => {
      try {
        if (!r.body || r.status === 0) return false;
        const body = r.json();
        return (
          body.message === 'Username recommendations retrieved successfully'
        );
      } catch {
        return false;
      }
    },
    'username recommendations has data': (r) => {
      try {
        if (!r.body || r.status === 0) return false;
        const body = r.json();
        return (
          body.data &&
          body.data.recommendations &&
          body.data.recommendations.length > 0
        );
      } catch {
        return false;
      }
    }
  });

  if (res.status >= 400 && res.status < 500) {
    console.error(
      `Username Recommendations Response: ${res.body} with status code: ${res.status}`
    );
  } else if (res.status === 201) {
    console.log('Username recommendations retrieved successfully.');
    try {
      const body = res.json();
      console.log('Recommendations:', body.data.recommendations);
    } catch {
      console.log('Could not parse recommendations from response');
    }
  }

  console.log('Get username recommendations operation completed.');

  // Simulate real user behavior with random sleep
  const randWait = randomeSeconds(1, 2);
  sleep(randWait);
}

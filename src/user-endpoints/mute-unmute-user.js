import http from 'k6/http';
import { check, sleep } from 'k6';
import {
  randomeSeconds,
  getUrl,
  countersStatus,
  secondaryOptions,
  validUserIds,
  generateCredentials
} from '../../utils/config.js';

const muteUrl = getUrl('/users'); // Base URL for mute/unmute endpoints
const loginUrl = getUrl('/auth/login');
const { logStatus, counters } = countersStatus();

export const options = secondaryOptions;

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

  // Select a random user ID from the list, ensuring it's not the current user
  const userId = validUserIds.filter((id) => id !== 'myId')[
    Math.floor(Math.random() * (validUserIds.length - 1))
  ];

  // Mute the user
  const muteRes = http.post(`${muteUrl}/${userId}/mute`, null, {
    headers: {
      Accept: 'application/json',
      Authorization: `Bearer ${token}`
    }
  });

  logStatus(muteRes, `Muting user ID: ${userId}`, 'mute_user');

  check(muteRes, {
    'status is 201': (r) => r.status === 201,
    'response contains success message': (r) => {
      try {
        const body = r.json();
        return body.message === 'Muted user successfully';
      } catch {
        return false;
      }
    }
  });
  console.log(`Mute Response for user ${userId}: ${muteRes.body}`);

  // Unmute the user
  const unmuteRes = http.del(`${muteUrl}/${userId}/unmute`, null, {
    headers: {
      Accept: 'application/json',
      Authorization: `Bearer ${token}`
    }
  });

  logStatus(unmuteRes, `Unmuting user ID: ${userId}`, 'unmute_user');
  console.log(`Unmute Response for user ${userId}: ${unmuteRes.body}`);

  check(unmuteRes, {
    'status is 200': (r) => r.status === 200,
    'response contains success message': (r) => {
      try {
        const body = r.json();
        return body.message === 'Unmuted user successfully';
      } catch {
        return false;
      }
    }
  });

  console.log(`Mute and unmute operations completed for user ${userId}`);

  // Simulate real user behavior with random sleep
  const randWait = randomeSeconds(1, 2);
  sleep(randWait);
}

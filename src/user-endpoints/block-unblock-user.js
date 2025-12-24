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

const blockUrl = getUrl('/users'); // Base URL for block/unblock endpoints
const loginUrl = getUrl('/auth/login');
const { logStatus, counters } = countersStatus();

// export const options = secondaryOptions;
export const options = {
    ...secondaryOptions,
    stages: [{ duration: '1s', target: 1 }],
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

  // Select a random user ID from the list, ensuring it's not the current user
  const userId = validUserIds.filter((id) => id !== 'myId')[
    Math.floor(Math.random() * (validUserIds.length - 1))
  ];

  // Block the user
  const blockRes = http.post(`${blockUrl}/${userId}/block`, null, {
    headers: {
      Accept: 'application/json',
      Authorization: `Bearer ${token}`
    }
  });

  logStatus(blockRes, `Blocking user ID: ${userId}`, 'block_user');

  check(blockRes, {
    'status is 201': (r) => r.status === 201,
    'response contains success message': (r) => {
      try {
        const body = r.json();
        return body.message === 'Blocked user successfully';
      } catch {
        return false;
      }
    }
  });

  // Unblock the user
  const unblockRes = http.del(`${blockUrl}/${userId}/unblock`, null, {
    headers: {
      Accept: 'application/json',
      Authorization: `Bearer ${token}`
    }
  });

  logStatus(unblockRes, `Unblocking user ID: ${userId}`, 'unblock_user');

  check(unblockRes, {
    'status is 200': (r) => r.status === 200,
    'response contains success message': (r) => {
      try {
        const body = r.json();
        return body.message === 'Unblocked user successfully';
      } catch {
        return false;
      }
    }
  });

  console.log(`Block and unblock operations completed for user ${userId}`);

  // Simulate real user behavior with random sleep
  const randWait = randomeSeconds(1, 2);
  sleep(randWait);
}

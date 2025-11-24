import http from 'k6/http';
import { check, sleep } from 'k6';
import {
  randomeSeconds,
  randEmail,
  randPhone,
  randString,
  getUrl,
  email as marioEmail,
  options as testOptions
} from '../utils/config.js';

const checkIdentifierUrl = getUrl('/auth/check-identifier');

// Response callbacks
const successCallback = http.expectedStatuses(200, 201);
const notFoundCallback = http.expectedStatuses(404);

export const options = {
  ...testOptions,
  thresholds: {
    http_req_failed: ['rate<0.01'],
    http_req_duration: ['p(95)<300', 'p(90)<200'],
    checks: ['rate>0.99']
  }
};

export default function () {
  // Test 1: Check existing user email (from env - guaranteed to exist in system)
  const existingEmail = marioEmail; // Known registered user
  const existingEmailPayload = JSON.stringify({ identifier: existingEmail });

  const existingEmailRes = http.post(checkIdentifierUrl, existingEmailPayload, {
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json'
    },
    responseCallback: successCallback
  });

  check(existingEmailRes, {
    'existing email: status 200 or 201': (r) =>
      r.status === 200 || r.status === 201,
    'existing email: identifier_type is email': (r) => {
      try {
        return r.json()?.data?.identifier_type === 'email';
      } catch {
        return false;
      }
    },
    'existing email: has user_id': (r) => {
      try {
        const userId = r.json()?.data?.user_id;
        return typeof userId === 'string' && userId.length > 0;
      } catch {
        return false;
      }
    },
    'existing email: message says identifier is available': (r) => {
      try {
        const msg = r.json()?.message?.toLowerCase();
        return msg?.includes('available');
      } catch {
        return false;
      }
    }
  });

  console.log(`Existing email found: ${existingEmail} - User ID returned`);

  sleep(randomeSeconds(1, 2));

  if (Math.random() < 0.7) {
    // Generate random email that likely doesn't exist
    const randomEmail = randEmail('random_test');
    const randomEmailPayload = JSON.stringify({ identifier: randomEmail });

    const randomEmailRes = http.post(checkIdentifierUrl, randomEmailPayload, {
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json'
      },
      responseCallback: notFoundCallback
    });

    check(randomEmailRes, {
      'random email: status 404 (not found)': (r) => r.status === 404,
      'random email: has error message': (r) => {
        try {
          const msg = r.json()?.message?.toLowerCase();
          return msg?.includes('not found');
        } catch {
          return false;
        }
      }
    });

    console.log(`Random email not in system: ${randomEmail}`);
  } else if (Math.random() < 0.667) {
    // 20 / (100 - 70) = 0.667
    const randomPhone = randPhone();
    const randomPhonePayload = JSON.stringify({ identifier: randomPhone });

    const randomPhoneRes = http.post(checkIdentifierUrl, randomPhonePayload, {
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json'
      },
      responseCallback: notFoundCallback
    });

    check(randomPhoneRes, {
      'random phone: status 404 (not found)': (r) => r.status === 404,
      'random phone: has error message': (r) => {
        try {
          const msg = r.json()?.message?.toLowerCase();
          return msg?.includes('not found');
        } catch {
          return false;
        }
      }
    });

    console.log(`Random phone not in system: ${randomPhone}`);
  }
  // Test 4: Check non-existent username (10% of requests)
  else {
    const randomUsername = randString(
      12,
      'abcdefghijklmnopqrstuvwxyz0123456789_'
    );
    const randomUsernamePayload = JSON.stringify({
      identifier: randomUsername
    });

    const randomUsernameRes = http.post(
      checkIdentifierUrl,
      randomUsernamePayload,
      {
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json'
        },
        responseCallback: notFoundCallback
      }
    );

    check(randomUsernameRes, {
      'random username: status 404 (not found)': (r) => r.status === 404,
      'random username: has error message': (r) => {
        try {
          const msg = r.json()?.message?.toLowerCase();
          return msg?.includes('not found');
        } catch {
          return false;
        }
      }
    });

    console.log(`Random username not in system: ${randomUsername}`);
  }

  sleep(randomeSeconds(1, 2));
}

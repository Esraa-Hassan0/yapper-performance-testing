import http from 'k6/http';
import { check, sleep } from 'k6';
import {
  randomeSeconds,
  getUrl,
  options as testOptions
} from '../utils/config.js';
import { email as randEmail } from '../../utils/random.js';

const signupUrl = getUrl('/auth/signup/step1');

// Response callbacks for expected statuses
const successCallback = http.expectedStatuses(200, 201);
const validationErrorCallback = http.expectedStatuses(400);

const captcha_token = '03AGdBq25SxXT-pmSeBXjzScW-EiocHwwpwqJRCAC...';

export const options = {
  ...testOptions,
  thresholds: {
    http_req_failed: ['rate<0.01'], // <1% requests should fail
    http_req_duration: ['p(95)<500'] // 95% of requests <500ms
  },
};

/**
 * Generate signup data for step 1
 * @param {boolean} valid - if true, generates valid data; if false, generates invalid data
 * @returns {object} signup payload
 */
function generateSignupData(valid = true) {
  if (valid) {
    return {
      name: `Test User ${Math.random().toString(36).substring(7)}`,
      birth_date: '1990-01-15',
      email: randEmail('signup_test'),
      captcha_token: captcha_token
    };
  }

  // Invalid data scenarios
  const invalidScenarios = [
    {
      // Missing email
      name: 'Invalid User',
      birth_date: '1990-01-15',
      email: '',
      captcha_token: captcha_token
    },
    {
      // Missing name
      name: '',
      birth_date: '1990-01-15',
      email: randEmail('invalid'),
      captcha_token: captcha_token
    }
  ];

  return invalidScenarios[Math.floor(Math.random() * invalidScenarios.length)];
}

export default function () {
  // 70% valid requests, 30% invalid (to test validation)
  const isValidRequest = Math.random() < 0.7;
  const signupData = generateSignupData(isValidRequest);

  let response;

  if (isValidRequest) {
    // Test valid signup request
    response = http.post(signupUrl, JSON.stringify(signupData), {
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json'
      },
      responseCallback: successCallback
    });

    check(response, {
      'valid signup: status is 200 or 201': (r) =>
        r.status === 200 || r.status === 201,
      'valid signup: response has isEmailSent inside data field': (r) => {
        try {
          const body = r.json();
          return body.data.isEmailSent !== undefined;
        } catch {
          return false;
        }
      }
    });
  } else {
    // Test invalid signup request (validation errors)
    response = http.post(signupUrl, JSON.stringify(signupData), {
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json'
      },
      responseCallback: validationErrorCallback
    });

    check(response, {
      'invalid signup: status is 400': (r) => r.status === 400
    });
  }

  // Simulate user think time between requests
  const waitTime = randomeSeconds(1, 3);
  sleep(waitTime);
}

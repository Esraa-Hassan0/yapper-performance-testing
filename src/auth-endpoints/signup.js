import http from 'k6/http';
import { check, sleep } from 'k6';
import { Counter } from 'k6/metrics';
import {
  randomeSeconds,
  getUrl,
  options as testOptions,
} from '../../utils/config.js';
import { email as randEmail } from '../../utils/random.js';

const signupUrl = getUrl('/auth/signup/step1');
const captcha_token = '03AGdBq25SxXT-pmSeBXjzScW-EiocHwwpwqJRCAC...';

export const options = {
  ...testOptions,
  insecureSkipTLSVerify: true,
  noConnectionReuse: false,
  thresholds: {
    http_req_failed: ['rate<0.01'],
    http_req_duration: ['p(95)<500'],
    checks: ['rate>0.95'],
  },
};

// Custom metrics to count status codes separately
const status200 = new Counter('status_200');
const status201 = new Counter('status_201');
const status400 = new Counter('status_400');
const status401 = new Counter('status_401');
const status403 = new Counter('status_403');
const status404 = new Counter('status_404');
const status409 = new Counter('status_409');
const status422 = new Counter('status_422');
const status500 = new Counter('status_500');

// Legacy counters for backwards compatibility
const signupValidRequest = new Counter('signup_valid_request');
const signupInvalidRequest = new Counter('signup_invalid_request');
const signupEmailSent = new Counter('signup_email_sent');
const signupValidationError = new Counter('signup_validation_error');

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
    case 403:
      status403.add(1);
      break;
    case 404:
      status404.add(1);
      break;
    case 409:
      status409.add(1);
      break;
    case 422:
      status422.add(1);
      break;
    case 500:
      status500.add(1);
      break;
    default:
      // Log unexpected status codes
      console.warn(`Unexpected status code: ${res.status}`);
  }
}

function generateSignupData(valid = true) {
  if (valid) {
    return {
      name: `Test User ${Math.random().toString(36).substring(7)}`,
      birth_date: '1990-01-15',
      email: randEmail('signup_test'),
      captcha_token: captcha_token,
    };
  }
}

export default function () {
  const isValidRequest = 1;
  const signupData = generateSignupData(isValidRequest);

  if (isValidRequest) {
    // TEST: Valid signup request
    const response = http.post(signupUrl, JSON.stringify(signupData), {
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      responseCallback: http.expectedStatuses(200, 201, 409),
      timeout: '60s',
    });

    check(response, {
      'valid signup: status is 200, 201, or 409': (r) =>
        r.status === 200 || r.status === 201 || r.status === 409,
      'valid signup: response has isEmailSent inside data field': (r) => {
        if (r.status === 409) return true; // Email already exists, skip check
        try {
          const body = r.json();
          return body.data.isEmailSent !== undefined;
        } catch {
          return false;
        }
      },
    });

    logStatus(response, 'Valid signup request', 'valid_signup');

    if (response.status === 200 || response.status === 201) {
      signupValidRequest.add(1);

      try {
        const body = response.json();
        if (body.data.isEmailSent) {
          signupEmailSent.add(1);
          console.log(`Email sent successfully to: ${signupData.email}`);
        }
      } catch (e) {
        console.error('Failed to parse response');
      }
    } else if (response.status === 409) {
      console.log(`Email already exists: ${signupData.email}`);
    }

    console.log('Valid signup response:', response.body);
  }
}

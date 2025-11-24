import { getUrl, options as testOptions } from '../../utils/config.js';
import { check } from 'k6';
import http from 'k6/http';

const url = getUrl('/auth/forget-password');

export const options = {
  ...testOptions,
  thresholds: {
    http_req_failed: ['rate<0.01'], // <1% requests should fail
    http_req_duration: ['p(95)<500'], // 95% of requests <500ms
    checks: ['rate>0.95'] // 99% of checks should pass
  }
};

//for not found users or emails
const invalidCallBack = http.expectedStatuses(400, 404);

export default function () {
  const payload = {
    identifier: `nonexistentuser_${Math.random()
      .toString(36)
      .substring(7)}@test.com`
  };

  const response = http.post(url, JSON.stringify(payload), {
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json'
    },
    responseCallback: invalidCallBack
  });

  check(response, {
    'invalid forget-password: status is 400 or 404': (r) =>
      r.status === 400 || r.status === 404
  });

  console.log(`Res Body ${response.body}`);
}

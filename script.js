import { sleep } from 'k6';
import http from 'k6/http';
import { check } from 'k6';

const BASE_URL = 'https://dev.yapper.cmp27.space';
const WAIT_TIME = 1;

export const options = {
  vus: 100,
  duration: '10s'
};

export default function () {
  const Users = [
    {
      email: 'invalid@example.com',
      password: 'invalidpassword'
    },
    {
      email: 'mariorafat10@gmail.com',
      password: 'Mario0o0o!#$@2252004'
    }
  ];

  const params = {
    headers: {
      'Content-Type': 'application/json'
    }
  };

  for (const user of Users) {
    const loginResponse = http.post(
      `${BASE_URL}/auth/login`,
      JSON.stringify(user),
      params
    );
    check(loginResponse, {
      'body not empty': (r) => r.body.length > 0
    });
  }

  sleep(WAIT_TIME);
}

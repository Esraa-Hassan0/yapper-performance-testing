// tweets_full_flow.js — Tests ALL tweet endpoints
import http from 'k6/http';
import { check, sleep } from 'k6';
import { Rate, Counter } from 'k6/metrics';
import {
  getUrl,
  randomeSeconds,
  options as testOptions,
} from '../../utils/config.js';

export const options = {
  ...testOptions,
  insecureSkipTLSVerify: true,
  noConnectionReuse: false,
  thresholds: {
    http_req_failed: ['rate<0.01'],
    http_req_duration: ['p(95)<800'],
  },
};

const errors = new Rate('errors');
const createdTweets = new Counter('tweets_created');
const likes = new Counter('likes');
const reposts = new Counter('reposts');
const bookmarks = new Counter('bookmarks');
const views = new Counter('views');

const EMAIL = __ENV.EMAIL;
const PASSWORD = __ENV.PASSWORD;

const IMAGES = [
  'https://pbs.twimg.com/media/Ga8p2v8XAAAcovered.jpg',
  'https://images.unsplash.com/photo-1682695797221-8164ff1fafc9?w=800',
];
const VIDEO =
  'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4';

export default function () {
  // Fresh login every iteration → no 401 ever
  const loginRes = http.post(
    getUrl('/auth/login'),
    JSON.stringify({ identifier: EMAIL, password: PASSWORD, type: 'email' }),
    { headers: { 'Content-Type': 'application/json' } }
  );

  const loginOk = check(loginRes, {
    'login success': (r) => [200, 201].includes(r.status),
    'has access_token': (r) => {
      try {
        return !!r.json().data?.access_token || !!r.json().access_token;
      } catch {
        return false;
      }
    },
  });

  if (!loginOk) {
    console.error(`Login failed: ${loginRes.status} ${loginRes.body}`);
    errors.add(1);
    sleep(1);
    return;
  }

  const token =
    loginRes.json().data?.access_token || loginRes.json().access_token;
  const headers = {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${token}`,
  };

  // 1. POST /tweets — Create tweet with media
  const tweetRes = http.post(
    getUrl('/tweets'),
    JSON.stringify({
      content: `k6 full flow test — ${new Date().toISOString()} — VU${__VU}`,
      images: IMAGES,
      videos: [VIDEO],
    }),
    { headers }
  );

  if (!check(tweetRes, { 'tweet created': (r) => r.status === 201 })) {
    errors.add(1);
    return;
  }
  const tweetId = tweetRes.json().data.tweet_id;
  createdTweets.add(1);

  sleep(randomeSeconds(1, 3));

  // 2. GET /tweets — Feed
  http.get(getUrl('/tweets?limit=10'), { headers });

  // 3. GET /tweets/{id} — Single tweet
  http.get(getUrl(`/tweets/${tweetId}`), { headers });

  // 4. PATCH /tweets/{id} — Update
  http.patch(
    getUrl(`/tweets/${tweetId}`),
    JSON.stringify({
      content: `UPDATED by k6 @ ${Date.now()}`,
    }),
    { headers }
  );

  // 5. POST /tweets/{id}/reply — Reply
  const replyRes = http.post(
    getUrl(`/tweets/${tweetId}/reply`),
    JSON.stringify({
      content: `Auto reply from VU${__VU}`,
      images: [IMAGES[0]],
    }),
    { headers }
  );
  const replyId =
    replyRes.status === 201
      ? replyRes.json().tweet_id || replyRes.json().data?.tweet_id
      : null;

  // 6. POST /tweets/{id}/quote — Quote tweet
  const quoteRes = http.post(
    getUrl(`/tweets/${tweetId}/quote`),
    JSON.stringify({
      content: `This is a quote tweet by k6 #loadtest`,
      images: IMAGES,
    }),
    { headers }
  );
  const quoteId =
    quoteRes.status === 201 ? quoteRes.json().data?.tweet_id : null;

  // 7. POST + DELETE /like
  http.post(getUrl(`/tweets/${tweetId}/like`), null, { headers });
  likes.add(1);
  sleep(0.3);
  http.del(getUrl(`/tweets/${tweetId}/like`), null, { headers });

  // 8. POST + DELETE /repost
  http.post(getUrl(`/tweets/${tweetId}/repost`), null, { headers });
  reposts.add(1);
  sleep(0.3);
  http.del(getUrl(`/tweets/${tweetId}/repost`), null, { headers });

  // 9. POST + DELETE /bookmark
  http.post(getUrl(`/tweets/${tweetId}/bookmark`), null, { headers });
  bookmarks.add(1);
  sleep(0.3);
  http.del(getUrl(`/tweets/${tweetId}/bookmark`), null, { headers });

  // 10. POST /view — Track view
  http.post(getUrl(`/tweets/${tweetId}/view`), null, { headers });
  views.add(1);

  // 11. All GET analytics endpoints
  const endpoints = [
    `/tweets/bookmarks?limit=5`,
    `/tweets/${tweetId}/likes?limit=10`,
    `/tweets/${tweetId}/reposts?limit=10`,
    `/tweets/${tweetId}/quotes?limit=10`,
    `/tweets/${tweetId}/replies?limit=10`,
  ];
  endpoints.forEach((path) => http.get(getUrl(path), { headers }));

  // 12. If we created a quote tweet → update it
  if (quoteId) {
    http.patch(
      getUrl(`/tweets/${quoteId}/quote`),
      JSON.stringify({
        content: `Quote updated by k6 @ ${Date.now()}`,
      }),
      { headers }
    );
  }

  sleep(randomeSeconds(2, 5));

  // FINAL: DELETE /tweets/{id} — Cleanup
  const delRes = http.del(getUrl(`/tweets/${tweetId}`), null, { headers });
  check(delRes, { 'tweet deleted': (r) => [200, 204].includes(r.status) });

  sleep(randomeSeconds(3, 8));
}

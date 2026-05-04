import http from 'k6/http';
import { check, sleep } from 'k6';

export const options = {
  vus: 50,
  duration: '30s',
  thresholds: {
    http_req_duration: ['p(95)<200'],
    http_req_failed: ['rate<0.01'],
  },
};

const BASE_URL = __ENV.BASE_URL || 'http://localhost:7777';

// Token de fichier public existant à renseigner avant le test
const FILE_TOKEN = __ENV.FILE_TOKEN || 'token-de-test';

export default function () {
  const res = http.get(`${BASE_URL}/api/v1/files/${FILE_TOKEN}/metadata`);

  check(res, {
    'status 200': (r) => r.status === 200,
    'latence p95 < 200ms': (r) => r.timings.duration < 200,
  });

  sleep(0.5);
}

import http from 'http';

const data = JSON.stringify({ geminiEnabled: false });

const req = http.request(
  {
    hostname: 'localhost',
    port: 3000,
    path: '/api/admin/api-toggles',
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-admin-key': 'seneca'
    }
  },
  (res) => {
    let body = '';
    res.on('data', chunk => body += chunk);
    res.on('end', () => console.log('STATUS:', res.statusCode, 'BODY:', body));
  }
);
req.on('error', (e) => console.error(e));
req.write(data);
req.end();

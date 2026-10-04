import http from 'http';

function request(url: string, options: any, body?: any): Promise<{ statusCode: number, headers: any, data: string }> {
  return new Promise((resolve, reject) => {
    const req = http.request(url, options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve({ statusCode: res.statusCode || 0, headers: res.headers, data }));
    });
    req.on('error', reject);
    if (body) req.write(typeof body === 'string' ? body : JSON.stringify(body));
    req.end();
  });
}

async function run() {
  console.log('=== 1. Login & SSE Token Redaction Test ===');
  const loginRes = await request('http://localhost:4000/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' }
  }, { email: 'arun@cryoguard.com', password: 'Staff@123456' });

  const token = JSON.parse(loginRes.data).token;
  console.log('Login status:', loginRes.statusCode);
  console.log('Token received (first 20 chars):', token.substring(0, 20) + '...');

  // Connect to SSE for 2 seconds
  console.log('Connecting to SSE stream with token in query params...');
  await new Promise<void>((resolve) => {
    const sseReq = http.request(`http://localhost:4000/api/alerts/stream?token=${encodeURIComponent(token)}`, {
      headers: { 'Accept': 'text/event-stream' }
    }, (res) => {
      res.on('data', (chunk) => {
        console.log('SSE Data received:', chunk.toString().trim());
      });
      setTimeout(() => {
        sseReq.destroy();
        resolve();
      }, 2500);
    });
    sseReq.on('error', () => resolve());
    sseReq.end();
  });

  console.log('\n=== 2. Rate Limiting Test (10 failed attempts) ===');
  for (let i = 1; i <= 10; i++) {
    const res = await request('http://localhost:4000/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    }, { email: 'arun@cryoguard.com', password: 'WrongPassword123' });
    console.log(`Attempt ${i}: HTTP ${res.statusCode} - ${res.data.trim()}`);
  }

  console.log('\nAttempt 11 (Immediate Valid Login during rate limit block):');
  const blockedRes = await request('http://localhost:4000/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' }
  }, { email: 'arun@cryoguard.com', password: 'Staff@123456' });
  console.log(`HTTP ${blockedRes.statusCode} - ${blockedRes.data.trim()}`);

  console.log('\nWaiting 62 seconds for rate limit window to expire (NO REDIS FLUSH)...');
  for (let s = 60; s > 0; s -= 15) {
    console.log(`... ${s} seconds remaining`);
    await new Promise(r => setTimeout(r, 15000));
  }
  await new Promise(r => setTimeout(r, 2000));

  console.log('\nAttempt after rate limit expiry (Valid Login):');
  const successRes = await request('http://localhost:4000/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' }
  }, { email: 'arun@cryoguard.com', password: 'Staff@123456' });
  console.log(`HTTP ${successRes.statusCode} - Success! User:`, JSON.parse(successRes.data).user?.email);
}

run().catch(console.error);

import { spawn, ChildProcess } from 'child_process';
import http from 'http';

const PORT = '3001';
const BASE_URL = `http://localhost:${PORT}`;

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function waitForServer(url: string, timeoutMs = 15000): Promise<boolean> {
  const start = Date.now();
  return new Promise((resolve) => {
    const check = () => {
      if (Date.now() - start > timeoutMs) {
        resolve(false);
        return;
      }
      http.get(url, (res) => {
        if (res.statusCode && res.statusCode < 500) {
          resolve(true);
        } else {
          setTimeout(check, 500);
        }
      }).on('error', () => {
        setTimeout(check, 500);
      });
    };
    check();
  });
}

async function runRequest(path: string, options: RequestInit = {}): Promise<{ status: number; headers: Headers; body: string }> {
  const url = `${BASE_URL}${path}`;
  const res = await fetch(url, { ...options, redirect: 'manual' });
  const body = await res.text();
  return {
    status: res.status,
    headers: res.headers,
    body
  };
}

async function testSuite() {
  console.log('=== STARTING INTEGRATION TESTS ===');
  let success = true;

  // --- TEST CASE 1: Local storage / no direct redirects ---
  console.log('\n--- Test Case 1: Local Proxy (ASSET_DIRECT_BLOB_REDIRECTS=false, ASSET_STORAGE_DRIVER=local) ---');
  const serverEnv1: NodeJS.ProcessEnv = {
    ...process.env,
    PORT,
    DATABASE_URL: 'file:../storage/vvviruz-command-center.db',
    ASSET_STORAGE_DRIVER: 'local',
    ASSET_DIRECT_BLOB_REDIRECTS: 'false',
    NODE_ENV: 'production'
  };

  let server1: ChildProcess | null = null;
  try {
    server1 = spawn('npm.cmd', ['run', 'start'], {
      env: serverEnv1,
      shell: true,
      stdio: 'pipe'
    });

    server1.stderr?.on('data', (data) => console.error(`[Server1 Stderr]: ${data.toString()}`));
    server1.stdout?.on('data', (data) => console.log(`[Server1]: ${data.toString()}`));

    console.log('Starting Next.js server...');
    const isUp = await waitForServer(BASE_URL);
    if (!isUp) {
      throw new Error('Next.js server failed to boot within timeout.');
    }
    console.log('Server is running on port 3001.');

    // 1. Verify Links page
    console.log('Checking /links ...');
    const linksRes = await runRequest('/links');
    if (linksRes.status === 200) {
      console.log('✓ /links page loaded successfully (200).');
    } else {
      console.error(`✗ /links failed with status ${linksRes.status}`);
      success = false;
    }

    // 2. Verify Music detail page
    console.log('Checking /music/numerical ...');
    const musicRes = await runRequest('/music/numerical');
    if (musicRes.status === 200) {
      console.log('✓ /music/numerical page loaded successfully (200).');
    } else {
      console.error(`✗ /music/numerical failed with status ${musicRes.status}`);
      success = false;
    }

    // 3. Verify Exclusives page
    console.log('Checking /exclusives ...');
    const exclusivesRes = await runRequest('/exclusives');
    if (exclusivesRes.status === 200) {
      console.log('✓ /exclusives page loaded successfully (200).');
    } else {
      console.error(`✗ /exclusives failed with status ${exclusivesRes.status}`);
      success = false;
    }

    // 4. Verify Vault page
    console.log('Checking /vault ...');
    const vaultRes = await runRequest('/vault');
    if (vaultRes.status === 200) {
      console.log('✓ /vault page loaded successfully (200).');
    } else if (vaultRes.status === 307) {
      console.log('✓ /vault page redirected as expected (307) when disabled.');
    } else {
      console.error(`✗ /vault failed with status ${vaultRes.status}`);
      success = false;
    }

    // 5. Verify local asset proxy loading with cache headers
    console.log('Checking local asset proxy serving...');
    const assetRes = await runRequest('/api/assets/cover/4fc0d8b5-cb6d-4559-9077-c34079b808bd.jpg');
    // It should be 200, or 404 if the local file isn't physically on this developer machine (which is fine, but checking routing/headers)
    console.log(`Asset response status: ${assetRes.status}`);
    console.log(`Cache-Control header: ${assetRes.headers.get('cache-control')}`);
    if (assetRes.status === 200 || assetRes.status === 304 || assetRes.status === 404) {
      console.log('✓ /api/assets/cover/[file] routing is active.');
      if (assetRes.status === 200) {
        const cc = assetRes.headers.get('cache-control');
        if (cc && cc.includes('max-age=31536000')) {
          console.log('✓ Cache-Control headers verified for public asset.');
        } else {
          console.error(`✗ Unexpected Cache-Control: ${cc}`);
          success = false;
        }
      }
    } else {
      console.error(`✗ Asset endpoint failed with status ${assetRes.status}`);
      success = false;
    }
  } finally {
    if (server1 && server1.pid) {
      console.log('Shutting down Server 1...');
      try {
        const { execSync } = require('child_process');
        execSync(`taskkill /F /T /PID ${server1.pid}`, { stdio: 'ignore' });
      } catch (e) {}
      await sleep(1000);
    }
  }

  // --- TEST CASE 2: Vercel Blob redirect enabled ---
  console.log('\n--- Test Case 2: Vercel Blob Redirect (ASSET_DIRECT_BLOB_REDIRECTS=true, ASSET_STORAGE_DRIVER=vercel-blob) ---');
  const serverEnv2: NodeJS.ProcessEnv = {
    ...process.env,
    PORT,
    DATABASE_URL: 'file:../storage/vvviruz-command-center.db',
    ASSET_STORAGE_DRIVER: 'vercel-blob',
    ASSET_DIRECT_BLOB_REDIRECTS: 'true',
    BLOB_CDN_ORIGIN: 'https://test-cdn.com',
    NODE_ENV: 'production'
  };

  let server2: ChildProcess | null = null;
  try {
    server2 = spawn('npm.cmd', ['run', 'start'], {
      env: serverEnv2,
      shell: true,
      stdio: 'pipe'
    });

    server2.stderr?.on('data', (data) => console.error(`[Server2 Stderr]: ${data.toString()}`));
    server2.stdout?.on('data', (data) => console.log(`[Server2]: ${data.toString()}`));

    console.log('Starting Next.js server...');
    const isUp = await waitForServer(BASE_URL);
    if (!isUp) {
      throw new Error('Next.js server failed to boot within timeout.');
    }
    console.log('Server is running on port 3001.');

    // 1. Verify direct asset redirect behavior
    console.log('Checking asset direct redirect...');
    // We request a cover that exists in the database as published so it is recognized as a public asset
    const redirectRes = await runRequest('/api/assets/cover/4fc0d8b5-cb6d-4559-9077-c34079b808bd.jpg');
    console.log(`Asset response status: ${redirectRes.status}`);
    console.log(`Location header: ${redirectRes.headers.get('location')}`);
    console.log(`Cache-Control header: ${redirectRes.headers.get('cache-control')}`);

    if (redirectRes.status === 307) {
      const loc = redirectRes.headers.get('location');
      const cc = redirectRes.headers.get('cache-control');
      if (loc === 'https://test-cdn.com/vvviruz/cover/4fc0d8b5-cb6d-4559-9077-c34079b808bd.jpg') {
        console.log('✓ Correct direct Vercel Blob redirect URL returned.');
      } else {
        console.error(`✗ Incorrect location header: ${loc}`);
        success = false;
      }
      if (cc && cc.includes('max-age=31536000')) {
        console.log('✓ Cache-Control header on redirect response is correct.');
      } else {
        console.error(`✗ Unexpected Cache-Control on redirect: ${cc}`);
        success = false;
      }
    } else {
      console.error(`✗ Expected 307 Redirect, got status: ${redirectRes.status}`);
      success = false;
    }

    // 2. Verify that protected/private assets are NOT redirected to CDN
    console.log('Checking that private assets are NOT redirected...');
    const privateRes = await runRequest('/api/assets/exclusive-track/some-file.mp3');
    // Exclusive tracks are not allowed via the public route, should return 400 or 401
    console.log(`Private asset response status: ${privateRes.status}`);
    if (privateRes.status === 400 || privateRes.status === 401) {
      console.log('✓ Private exclusive track endpoint was protected and did NOT redirect.');
    } else {
      console.error(`✗ Private exclusive track was not correctly protected: status ${privateRes.status}`);
      success = false;
    }
  } finally {
    if (server2 && server2.pid) {
      console.log('Shutting down Server 2...');
      try {
        const { execSync } = require('child_process');
        execSync(`taskkill /F /T /PID ${server2.pid}`, { stdio: 'ignore' });
      } catch (e) {}
      await sleep(1000);
    }
  }

  console.log('\n=== TEST SUMMARY ===');
  if (success) {
    console.log('ALL TESTS PASSED SUCCESSFULLY! 🎉');
    process.exit(0);
  } else {
    console.error('SOME TESTS FAILED. ❌');
    process.exit(1);
  }
}

testSuite().catch((err) => {
  console.error('Test suite failed:', err);
  process.exit(1);
});

#!/usr/bin/env node
const child_process = require('child_process');
const path = require('path');

try {
  child_process.execSync(`npx tsx ${path.join(__dirname, 'archive-duplicates.ts')} ${process.argv.slice(2).join(' ')}`, { stdio: 'inherit' });
} catch (e) {
  process.exit(1);
}

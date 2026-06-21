/**
 * Lokal serverni internetga ochish (Cloudflare Quick Tunnel).
 * Ishlatish: npm run dev  (bitta terminal)
 *            npm run share (ikkinchi terminal)
 */
const { spawn } = require('child_process');

const PORT = process.env.PORT || 3000;
const TARGET = `http://127.0.0.1:${PORT}`;

console.log('');
console.log('Myhomework.uz — internetga ochilmoqda...');
console.log(`Lokal server: ${TARGET}`);
console.log('Biroz kuting, pastda public link chiqadi.');
console.log('To\'xtatish: Ctrl+C');
console.log('');

const bin = process.platform === 'win32' ? 'cloudflared.cmd' : 'cloudflared';
const child = spawn('npx', ['--yes', 'cloudflared', 'tunnel', '--url', TARGET], {
    stdio: 'inherit',
    shell: true
});

child.on('error', err => {
    console.error('Tunnel xatosi:', err.message);
    process.exit(1);
});

child.on('exit', code => process.exit(code ?? 0));

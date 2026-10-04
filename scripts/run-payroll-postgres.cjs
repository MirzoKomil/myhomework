// Starts only a disposable loopback PostgreSQL cluster, never the app's DATABASE_URL.
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const net = require('node:net');
const { spawnSync } = require('node:child_process');
const { randomUUID } = require('node:crypto');
const { Client } = require('pg');
async function main() {
  const bin = process.env.PAYROLL_PG_BIN || 'C:/Program Files/PostgreSQL/17/bin';
  const executable = name => path.join(bin, name + (process.platform === 'win32' ? '.exe' : ''));
  for (const name of ['initdb', 'pg_ctl']) if (!fs.existsSync(executable(name))) throw Error('PostgreSQL binary not found: ' + name);
  const listener = net.createServer();
  await new Promise((resolve, reject) => { listener.once('error', reject); listener.listen(0, '127.0.0.1', resolve); });
  const port = listener.address().port;
  await new Promise(resolve => listener.close(resolve));
  const cluster = fs.mkdtempSync(path.join(os.tmpdir(), 'myhomework-payroll-pg-'));
  const data = path.join(cluster, 'data');
  const run = (name, args) => {
    const result = spawnSync(executable(name), args, { encoding: 'utf8', windowsHide: true, timeout: 60000 });
    if (result.status !== 0) throw Error((result.stderr || result.stdout || result.error?.message || name).trim());
  };
  let started = false;
  try {
    run('initdb', ['-D', data, '-U', 'payroll_test', '--auth=trust', '--encoding=UTF8', '--locale=C']);
    run('pg_ctl', ['-D', data, '-l', path.join(cluster, 'postgres.log'), '-o', `-h 127.0.0.1 -p ${port}`, '-w', 'start']);
    started = true;
    for (const testFile of ['scripts/payroll-postgres.test.cjs', 'scripts/inflow-postgres.test.cjs', 'scripts/teacher-dual-role-postgres.test.cjs']) {
    const database = 'payroll_test_' + randomUUID().replaceAll('-', '');
    const client = new Client({ host: '127.0.0.1', port, user: 'payroll_test', database: 'postgres' });
    await client.connect();
    try { await client.query(`CREATE DATABASE "${database}"`); } finally { await client.end(); }
    const result = spawnSync(process.execPath, ['--test', testFile], {
      cwd: path.resolve(__dirname, '..'), encoding: 'utf8', windowsHide: true, timeout: 180000,
      env: { ...process.env, PAYROLL_TEST_DATABASE_URL: `postgresql://payroll_test@127.0.0.1:${port}/${database}` }
    });
    process.stdout.write(result.stdout || ''); process.stderr.write(result.stderr || '');
    if (result.status || result.error) process.exitCode = 1;
    }
  } finally {
    if (started) run('pg_ctl', ['-D', data, '-m', 'fast', '-w', 'stop']);
    // Exact generated folder retained for diagnosis; never delete an inferred/shared DB folder.
    process.stdout.write('Disposable PostgreSQL stopped. Test files: ' + cluster + '\n');
  }
}
main().catch(error => { process.stderr.write(error.message + '\n'); process.exitCode = 1; });

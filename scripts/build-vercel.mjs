// Vercel build (Build Output API, https://vercel.com/docs/build-output-api):
//  - with a database connected: apply migrations, create the demo family and
//    point the web app at /api;
//  - export the web app as static files;
//  - bundle the API into a single Node.js function.
// Without a database, the offline demo is published and the API answers 503.
import { execSync } from 'node:child_process';
import { cpSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';

import { build } from 'esbuild';

const OUT = '.vercel/output';
const run = (command, env = {}) => execSync(command, { stdio: 'inherit', env: { ...process.env, ...env } });
const hasDatabase = Boolean(process.env.DATABASE_URL || process.env.POSTGRES_URL);

const webEnv = {};
if (hasDatabase) {
  run('npm run db:migrate');
  run('npm run db:seed');
  webEnv.EXPO_PUBLIC_API_URL = process.env.EXPO_PUBLIC_API_URL || '/api';
  console.log(`Building web app against ${webEnv.EXPO_PUBLIC_API_URL}`);
} else {
  console.log('No DATABASE_URL: building the offline demo');
}
run('npm run build:web', webEnv);

rmSync(OUT, { recursive: true, force: true });
cpSync('dist', `${OUT}/static`, { recursive: true });

const fn = `${OUT}/functions/api.func`;
mkdirSync(fn, { recursive: true });
await build({
  entryPoints: ['server/vercel-entry.cjs'],
  outfile: `${fn}/index.js`,
  bundle: true,
  platform: 'node',
  target: 'node22',
  format: 'cjs',
  external: ['pg-native'],
  logLevel: 'warning',
});
writeFileSync(
  `${fn}/.vc-config.json`,
  JSON.stringify(
    { runtime: 'nodejs22.x', handler: 'index.js', launcherType: 'Nodejs', shouldAddHelpers: false, supportsResponseStreaming: true, regions: ['gru1'] },
    null,
    2,
  ),
);

writeFileSync(
  `${OUT}/config.json`,
  JSON.stringify(
    {
      version: 3,
      routes: [
        { src: '^/api(?:/(.*))?$', dest: '/api?__path=$1' },
        { handle: 'filesystem' },
        { src: '/(.*)', dest: '/index.html' },
      ],
    },
    null,
    2,
  ),
);
console.log('Vercel output ready');

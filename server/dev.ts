import { serve } from '@hono/node-server';

import { app } from './app';

// Local API server: `npm run api:dev` (needs DATABASE_URL).
const port = Number(process.env.PORT ?? 3000);
serve({ fetch: app.fetch, port }, () => console.info(`[api] http://localhost:${port}/api`));

import { handle } from 'hono/vercel';

import { app } from '../server/app';

// Vercel Function (Node.js runtime). vercel.json rewrites /api/* here.
const handler = handle(app);

export const GET = handler;
export const POST = handler;
export const OPTIONS = handler;

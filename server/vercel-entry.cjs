// Entry of the Vercel Function. scripts/build-vercel.mjs bundles it, with every
// dependency, into one CommonJS file, so the runtime never has to load an
// ES module through require().
const { getRequestListener } = require('@hono/node-server');

const { app } = require('./app');
const { restoreRewrittenUrl } = require('./vercel');

module.exports = getRequestListener((request) => app.fetch(restoreRewrittenUrl(request)));

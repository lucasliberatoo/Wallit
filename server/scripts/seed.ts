import { closeDb, getDb } from '../db/client';
import { seedDemo } from '../seed';

seedDemo(getDb())
  .then((created) => console.info(created ? '[db] demo family created' : '[db] demo family already exists'))
  .catch((error) => {
    console.error('[db] seed failed', error);
    process.exitCode = 1;
  })
  .finally(closeDb);

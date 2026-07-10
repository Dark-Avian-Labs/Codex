import { requireAuthApi } from '@codex/core';
import { Router } from 'express';

import { epic7ApiRouter } from './epic7Api.js';
import { warframeApiRouter } from './warframeApi.js';
import { worAdminApiRouter } from './worAdminApi.js';
import { worApiRouter } from './worApi.js';

export const apiRouter = Router();

apiRouter.use(requireAuthApi);

apiRouter.get('/status', (_req, res) => {
  res.json({ ok: true, app: 'codex' });
});

apiRouter.use('/warframe', warframeApiRouter);
apiRouter.use('/epic7', epic7ApiRouter);
apiRouter.use('/wor/admin', worAdminApiRouter);
apiRouter.use('/wor', worApiRouter);

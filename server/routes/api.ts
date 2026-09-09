import { requireAuthApi } from '@codex/core';
import { Router } from 'express';

import { epic7ApiRouter } from './epic7Api.js';
import { warframeApiRouter } from './warframeApi.js';
import { worAdminApiRouter } from './worAdminApi.js';
import { worApiRouter } from './worApi.js';

export const apiRouter = Router();

apiRouter.get('/status', requireAuthApi, (_req, res) => {
  res.json({ ok: true, app: 'codex' });
});

apiRouter.use('/warframe', requireAuthApi, warframeApiRouter);
apiRouter.use('/epic7', requireAuthApi, epic7ApiRouter);
apiRouter.use('/wor/admin', requireAuthApi, worAdminApiRouter);
apiRouter.use('/wor', requireAuthApi, worApiRouter);

import { getAllRateLimits, removeRateLimit } from '@-xun/api-strategy/limit';
import { sendHttpOk } from '@-xun/respond';

import { withSysMiddleware } from 'universe:route-wrapper.ts';

// ? https://nextjs.org/docs/api-routes/api-middlewares#custom-config
export { defaultConfig as config } from '@nhscc/backend-qoverflow~npm/api';

/**
 * An endpoint to test if the API is up and reachable.
 */
export default withSysMiddleware(
  async (req, res) => {
    if (req.method === 'GET') {
      sendHttpOk(res, { entries: await getAllRateLimits() });
    } else {
      sendHttpOk(res, {
        unbannedCount: await removeRateLimit({
          target: req.body?.target
        })
      });
    }
  },
  {
    descriptor: '/sys/auth/unban',
    options: {
      allowedMethods: ['DELETE', 'GET']
    }
  }
);

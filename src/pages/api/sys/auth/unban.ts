import { sendHttpOk } from 'multiverse/next-api-respond';
import { getAllRateLimits, removeRateLimit } from 'multiverse/next-limit';
import { withSysMiddleware } from 'universe/backend/middleware';

// ? https://nextjs.org/docs/api-routes/api-middlewares#custom-config
export { defaultConfig as config } from 'universe/backend/api';

/**
 * An endpoint to test if the API is up and reachable.
 */
export default withSysMiddleware(
  async (req, res) => {
    if (req.method == 'GET') {
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
    options: { allowedMethods: ['DELETE', 'GET'] }
  }
);

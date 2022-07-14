import { sendHttpOk } from 'multiverse/next-api-respond';
import {
  createEntry,
  deleteEntry,
  getOwnersEntries,
  updateAttributes
} from 'multiverse/next-auth';
import { withSysMiddleware } from 'universe/backend/middleware';

// ? https://nextjs.org/docs/api-routes/api-middlewares#custom-config
export { defaultConfig as config } from 'universe/backend/api';

/**
 * An endpoint to test if the API is up and reachable.
 */
export default withSysMiddleware(
  async (req, res) => {
    if (req.method == 'GET') {
      sendHttpOk(res, {
        entries: await getOwnersEntries({
          owners: [
            req.headers['x-target-owners']
              ?.toString()
              .split(',')
              .map((s) => s.trim())
          ].flat()
        })
      });
    } else if (req.method == 'POST') {
      sendHttpOk(res, {
        entry: await createEntry({
          entry: req.body
        })
      });
    } else if (req.method == 'PATCH') {
      await updateAttributes({
        target: req.body?.target,
        attributes: req.body?.attributes
      });
      sendHttpOk(res);
    } else {
      await deleteEntry({ target: req.body?.target });
      sendHttpOk(res);
    }
  },
  {
    descriptor: '/sys/auth',
    options: { allowedMethods: ['GET', 'POST', 'PATCH', 'DELETE'] }
  }
);

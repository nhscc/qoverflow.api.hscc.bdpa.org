/* eslint-disable unicorn/filename-case */
import {
  deleteTokens,
  getTokens,
  updateTokensAttributes
} from '@-xun/api-strategy/auth';

import { sendHttpOk } from '@-xun/respond';

import { withSysMiddleware } from 'universe/backend/middleware';

// ? https://nextjs.org/docs/api-routes/api-middlewares#custom-config
export { defaultConfig as config } from 'universe/backend/api';

export default withSysMiddleware(
  async (req, res) => {
    switch (req.method) {
      case 'GET': {
        sendHttpOk(res, {
          fullToken: await getTokens({ auth_ids: [req.query.auth_id?.toString()] })
        });
        break;
      }

      case 'PATCH': {
        sendHttpOk(res, {
          updated: await updateTokensAttributes({
            auth_ids: [req.query.auth_id?.toString()],
            data: req.body?.attributes
          })
        });
        break;
      }

      case 'DELETE': {
        sendHttpOk(res, {
          deleted: await deleteTokens({ auth_ids: [req.query.auth_id?.toString()] })
        });
        break;
      }
    }
  },
  {
    descriptor: '/sys/auth/:auth_id',
    options: { requiresAuth: true, allowedMethods: ['GET', 'PATCH', 'DELETE'] }
  }
);

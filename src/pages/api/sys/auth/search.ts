import {
  deleteTokens,
  getTokens,
  updateTokensAttributes
} from '@-xun/api-strategy/auth';

import { sendHttpOk } from '@-xun/respond';

import { withSysMiddleware } from 'universe/backend/middleware';
import { validateAndParseJson } from 'universe/util';

// ? https://nextjs.org/docs/api-routes/api-middlewares#custom-config
export { defaultConfig as config } from 'universe/backend/api';

export default withSysMiddleware(
  async (req, res) => {
    const filter = validateAndParseJson(req.query.filter?.toString(), 'filter');

    switch (req.method) {
      case 'GET': {
        sendHttpOk(res, {
          fullTokens: await getTokens({ filter, after_id: req.query.after?.toString() })
        });
        break;
      }

      case 'PATCH': {
        sendHttpOk(res, {
          updated: await updateTokensAttributes({
            filter,
            data: req.body?.attributes
          })
        });
        break;
      }

      case 'DELETE': {
        sendHttpOk(res, { deleted: await deleteTokens({ filter }) });
        break;
      }
    }
  },
  {
    descriptor: '/sys/auth/search',
    options: { requiresAuth: true, allowedMethods: ['GET', 'PATCH', 'DELETE'] }
  }
);

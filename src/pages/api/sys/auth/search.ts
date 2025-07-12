import {
  deleteTokens,
  getTokens,
  updateTokensAttributes
} from '@-xun/api-strategy/auth';

import { sendHttpOk } from '@-xun/respond';

import { withSysMiddleware } from 'universe:route-wrapper.ts';
import { validateAndParseJson } from 'universe:util.ts';

// ? https://nextjs.org/docs/api-routes/api-middlewares#custom-config
export { defaultConfig as config } from '@nhscc/backend-qoverflow~npm/api';

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
    options: { allowedMethods: ['GET', 'PATCH', 'DELETE'] }
  }
);

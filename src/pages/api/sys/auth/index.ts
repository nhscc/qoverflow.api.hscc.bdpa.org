import { createToken, getTokens } from '@-xun/api-strategy/auth';
import { sendHttpOk } from '@-xun/respond';

import { withSysMiddleware } from 'universe:route-wrapper.ts';

// ? https://nextjs.org/docs/api-routes/api-middlewares#custom-config
export { defaultConfig as config } from '@nhscc/backend-qoverflow~npm/api';

export default withSysMiddleware(
  async (req, res) => {
    switch (req.method) {
      case 'GET': {
        sendHttpOk(res, {
          fullTokens: await getTokens({
            filter: {},
            after_id: req.query.after?.toString()
          })
        });
        break;
      }

      case 'POST': {
        sendHttpOk(res, { fullToken: await createToken({ data: req.body }) });
        break;
      }
    }
  },
  {
    descriptor: '/sys/auth',
    options: { allowedMethods: ['GET', 'POST'] }
  }
);

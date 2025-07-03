import { sendHttpOk } from '@-xun/respond';

import { withSysMiddleware } from 'universe/backend/middleware';

// ? https://nextjs.org/docs/api-routes/api-middlewares#custom-config
export { defaultConfig as config } from 'universe/backend/api';

export default withSysMiddleware(
  async (req, res) => {
    const { name = 'Mr. World' } = req.query;
    sendHttpOk(res, {
      message: `Hello to ${String(name)} at ${new Date(Date.now()).toLocaleString()}`
    });
  },
  {
    descriptor: '/sys/ping',
    options: {
      allowedMethods: ['GET'],
      allowedContentTypes: 'any',
      requiresAuth: false
    }
  }
);

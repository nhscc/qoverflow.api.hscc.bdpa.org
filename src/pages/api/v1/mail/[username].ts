import { sendHttpOk } from '@-xun/respond';

import { getUserMessages } from 'universe/backend';
import { withMiddleware } from 'universe/backend/middleware';

export { defaultConfig as config } from 'universe/backend/api';

export const metadata = {
  descriptor: '/v1/mail/:username',
  apiVersion: '1'
};

export default withMiddleware(
  async (req, res) => {
    // * GET
    sendHttpOk(res, {
      messages: await getUserMessages({
        username: req.query.username?.toString(),
        after_id: req.query.after?.toString()
      })
    });
  },
  {
    descriptor: metadata.descriptor,
    options: {
      requiresAuth: true,
      allowedMethods: ['GET'],
      apiVersion: metadata.apiVersion
    }
  }
);

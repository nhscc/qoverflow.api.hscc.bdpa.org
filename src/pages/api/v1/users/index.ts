import { sendHttpOk } from '@-xun/respond';

import { createUser, getAllUsers } from 'universe/backend';
import { withMiddleware } from 'universe/backend/middleware';

export { defaultConfig as config } from 'universe/backend/api';

export const metadata = {
  descriptor: '/v1/users',
  apiVersion: '1'
};

export default withMiddleware(
  async (req, res) => {
    if (req.method === 'GET') {
      sendHttpOk(res, {
        users: await getAllUsers({ after_id: req.query.after?.toString() })
      });
      // * POST
    } else sendHttpOk(res, { user: await createUser({ data: req.body }) });
  },
  {
    descriptor: metadata.descriptor,
    options: {
      requiresAuth: true,
      allowedMethods: ['GET', 'POST'],
      apiVersion: metadata.apiVersion
    }
  }
);

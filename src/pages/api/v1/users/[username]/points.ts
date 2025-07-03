import { sendHttpOk } from '@-xun/respond';

import { updateUser } from 'universe/backend';
import { withMiddleware } from 'universe/backend/middleware';

export { defaultConfig as config } from 'universe/backend/api';

export const metadata = {
  descriptor: '/v1/users/:username/points',
  apiVersion: '1'
};

export default withMiddleware(
  async (req, res) => {
    // * PATCH
    await updateUser({
      username: req.query.username?.toString(),
      data: {
        points: {
          op: req.body.operation,
          amount: req.body.amount
        }
      }
    });

    sendHttpOk(res);
  },
  {
    descriptor: metadata.descriptor,
    options: {
      requiresAuth: true,
      allowedMethods: ['PATCH'],
      apiVersion: metadata.apiVersion
    }
  }
);

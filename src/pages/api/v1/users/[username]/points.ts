import { sendHttpOk } from '@-xun/respond';
import { updateUser } from '@nhscc/backend-qoverflow~npm';

import { withMiddleware } from 'universe:route-wrapper.ts';

export { defaultConfig as config } from '@nhscc/backend-qoverflow~npm/api';

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
      allowedMethods: ['PATCH'],
      apiVersion: metadata.apiVersion
    }
  }
);

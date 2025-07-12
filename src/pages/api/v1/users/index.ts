import { sendHttpOk } from '@-xun/respond';
import { createUser, getAllUsers } from '@nhscc/backend-qoverflow~npm';

import { withMiddleware } from 'universe:route-wrapper.ts';

export { defaultConfig as config } from '@nhscc/backend-qoverflow~npm/api';

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
      allowedMethods: ['GET', 'POST'],
      apiVersion: metadata.apiVersion
    }
  }
);

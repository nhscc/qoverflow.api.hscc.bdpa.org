import { sendHttpOk } from '@-xun/respond';
import { deleteUser, getUser, updateUser } from '@nhscc/backend-qoverflow~npm';

import { withMiddleware } from 'universe:route-wrapper.ts';

export { defaultConfig as config } from '@nhscc/backend-qoverflow~npm/api';

export const metadata = {
  descriptor: '/v1/users/:username',
  apiVersion: '1'
};

export default withMiddleware(
  async (req, res) => {
    const username = req.query.username?.toString();

    if (req.method === 'GET') {
      sendHttpOk(res, { user: await getUser({ username }) });
    } else if (req.method === 'DELETE') {
      await deleteUser({ username });
      sendHttpOk(res);
    } // * PATCH
    else {
      await updateUser({ username, data: req.body });
      sendHttpOk(res);
    }
  },
  {
    descriptor: metadata.descriptor,
    options: {
      allowedMethods: ['GET', 'DELETE', 'PATCH'],
      apiVersion: metadata.apiVersion
    }
  }
);

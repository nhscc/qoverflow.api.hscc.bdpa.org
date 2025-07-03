import { sendHttpOk } from '@-xun/respond';

import { deleteUser, getUser, updateUser } from 'universe/backend';
import { withMiddleware } from 'universe/backend/middleware';

export { defaultConfig as config } from 'universe/backend/api';

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
      requiresAuth: true,
      allowedMethods: ['GET', 'DELETE', 'PATCH'],
      apiVersion: metadata.apiVersion
    }
  }
);

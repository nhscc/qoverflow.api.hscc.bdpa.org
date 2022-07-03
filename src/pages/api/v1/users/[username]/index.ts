import { withMiddleware } from 'universe/backend/middleware';
import { getUser, updateUser, deleteUser } from 'universe/backend';
import { sendHttpOk } from 'multiverse/next-api-respond';

// ? This is a NextJS special "config" export
export { defaultConfig as config } from 'universe/backend/api';

export default withMiddleware(
  async (req, res) => {
    const username = req.query.username?.toString();

    if (req.method == 'GET') {
      sendHttpOk(res, { user: await getUser({ username }) });
    } else if (req.method == 'DELETE') {
      await deleteUser({ username });
      sendHttpOk(res);
    } // * PATCH
    else {
      await updateUser({ username, data: req.body });
      sendHttpOk(res);
    }
  },
  {
    options: { allowedMethods: ['GET', 'DELETE', 'PATCH'], apiVersion: '1' }
  }
);

import { withMiddleware } from 'universe/backend/middleware';
import { createUser, getAllUsers } from 'universe/backend';
import { sendHttpOk } from 'multiverse/next-api-respond';

// ? This is a NextJS special "config" export
export { defaultConfig as config } from 'universe/backend/api';

export const metadata = {
  descriptor: '/users'
};

export default withMiddleware(
  async (req, res) => {
    if (req.method == 'GET') {
      sendHttpOk(res, {
        users: await getAllUsers({ after_id: req.query.after?.toString() })
      });
      // * POST
    } else sendHttpOk(res, { user: await createUser({ data: req.body }) });
  },
  {
    descriptor: metadata.descriptor,
    options: { allowedMethods: ['GET', 'POST'], apiVersion: '1' }
  }
);

import { withMiddleware } from 'universe/backend/middleware';
import { sendHttpOk } from 'multiverse/next-api-respond';
import { updateUser } from 'universe/backend';

// ? This is a NextJS special "config" export
export { defaultConfig as config } from 'universe/backend/api';

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
  { options: { allowedMethods: ['PATCH'], apiVersion: '1' } }
);

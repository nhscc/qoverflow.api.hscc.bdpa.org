import { withMiddleware } from 'universe/backend/middleware';
import { sendHttpOk } from 'multiverse/next-api-respond';
import { getUserMessages } from 'universe/backend';

// ? This is a NextJS special "config" export
export { defaultConfig as config } from 'universe/backend/api';

export const metadata = {
  descriptor: '/mail/:username'
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
    options: { allowedMethods: ['GET'], apiVersion: '1' }
  }
);

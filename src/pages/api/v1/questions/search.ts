import { withMiddleware } from 'universe/backend/middleware';
import { sendHttpOk } from 'multiverse/next-api-respond';

// ? This is a NextJS special "config" export
export { defaultConfig as config } from 'universe/backend/api';

export default withMiddleware(
  async (req, res) => {
    void req, res, sendHttpOk;
    // TODO
  },
  {
    options: { allowedMethods: ['GET'], apiVersion: '1' }
  }
);

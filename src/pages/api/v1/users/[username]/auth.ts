import { sendHttpOk, sendHttpUnauthorized } from '@-xun/respond';
import { authAppUser } from '@nhscc/backend-qoverflow~npm';

import { withMiddleware } from 'universe:route-wrapper.ts';

export { defaultConfig as config } from '@nhscc/backend-qoverflow~npm/api';

export const metadata = {
  descriptor: '/v1/users/:username/auth',
  apiVersion: '1'
};

// * The next version of this should use GET and POST as follows:
// TODO: 1. GET to get the permanent user salt and a one-time fresh salt
// TODO:    Fresh salts are stored per-ip and expire after 15 seconds
// TODO: 2. POST to send fresh salt & PBKDF(fresh salt, PBKDF(user salt, passwd))
// TODO:    Client sends fresh salt only to confirm that salt hasn't expired.
// !        !!! CLIENT-PROVIDED SALT IS NOT REFERENCED TO PERFORM PBKDF !!!
// TODO: 3. Server checks client-provided salt against db, confirms not expired
// TODO:    If expired, server responds with HTTP 410 GONE and terminates
// TODO: 4. Server computes PBKDF(fresh salt, stored key) and compares
// TODO: 5. Server responds to POST with 200 on success, 403 on error
// TODO: 6. After response is sent, close connection & maybe prune expired salts

export default withMiddleware(
  async (req, res) => {
    switch (req.method) {
      case 'POST': {
        const authorized = await authAppUser({
          username: req.query.username?.toString(),
          key: req.body?.key
        });

        if (authorized) {
          sendHttpOk(res);
        } else {
          sendHttpUnauthorized(res);
        }

        break;
      }
    }
  },
  {
    descriptor: metadata.descriptor,
    options: {
      allowedMethods: ['POST'],
      apiVersion: metadata.apiVersion
    }
  }
);

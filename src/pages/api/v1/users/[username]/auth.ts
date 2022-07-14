import { withMiddleware } from 'universe/backend/middleware';
import { authAppUser } from 'universe/backend';
import { sendHttpOk, sendHttpUnauthorized } from 'multiverse/next-api-respond';

// ? This is a NextJS special "config" export
export { defaultConfig as config } from 'universe/backend/api';

export const metadata = {
  descriptor: '/users/:username/auth'
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
    // * POST
    (await authAppUser({
      username: req.query.username?.toString(),
      key: req.body?.key
    }))
      ? sendHttpOk(res)
      : sendHttpUnauthorized(res);
  },
  {
    descriptor: metadata.descriptor,
    options: { allowedMethods: ['POST'], apiVersion: '1' }
  }
);

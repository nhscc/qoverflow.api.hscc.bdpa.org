// * Fix some super bad weirdness in Next.js that's been around for 5+ years
// TODO: still needed?

import type { ServerResponse } from 'node:http';

function Error({ statusCode }: { statusCode: string }) {
  return (
    <p>
      {statusCode
        ? `An error ${statusCode} occurred on server`
        : 'An error occurred on client'}
    </p>
  );
}

Error.getInitialProps = ({
  res,
  err
}: {
  res?: ServerResponse;
  err?: ServerResponse;
}) => {
  const statusCode = res ? res.statusCode : err ? err.statusCode : 404;
  return { statusCode };
};

export default Error;

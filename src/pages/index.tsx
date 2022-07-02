import * as React from 'react';
import { version as pkgVersion } from 'package';
import { getEnv } from 'universe/backend/env';
// import { initializeDb } from 'multiverse/mongo-schema';
// import { hydrateDb } from 'multiverse/mongo-test';

export async function getServerSideProps() {
  const env = getEnv();

  // await initializeDb({ name: 'root' });
  // await initializeDb({ name: 'hscc-api-qoverflow' });
  // ! Careful when using these to populate production: they can be destructive!
  // await hydrateDb({ name: 'hscc-api-qoverflow' });
  // ! Uncommenting this for prod is usually unnecessary
  // await hydrateDb({ name: 'root' });

  return {
    props: {
      isInProduction: env.NODE_ENV == 'production',
      nodeEnv: env.NODE_ENV,
      nodeVersion: process.version
    }
  };
}

export default function Index({
  isInProduction,
  nodeEnv,
  nodeVersion
}: Awaited<ReturnType<typeof getServerSideProps>>['props']) {
  return (
    <React.Fragment>
      <p>
        Serverless node runtime: <strong>{nodeVersion}</strong> <br />
        qOverflow runtime: <strong>{`v${pkgVersion}`}</strong>
        <br />
      </p>
      <p>
        Environment: <strong>{nodeEnv}</strong> <br />
        Production mode:{' '}
        <strong>
          {isInProduction ? (
            <span style={{ color: 'green' }}>yes</span>
          ) : (
            <span style={{ color: 'red' }}>no</span>
          )}
        </strong>
        <br />
      </p>
    </React.Fragment>
  );
}

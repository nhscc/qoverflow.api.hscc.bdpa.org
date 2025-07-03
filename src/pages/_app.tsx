import Head from 'next/head';
import React from 'react';

import type { AppProps } from 'next/app';

export default function App({ Component, pageProps }: AppProps) {
  return (
    <React.Fragment>
      <Head>
        <title>No Browser Access!</title>
      </Head>
      <React.StrictMode>
        <Component {...pageProps} />
      </React.StrictMode>
    </React.Fragment>
  );
}

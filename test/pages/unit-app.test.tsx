/**
 * @jest-environment jest-fixed-jsdom
 */
import { render, screen } from '@testing-library/react';

import App from 'universe:pages/_app.tsx';

import type { AppProps } from 'next/app';

it('renders without crashing', async () => {
  expect.hasAssertions();

  render(
    <App {...({ Component: () => <div>Hello, world!</div> } as unknown as AppProps)} />
  );

  expect(screen.getByText('Hello, world!')).toBeInTheDocument();
});

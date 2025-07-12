/**
 * @jest-environment jest-fixed-jsdom
 */
import { render, screen } from '@testing-library/react';
// add custom jest matchers from jest-dom
import '@testing-library/jest-dom';

import IndexPage, { getServerSideProps } from 'universe:pages/index.tsx';

it('renders without crashing', async () => {
  expect.hasAssertions();

  const serverSideProperties = (await getServerSideProps()).props;

  render(<IndexPage {...serverSideProperties} />);
  expect(screen.getByText('no')).toBeInTheDocument();

  render(<IndexPage {...{ ...serverSideProperties, isInProduction: true }} />);
  expect(screen.getByText('yes')).toBeInTheDocument();
});

import { getCommonSchemaConfig, getCommonDummyData } from 'multiverse/mongo-common';

describe('::getCommonSchemaConfig', () => {
  it('returns an object with dummy root schema and additional dummy schema', async () => {
    expect.hasAssertions();

    expect(
      getCommonSchemaConfig({
        databases: { someDb: { collections: [] } },
        aliases: {}
      })
    ).toStrictEqual({
      databases: {
        root: expect.toBeObject(),
        someDb: expect.toBeObject()
      },
      aliases: {}
    });
  });

  it('throws if an alias references a non-existent database name', async () => {
    expect.hasAssertions();

    expect(() =>
      getCommonSchemaConfig({
        databases: { someDb: { collections: [] } },
        aliases: { app: 'badDb' }
      })
    ).toThrow(
      /aliased database "badDb" \(referred to by alias "app"\) does not exist/
    );
  });

  it('throws if an alias itself conflicts with a database name', async () => {
    expect.hasAssertions();

    expect(() =>
      getCommonSchemaConfig({
        databases: { someDb: { collections: [] } },
        aliases: { someDb: 'root' }
      })
    ).toThrow(
      /database alias "someDb" \(referring to actual database "root"\) is invalid/
    );
  });
});

describe('::getCommonDummyData', () => {
  it('returns an object with dummy root data and additional dummy data', async () => {
    expect.hasAssertions();

    const customDummyData = { someDb: { _generatedAt: 123 } };

    expect(getCommonDummyData(customDummyData)).toStrictEqual({
      root: expect.toBeObject(),
      someDb: expect.toBeObject()
    });
  });
});

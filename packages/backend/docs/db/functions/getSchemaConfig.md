[**@nhscc/backend-qoverflow**](../../README.md)

***

[@nhscc/backend-qoverflow](../../README.md) / [db](../README.md) / getSchemaConfig

# Function: getSchemaConfig()

> **getSchemaConfig**(): `DbSchema`

Defined in: [packages/backend/src/db.ts:21](https://github.com/nhscc/qoverflow.api.hscc.bdpa.org/blob/427e25011f0e71265852f81f85026e1290417c2b/packages/backend/src/db.ts#L21)

A JSON representation of the backend Mongo database structure. This is used
for consistent app-wide db access across projects and to generate transient
versions of the db during testing.

## Returns

`DbSchema`

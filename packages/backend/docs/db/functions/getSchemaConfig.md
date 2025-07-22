[**@nhscc/backend-qoverflow**](../../README.md)

***

[@nhscc/backend-qoverflow](../../README.md) / [db](../README.md) / getSchemaConfig

# Function: getSchemaConfig()

> **getSchemaConfig**(): `DbSchema`

Defined in: [packages/backend/src/db.ts:21](https://github.com/nhscc/qoverflow.api.hscc.bdpa.org/blob/e58635515aaccbecfff868b37cbae9a64bb762c2/packages/backend/src/db.ts#L21)

A JSON representation of the backend Mongo database structure. This is used
for consistent app-wide db access across projects and to generate transient
versions of the db during testing.

## Returns

`DbSchema`

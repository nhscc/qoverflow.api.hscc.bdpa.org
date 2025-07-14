[**@nhscc/backend-qoverflow**](../../README.md)

***

[@nhscc/backend-qoverflow](../../README.md) / [db](../README.md) / vacuousProjection

# Variable: vacuousProjection

> `const` **vacuousProjection**: `object`

Defined in: [packages/backend/src/db.ts:557](https://github.com/nhscc/qoverflow.api.hscc.bdpa.org/blob/b629239838bf73900bba2996b8dcfbc432755e21/packages/backend/src/db.ts#L557)

A meaningless MongoDB cursor projection used for existence checking without
wasting the bandwidth to pull down all of the data that might be embedded
within an object's fields.

## Type declaration

### exists

> **exists**: `object`

#### exists.$literal

> **$literal**: `boolean` = `true`

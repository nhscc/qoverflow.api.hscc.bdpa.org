[**@nhscc/backend-qoverflow**](../../README.md)

***

[@nhscc/backend-qoverflow](../../README.md) / [db](../README.md) / selectResultProjection

# Function: selectResultProjection()

> **selectResultProjection**(`username`): `object`

Defined in: [packages/backend/src/db.ts:611](https://github.com/nhscc/qoverflow.api.hscc.bdpa.org/blob/b629239838bf73900bba2996b8dcfbc432755e21/packages/backend/src/db.ts#L611)

A MongoDB cursor projection that returns select information about an internal
question, answer, or comment for the purpose of vote update operation
authorization.

## Parameters

### username

`string`

## Returns

`object`

### \_id

> **\_id**: `boolean` = `false`

### isCreator

> **isCreator**: `object`

#### isCreator.$eq

> **$eq**: `string`[]

### voterStatus

> **voterStatus**: `object`

#### voterStatus.$switch

> **$switch**: `object`

#### voterStatus.$switch.branches

> **branches**: `object`[]

#### voterStatus.$switch.default

> **default**: `null` = `null`

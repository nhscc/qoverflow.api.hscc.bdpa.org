[**@nhscc/backend-qoverflow**](../../README.md)

***

[@nhscc/backend-qoverflow](../../README.md) / [db](../README.md) / selectResultProjection

# Function: selectResultProjection()

> **selectResultProjection**(`username`): `object`

Defined in: [packages/backend/src/db.ts:611](https://github.com/nhscc/qoverflow.api.hscc.bdpa.org/blob/427e25011f0e71265852f81f85026e1290417c2b/packages/backend/src/db.ts#L611)

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

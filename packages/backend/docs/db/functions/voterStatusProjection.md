[**@nhscc/backend-qoverflow**](../../README.md)

***

[@nhscc/backend-qoverflow](../../README.md) / [db](../README.md) / voterStatusProjection

# Function: voterStatusProjection()

> **voterStatusProjection**(`username`): `object`

Defined in: [packages/backend/src/db.ts:574](https://github.com/nhscc/qoverflow.api.hscc.bdpa.org/blob/b629239838bf73900bba2996b8dcfbc432755e21/packages/backend/src/db.ts#L574)

A MongoDB cursor projection that evaluates an internal question, answer, or
comment and returns how the specified user voted on said item.

## Parameters

### username

`string`

## Returns

`object`

### \_id

> **\_id**: `boolean` = `false`

### voterStatus

> **voterStatus**: `object`

#### voterStatus.$switch

> **$switch**: `object`

#### voterStatus.$switch.branches

> **branches**: `object`[]

#### voterStatus.$switch.default

> **default**: `null` = `null`

[**@nhscc/backend-qoverflow**](../../README.md)

***

[@nhscc/backend-qoverflow](../../README.md) / [db](../README.md) / publicAnswerProjection

# Function: publicAnswerProjection()

> **publicAnswerProjection**(`questionId`): `object`

Defined in: [packages/backend/src/db.ts:493](https://github.com/nhscc/qoverflow.api.hscc.bdpa.org/blob/f5ce596891ef5639d9d2800df6d35c0e862108c3/packages/backend/src/db.ts#L493)

A MongoDB cursor projection that transforms an internal answer into a public
answer.

## Parameters

### questionId

[`QuestionId`](../interfaces/QuestionId.md)

## Returns

`object`

### \_id

> `readonly` **\_id**: `false` = `false`

### accepted

> `readonly` **accepted**: `true` = `true`

### answer\_id

> `readonly` **answer\_id**: `object`

#### answer\_id.$toString

> `readonly` **$toString**: `"$_id"` = `'$_id'`

### comments

> `readonly` **comments**: `object`

#### comments.$size

> `readonly` **$size**: `"$commentItems"` = `'$commentItems'`

### createdAt

> `readonly` **createdAt**: `true` = `true`

### creator

> `readonly` **creator**: `true` = `true`

### downvotes

> `readonly` **downvotes**: `true` = `true`

### question\_id

> `readonly` **question\_id**: `string`

### text

> `readonly` **text**: `true` = `true`

### upvotes

> `readonly` **upvotes**: `true` = `true`

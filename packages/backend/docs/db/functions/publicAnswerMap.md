[**@nhscc/backend-qoverflow**](../../README.md)

***

[@nhscc/backend-qoverflow](../../README.md) / [db](../README.md) / publicAnswerMap

# Function: publicAnswerMap()

> **publicAnswerMap**(`variable`, `questionId`): `object`

Defined in: [packages/backend/src/db.ts:511](https://github.com/nhscc/qoverflow.api.hscc.bdpa.org/blob/e58635515aaccbecfff868b37cbae9a64bb762c2/packages/backend/src/db.ts#L511)

A MongoDB aggregation expression that maps an internal answer into a public
answer.

## Parameters

### variable

`string`

### questionId

[`QuestionId`](../interfaces/QuestionId.md)

## Returns

`object`

### accepted

> `readonly` **accepted**: `` `$$${string}.accepted` ``

### answer\_id

> `readonly` **answer\_id**: `object`

#### answer\_id.$toString

> `readonly` **$toString**: `` `$$${string}._id` ``

### comments

> `readonly` **comments**: `object`

#### comments.$size

> `readonly` **$size**: `` `$$${string}.commentItems` ``

### createdAt

> `readonly` **createdAt**: `` `$$${string}.createdAt` ``

### creator

> `readonly` **creator**: `` `$$${string}.creator` ``

### downvotes

> `readonly` **downvotes**: `` `$$${string}.downvotes` ``

### question\_id

> `readonly` **question\_id**: `string`

### text

> `readonly` **text**: `` `$$${string}.text` ``

### upvotes

> `readonly` **upvotes**: `` `$$${string}.upvotes` ``

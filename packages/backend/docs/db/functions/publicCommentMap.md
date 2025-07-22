[**@nhscc/backend-qoverflow**](../../README.md)

***

[@nhscc/backend-qoverflow](../../README.md) / [db](../README.md) / publicCommentMap

# Function: publicCommentMap()

> **publicCommentMap**(`variable`): `object`

Defined in: [packages/backend/src/db.ts:542](https://github.com/nhscc/qoverflow.api.hscc.bdpa.org/blob/e58635515aaccbecfff868b37cbae9a64bb762c2/packages/backend/src/db.ts#L542)

A MongoDB aggregation expression that maps an internal comment into a public
comment.

## Parameters

### variable

`string`

## Returns

`object`

### comment\_id

> `readonly` **comment\_id**: `object`

#### comment\_id.$toString

> `readonly` **$toString**: `` `$$${string}._id` ``

### createdAt

> `readonly` **createdAt**: `` `$$${string}.createdAt` ``

### creator

> `readonly` **creator**: `` `$$${string}.creator` ``

### downvotes

> `readonly` **downvotes**: `` `$$${string}.downvotes` ``

### text

> `readonly` **text**: `` `$$${string}.text` ``

### upvotes

> `readonly` **upvotes**: `` `$$${string}.upvotes` ``

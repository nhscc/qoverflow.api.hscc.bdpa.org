[**@nhscc/backend-qoverflow**](../../README.md)

***

[@nhscc/backend-qoverflow](../../README.md) / [db](../README.md) / publicCommentProjection

# Variable: publicCommentProjection

> `const` **publicCommentProjection**: `object`

Defined in: [packages/backend/src/db.ts:528](https://github.com/nhscc/qoverflow.api.hscc.bdpa.org/blob/427e25011f0e71265852f81f85026e1290417c2b/packages/backend/src/db.ts#L528)

A MongoDB cursor projection that transforms an internal comment into a public
comment.

## Type declaration

### \_id

> `readonly` **\_id**: `false` = `false`

### comment\_id

> `readonly` **comment\_id**: `object`

#### comment\_id.$toString

> `readonly` **$toString**: `"$_id"` = `'$_id'`

### createdAt

> `readonly` **createdAt**: `true` = `true`

### creator

> `readonly` **creator**: `true` = `true`

### downvotes

> `readonly` **downvotes**: `true` = `true`

### text

> `readonly` **text**: `true` = `true`

### upvotes

> `readonly` **upvotes**: `true` = `true`

[**@nhscc/backend-qoverflow**](../../README.md)

***

[@nhscc/backend-qoverflow](../../README.md) / [db](../README.md) / publicQuestionProjection

# Variable: publicQuestionProjection

> `const` **publicQuestionProjection**: `object`

Defined in: [packages/backend/src/db.ts:473](https://github.com/nhscc/qoverflow.api.hscc.bdpa.org/blob/427e25011f0e71265852f81f85026e1290417c2b/packages/backend/src/db.ts#L473)

A MongoDB cursor projection that transforms an internal question into a
public question.

## Type declaration

### \_id

> `readonly` **\_id**: `false` = `false`

### answers

> `readonly` **answers**: `true` = `true`

### comments

> `readonly` **comments**: `true` = `true`

### createdAt

> `readonly` **createdAt**: `true` = `true`

### creator

> `readonly` **creator**: `true` = `true`

### downvotes

> `readonly` **downvotes**: `true` = `true`

### hasAcceptedAnswer

> `readonly` **hasAcceptedAnswer**: `true` = `true`

### question\_id

> `readonly` **question\_id**: `object`

#### question\_id.$toString

> `readonly` **$toString**: `"$_id"` = `'$_id'`

### status

> `readonly` **status**: `true` = `true`

### text

> `readonly` **text**: `true` = `true`

### title

> `readonly` **title**: `true` = `true`

### upvotes

> `readonly` **upvotes**: `true` = `true`

### views

> `readonly` **views**: `true` = `true`

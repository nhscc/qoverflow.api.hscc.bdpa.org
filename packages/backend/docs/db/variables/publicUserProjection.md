[**@nhscc/backend-qoverflow**](../../README.md)

***

[@nhscc/backend-qoverflow](../../README.md) / [db](../README.md) / publicUserProjection

# Variable: publicUserProjection

> `const` **publicUserProjection**: `object`

Defined in: [packages/backend/src/db.ts:445](https://github.com/nhscc/qoverflow.api.hscc.bdpa.org/blob/7f72ded3e1b4a649a6466e0d002164176291fadc/packages/backend/src/db.ts#L445)

A MongoDB cursor projection that transforms an internal user into a public
user.

## Type declaration

### \_id

> `readonly` **\_id**: `false` = `false`

### answers

> `readonly` **answers**: `object`

#### answers.$size

> `readonly` **$size**: `"$answerIds"` = `'$answerIds'`

### email

> `readonly` **email**: `true` = `true`

### points

> `readonly` **points**: `true` = `true`

### questions

> `readonly` **questions**: `object`

#### questions.$size

> `readonly` **$size**: `"$questionIds"` = `'$questionIds'`

### salt

> `readonly` **salt**: `true` = `true`

### user\_id

> `readonly` **user\_id**: `object`

#### user\_id.$toString

> `readonly` **$toString**: `"$_id"` = `'$_id'`

### username

> `readonly` **username**: `true` = `true`

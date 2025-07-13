[**@nhscc/backend-qoverflow**](../../README.md)

***

[@nhscc/backend-qoverflow](../../README.md) / [db](../README.md) / publicMailProjection

# Variable: publicMailProjection

> `const` **publicMailProjection**: `object`

Defined in: [packages/backend/src/db.ts:459](https://github.com/nhscc/qoverflow.api.hscc.bdpa.org/blob/427e25011f0e71265852f81f85026e1290417c2b/packages/backend/src/db.ts#L459)

A MongoDB cursor projection that transforms internal mail into public mail.

## Type declaration

### \_id

> `readonly` **\_id**: `false` = `false`

### createdAt

> `readonly` **createdAt**: `true` = `true`

### mail\_id

> `readonly` **mail\_id**: `object`

#### mail\_id.$toString

> `readonly` **$toString**: `"$_id"` = `'$_id'`

### receiver

> `readonly` **receiver**: `true` = `true`

### sender

> `readonly` **sender**: `true` = `true`

### subject

> `readonly` **subject**: `true` = `true`

### text

> `readonly` **text**: `true` = `true`

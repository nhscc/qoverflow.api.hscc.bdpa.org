[**@nhscc/backend-qoverflow**](../../README.md)

***

[@nhscc/backend-qoverflow](../../README.md) / [db](../README.md) / PublicUser

# Type Alias: PublicUser

> **PublicUser** = `Omit`\<`WithoutId`\<[`InternalUser`](InternalUser.md)\>, `"key"` \| `"questionIds"` \| `"answerIds"`\> & `object`

Defined in: [packages/backend/src/db.ts:134](https://github.com/nhscc/qoverflow.api.hscc.bdpa.org/blob/f5ce596891ef5639d9d2800df6d35c0e862108c3/packages/backend/src/db.ts#L134)

The shape of a public application user.

## Type declaration

### answers

> **answers**: `number`

### questions

> **questions**: `number`

### user\_id

> **user\_id**: `string`

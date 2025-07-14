[**@nhscc/backend-qoverflow**](../../README.md)

***

[@nhscc/backend-qoverflow](../../README.md) / [db](../README.md) / PublicComment

# Type Alias: PublicComment

> **PublicComment** = `Omit`\<`WithoutId`\<[`InternalComment`](InternalComment.md)\>, `"upvoterUsernames"` \| `"downvoterUsernames"`\> & `object`

Defined in: [packages/backend/src/db.ts:343](https://github.com/nhscc/qoverflow.api.hscc.bdpa.org/blob/b629239838bf73900bba2996b8dcfbc432755e21/packages/backend/src/db.ts#L343)

The shape of a public comment.

## Type declaration

### comment\_id

> **comment\_id**: `string`

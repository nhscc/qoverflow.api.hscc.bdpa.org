[**@nhscc/backend-qoverflow**](../../README.md)

***

[@nhscc/backend-qoverflow](../../README.md) / [db](../README.md) / PatchUser

# Type Alias: PatchUser

> **PatchUser** = `Partial`\<`Omit`\<`WithoutId`\<[`InternalUser`](InternalUser.md)\>, `"username"` \| `"questionIds"` \| `"answerIds"` \| `"points"`\> & `object`\>

Defined in: [packages/backend/src/db.ts:153](https://github.com/nhscc/qoverflow.api.hscc.bdpa.org/blob/f5ce596891ef5639d9d2800df6d35c0e862108c3/packages/backend/src/db.ts#L153)

The shape of a patch application user.

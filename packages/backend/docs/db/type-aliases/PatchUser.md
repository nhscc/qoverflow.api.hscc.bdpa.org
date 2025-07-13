[**@nhscc/backend-qoverflow**](../../README.md)

***

[@nhscc/backend-qoverflow](../../README.md) / [db](../README.md) / PatchUser

# Type Alias: PatchUser

> **PatchUser** = `Partial`\<`Omit`\<`WithoutId`\<[`InternalUser`](InternalUser.md)\>, `"username"` \| `"questionIds"` \| `"answerIds"` \| `"points"`\> & `object`\>

Defined in: [packages/backend/src/db.ts:153](https://github.com/nhscc/qoverflow.api.hscc.bdpa.org/blob/427e25011f0e71265852f81f85026e1290417c2b/packages/backend/src/db.ts#L153)

The shape of a patch application user.

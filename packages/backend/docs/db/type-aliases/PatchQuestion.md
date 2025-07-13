[**@nhscc/backend-qoverflow**](../../README.md)

***

[@nhscc/backend-qoverflow](../../README.md) / [db](../README.md) / PatchQuestion

# Type Alias: PatchQuestion

> **PatchQuestion** = `Partial`\<`Omit`\<`WithoutId`\<[`InternalQuestion`](InternalQuestion.md)\>, `"creator"` \| `"title-lowercase"` \| `"createdAt"` \| `"hasAcceptedAnswer"` \| `"upvoterUsernames"` \| `"downvoterUsernames"` \| `"answers"` \| `"answerItems"` \| `"comments"` \| `"commentItems"` \| `"views"` \| `"sorter"`\> & `object`\>

Defined in: [packages/backend/src/db.ts:258](https://github.com/nhscc/qoverflow.api.hscc.bdpa.org/blob/427e25011f0e71265852f81f85026e1290417c2b/packages/backend/src/db.ts#L258)

The shape of a patch question.

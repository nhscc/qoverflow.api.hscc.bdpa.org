[**@nhscc/backend-qoverflow**](../../README.md)

***

[@nhscc/backend-qoverflow](../../README.md) / [db](../README.md) / PatchQuestion

# Type Alias: PatchQuestion

> **PatchQuestion** = `Partial`\<`Omit`\<`WithoutId`\<[`InternalQuestion`](InternalQuestion.md)\>, `"creator"` \| `"title-lowercase"` \| `"createdAt"` \| `"hasAcceptedAnswer"` \| `"upvoterUsernames"` \| `"downvoterUsernames"` \| `"answers"` \| `"answerItems"` \| `"comments"` \| `"commentItems"` \| `"views"` \| `"sorter"`\> & `object`\>

Defined in: [packages/backend/src/db.ts:258](https://github.com/nhscc/qoverflow.api.hscc.bdpa.org/blob/b629239838bf73900bba2996b8dcfbc432755e21/packages/backend/src/db.ts#L258)

The shape of a patch question.

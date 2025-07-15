[**@nhscc/backend-qoverflow**](../../README.md)

***

[@nhscc/backend-qoverflow](../../README.md) / [db](../README.md) / InternalQuestion

# Type Alias: InternalQuestion

> **InternalQuestion** = `WithId`\<\{ `answerItems`: [`InternalAnswer`](InternalAnswer.md)[]; `answers`: `number`; `commentItems`: [`InternalComment`](InternalComment.md)[]; `comments`: `number`; `createdAt`: `UnixEpochMs`; `creator`: [`Username`](Username.md); `downvoterUsernames`: [`Username`](Username.md)[]; `downvotes`: `number`; `hasAcceptedAnswer`: `boolean`; `sorter`: \{ `uvac`: `number`; `uvc`: `number`; \}; `status`: *typeof* [`questionStatuses`](../variables/questionStatuses.md)\[`number`\]; `text`: `string`; `title`: `string`; `title-lowercase`: `string`; `upvoterUsernames`: [`Username`](Username.md)[]; `upvotes`: `number`; `views`: `number`; \}\>

Defined in: [packages/backend/src/db.ts:196](https://github.com/nhscc/qoverflow.api.hscc.bdpa.org/blob/f5ce596891ef5639d9d2800df6d35c0e862108c3/packages/backend/src/db.ts#L196)

The shape of an internal question.

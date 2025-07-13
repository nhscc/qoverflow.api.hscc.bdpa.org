[**@nhscc/backend-qoverflow**](../../README.md)

***

[@nhscc/backend-qoverflow](../../README.md) / [db](../README.md) / InternalAnswer

# Type Alias: InternalAnswer

> **InternalAnswer** = `WithId`\<\{ `accepted`: `boolean`; `commentItems`: [`InternalComment`](InternalComment.md)[]; `createdAt`: `UnixEpochMs`; `creator`: [`Username`](Username.md); `downvoterUsernames`: [`Username`](Username.md)[]; `downvotes`: `number`; `text`: `string`; `upvoterUsernames`: [`Username`](Username.md)[]; `upvotes`: `number`; \}\>

Defined in: [packages/backend/src/db.ts:279](https://github.com/nhscc/qoverflow.api.hscc.bdpa.org/blob/427e25011f0e71265852f81f85026e1290417c2b/packages/backend/src/db.ts#L279)

The shape of an internal answer.

[**@nhscc/backend-qoverflow**](../../README.md)

***

[@nhscc/backend-qoverflow](../../README.md) / [db](../README.md) / VotesUpdateOperation

# Type Alias: VotesUpdateOperation

> **VotesUpdateOperation** = `object`

Defined in: [packages/backend/src/db.ts:105](https://github.com/nhscc/qoverflow.api.hscc.bdpa.org/blob/427e25011f0e71265852f81f85026e1290417c2b/packages/backend/src/db.ts#L105)

The shape of an update operation on a question or comment's
upvotes/downvotes.

## Properties

### op

> **op**: `"increment"` \| `"decrement"`

Defined in: [packages/backend/src/db.ts:106](https://github.com/nhscc/qoverflow.api.hscc.bdpa.org/blob/427e25011f0e71265852f81f85026e1290417c2b/packages/backend/src/db.ts#L106)

***

### target

> **target**: `"upvotes"` \| `"downvotes"`

Defined in: [packages/backend/src/db.ts:107](https://github.com/nhscc/qoverflow.api.hscc.bdpa.org/blob/427e25011f0e71265852f81f85026e1290417c2b/packages/backend/src/db.ts#L107)

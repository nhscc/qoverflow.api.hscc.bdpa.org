[**@nhscc/backend-qoverflow**](../../README.md)

***

[@nhscc/backend-qoverflow](../../README.md) / [db](../README.md) / MailId

# Interface: MailId

Defined in: [packages/backend/src/db.ts:88](https://github.com/nhscc/qoverflow.api.hscc.bdpa.org/blob/f5ce596891ef5639d9d2800df6d35c0e862108c3/packages/backend/src/db.ts#L88)

## Extends

- `ObjectId`

## Accessors

### \_bsontype

#### Get Signature

> **get** **\_bsontype**(): `"ObjectId"`

Defined in: node\_modules/bson/bson.d.ts:1344

##### Returns

`"ObjectId"`

#### Inherited from

`ObjectId._bsontype`

***

### id

#### Get Signature

> **get** **id**(): `Uint8Array`

Defined in: node\_modules/bson/bson.d.ts:1391

The ObjectId bytes

##### Returns

`Uint8Array`

#### Inherited from

`ObjectId.id`

## Methods

### equals()

> **equals**(`otherId`): `boolean`

Defined in: node\_modules/bson/bson.d.ts:1416

Compares the equality of this ObjectId with `otherID`.

#### Parameters

##### otherId

ObjectId instance to compare against.

`undefined` | `null` | `string` | `ObjectId` | `ObjectIdLike`

#### Returns

`boolean`

#### Inherited from

`ObjectId.equals`

***

### getTimestamp()

> **getTimestamp**(): `Date`

Defined in: node\_modules/bson/bson.d.ts:1418

Returns the generation date (accurate up to the second) that this ID was generated.

#### Returns

`Date`

#### Inherited from

`ObjectId.getTimestamp`

***

### inspect()

> **inspect**(`depth?`, `options?`, `inspect?`): `string`

Defined in: node\_modules/bson/bson.d.ts:1448

Converts to a string representation of this Id.

#### Parameters

##### depth?

`number`

##### options?

`unknown`

##### inspect?

`InspectFn`

#### Returns

`string`

return the 24 character hex string representation.

#### Inherited from

`ObjectId.inspect`

***

### toHexString()

> **toHexString**(): `string`

Defined in: node\_modules/bson/bson.d.ts:1395

Returns the ObjectId id as a 24 lowercase character hex string representation

#### Returns

`string`

#### Inherited from

`ObjectId.toHexString`

***

### toJSON()

> **toJSON**(): `string`

Defined in: node\_modules/bson/bson.d.ts:1409

Converts to its JSON the 24 character hex string representation.

#### Returns

`string`

#### Inherited from

`ObjectId.toJSON`

***

### toString()

> **toString**(`encoding?`): `string`

Defined in: node\_modules/bson/bson.d.ts:1407

Converts the id into a 24 character hex string for printing, unless encoding is provided.

#### Parameters

##### encoding?

hex or base64

`"hex"` | `"base64"`

#### Returns

`string`

#### Inherited from

`ObjectId.toString`

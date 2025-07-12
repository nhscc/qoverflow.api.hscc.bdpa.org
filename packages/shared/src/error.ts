/**
 * A collection of possible error and warning messages.
 */
export const ErrorMessage = {
  GuruMeditation: () => 'an impossible scenario occurred',
  InvalidItem: (item: unknown, itemName: string) =>
    // eslint-disable-next-line @typescript-eslint/no-base-to-string
    `invalid ${itemName}${item !== undefined ? ` "${String(item)}"` : ''}`,
  InvalidSecret: (secretType?: string) =>
    ErrorMessage.InvalidItem(undefined, secretType ?? 'secret'),
  TooManyItemsRequested: (itemsName: string) => `too many ${itemsName} requested`,
  DuplicateFieldValue: (item: string) => `an item with that "${item}" already exists`,
  InvalidFieldValue: (item: string) =>
    `\`${item}\` field has a missing, invalid, or illegal value`,
  InvalidArrayValue: (item: string, value: string) =>
    `the \`${item}\` array element "${value}" is invalid or illegal`,
  InvalidObjectKeyValue: (item: string) =>
    `a \`${item}\` object key has an invalid or illegal value`,
  IllegalUsername: () => 'a user with that username cannot be created',
  InvalidJSON: (property?: string) =>
    'encountered invalid JSON' + (property ? ` in property \`${property}\`` : ''),
  InvalidStringLength: (
    item: string,
    min: number | string,
    max: number | string | null,
    syntax: 'string' | 'alphanumeric' | 'hexadecimal' | 'bytes' = 'alphanumeric',
    nullable = false,
    isArray = false
  ) =>
    `${isArray ? `each \`${item}\` element` : `\`${item}\``} must be a${
      syntax === 'alphanumeric'
        ? 'n alphanumeric'
        : syntax === 'hexadecimal'
          ? ' hexadecimal'
          : ''
    } ${
      max
        ? `string between ${min} and ${max} ${
            syntax === 'bytes' ? 'byte' : 'character'
          }s (inclusive)`
        : `${min} ${syntax === 'bytes' ? 'byte' : 'character'} string`
    }${nullable ? ' or null' : ''}`,
  InvalidObjectId: (id: string) => `invalid ObjectId "${id}"`,
  UnknownField: (item: string) => `encountered unknown or illegal field \`${item}\``,
  UnknownSpecifier: (item: string, sub = false) =>
    `encountered unknown or illegal ${sub ? 'sub-' : ''}specifier \`${item}\``,
  UnknownPermissionsSpecifier: () =>
    'encountered unknown specifier `permissions`. Did you mean to use `permissions.username-goes-here`?',
  InvalidSpecifierValueType: (item: string, type: string, sub = false) =>
    `\`${item}\` has invalid ${sub ? 'sub-' : ''}specifier value type (must be ${type})`,
  InvalidRegexString: (item: string) => `\`${item}\` has invalid or illegal regex value`,
  InvalidMatcher: (item: string) => `invalid \`${item}\`: must be object`,
  InvalidOrSpecifier: () =>
    'invalid "$or" sub-specifier: must be array with exactly two elements',
  InvalidOrSpecifierNonObject: (index: number) =>
    `invalid "$or" sub-specifier at index ${index}: all array elements must be objects`,
  InvalidOrSpecifierBadLength: (index: number) =>
    `invalid "$or" sub-specifier at index ${index}: only one sub-specifier allowed per array element`,
  InvalidOrSpecifierInvalidKey: (index: number, key: string) =>
    `invalid "$or" sub-specifier at index ${index}: invalid sub-key "${key}"`,
  InvalidOrSpecifierInvalidValueType: (index: number, key: string) =>
    `invalid "$or" sub-specifier at index ${index}: sub-key "${key}" has invalid value type (must be number)`,
  NotFound: () => 'item or resource was not found',
  ItemNotFound: (item: unknown, itemName: string) =>
    // eslint-disable-next-line @typescript-eslint/no-base-to-string
    item ? `${itemName} "${String(item)}" was not found` : 'item was not found',
  ItemOrItemsNotFound: (itemsName: string) => `one or more ${itemsName} were not found`
};

export {
  ApiError,
  AuthError,
  ClientValidationError,
  ForbiddenError,
  NotFoundError,
  NotImplementedError,
  SanityError,
  ServerValidationError
} from '@-xun/api-strategy/error';

import { ErrorMessage as NamedErrorMessage } from 'named-app-errors';

export * from 'named-app-errors';

/**
 * A collection of possible error and warning messages.
 */
export const ErrorMessage = {
  ...NamedErrorMessage,
  TooManyItemsRequested: (itemsName: string) => `too many ${itemsName} requested`,
  DuplicateFieldValue: (prop: string) => `an item with that "${prop}" already exists`,
  InvalidFieldValue: (prop: string) =>
    `\`${prop}\` field has a missing, invalid, or illegal value`,
  InvalidArrayValue: (prop: string, value: string) =>
    `the \`${prop}\` array element "${value}" is invalid or illegal`,
  InvalidObjectKeyValue: (prop: string) =>
    `a \`${prop}\` object key has an invalid or illegal value`,
  IllegalUsername: () => 'a user with that username cannot be created',
  InvalidJSON: () => 'encountered invalid JSON',
  InvalidStringLength: (
    prop: string,
    min: number | string,
    max: number | string | null,
    syntax: 'string' | 'alphanumeric' | 'hexadecimal' | 'bytes' = 'alphanumeric',
    nullable = false,
    isArray = false
  ) =>
    `${isArray ? `each \`${prop}\` element` : `\`${prop}\``} must be a${
      syntax == 'alphanumeric'
        ? 'n alphanumeric'
        : syntax == 'hexadecimal'
        ? ' hexadecimal'
        : ''
    } ${
      max
        ? `string between ${min} and ${max} ${
            syntax == 'bytes' ? 'byte' : 'character'
          }s (inclusive)`
        : `${min} ${syntax == 'bytes' ? 'byte' : 'character'} string`
    }${nullable ? ' or null' : ''}`,
  InvalidObjectId: (id: string) => `invalid id "${id}"`,
  UnknownField: (prop: string) => `encountered unknown or illegal field \`${prop}\``,
  UnknownSpecifier: (prop: string, sub = false) =>
    `encountered unknown or illegal ${sub ? 'sub-' : ''}specifier \`${prop}\``,
  UnknownPermissionsSpecifier: () =>
    'encountered unknown specifier `permissions`. Did you mean to use `permissions.username-goes-here`?',
  InvalidSpecifierValueType: (prop: string, type: string, sub = false) =>
    `\`${prop}\` has invalid ${
      sub ? 'sub-' : ''
    }specifier value type (must be ${type})`,
  InvalidRegexString: (prop: string) =>
    `\`${prop}\` has invalid or illegal regex value`,
  InvalidMatcher: (prop: string) => `invalid \`${prop}\`: must be object`,
  InvalidOrSpecifier: () =>
    'invalid "$or" sub-specifier: must be array with exactly two elements',
  InvalidOrSpecifierNonObject: (index: number) =>
    `invalid "$or" sub-specifier at index ${index}: all array elements must be objects`,
  InvalidOrSpecifierBadLength: (index: number) =>
    `invalid "$or" sub-specifier at index ${index}: only one sub-specifier allowed per array element`,
  InvalidOrSpecifierInvalidKey: (index: number, key: string) =>
    `invalid "$or" sub-specifier at index ${index}: invalid sub-key "${key}"`,
  InvalidOrSpecifierInvalidValueType: (index: number, key: string) =>
    `invalid "$or" sub-specifier at index ${index}: sub-key "${key}" has invalid value type (must be number)`
};

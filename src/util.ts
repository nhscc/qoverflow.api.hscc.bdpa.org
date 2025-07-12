import { ClientValidationError, ErrorMessage } from 'multiverse+shared:error.ts';

import type { JsonValue } from 'type-fest';

// eslint-disable-next-line @typescript-eslint/no-unnecessary-type-parameters
export function validateAndParseJson<T extends JsonValue>(
  input: string | null | undefined,
  property?: string
): T {
  try {
    return JSON.parse(input || '');
  } catch {
    throw new ClientValidationError(ErrorMessage.InvalidJSON(property));
  }
}

import { webcrypto as crypto } from 'node:crypto';

/**
 * We use 64 byte keys (128 hex digits long)
 */
const KEY_SIZE_BYTES = 64;

/**
 * We use 16 byte salts (32 hex digits long)
 */
const SALT_SIZE_BYTES = 16;

/**
 * A function that converts a ByteArray or any other array of bytes into a
 * string of hexadecimal digits
 */
export const convertBufferToHex = (buffer: ArrayBufferLike) => {
  return [...new Uint8Array(buffer)]
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('');
};

/**
 * Turns a password (string) and salt (buffer) into a key and salt (hex strings)
 */
export const deriveKeyFromPassword = async (
  passwordString: string,
  saltBuffer?: Uint8Array
) => {
  const textEncoder = new TextEncoder();
  const passwordBuffer = textEncoder.encode(passwordString);

  saltBuffer = saltBuffer || crypto.getRandomValues(new Uint8Array(SALT_SIZE_BYTES));

  const plaintextKey = await crypto.subtle.importKey(
    'raw',
    passwordBuffer,
    'PBKDF2',
    false,
    ['deriveBits']
  );

  const pbkdf2Buffer = await crypto.subtle.deriveBits(
    {
      name: 'PBKDF2',
      salt: saltBuffer,
      iterations: 100000,
      hash: 'SHA-256'
    },
    plaintextKey,
    KEY_SIZE_BYTES * 8
  );

  const saltString = convertBufferToHex(saltBuffer);
  const keyString = convertBufferToHex(pbkdf2Buffer);

  return { keyString, saltString };
};

const ALPHABET = "abcdefghijklmnopqrstuvwxyz234567";

function base32(bytes: Uint8Array) {
  let bits = 0;
  let value = 0;
  let output = "";
  for (const byte of bytes) {
    value = (value << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      output += ALPHABET[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits > 0) output += ALPHABET[(value << (5 - bits)) & 31];
  return output;
}

/** CIDv1 for raw bytes, using SHA-256. The same bytes always produce the same id. */
export async function contentId(bytes: Uint8Array) {
  const copy = new ArrayBuffer(bytes.byteLength);
  new Uint8Array(copy).set(bytes);
  const digest = new Uint8Array(await crypto.subtle.digest("SHA-256", copy));
  const payload = new Uint8Array(4 + digest.length);
  payload[0] = 1;
  payload[1] = 0x55;
  payload[2] = 0x12;
  payload[3] = digest.length;
  payload.set(digest, 4);
  return `b${base32(payload)}`;
}

export function isContentId(value: string) {
  return /^b[a-z2-7]{20,}$/.test(value);
}

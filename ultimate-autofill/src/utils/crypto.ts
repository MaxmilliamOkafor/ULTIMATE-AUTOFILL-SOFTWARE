const SALT_LEN = 16;
const IV_LEN = 12;
const ITERATIONS = 100_000;

async function deriveKey(pass: string, salt: Uint8Array): Promise<CryptoKey> {
  const raw = await crypto.subtle.importKey('raw', new TextEncoder().encode(pass), 'PBKDF2', false, ['deriveKey']);
  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt, iterations: ITERATIONS, hash: 'SHA-256' },
    raw,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  );
}

export async function encrypt(data: string, passphrase: string): Promise<string> {
  const salt = crypto.getRandomValues(new Uint8Array(SALT_LEN));
  const iv = crypto.getRandomValues(new Uint8Array(IV_LEN));
  const key = await deriveKey(passphrase, salt);
  const enc = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, new TextEncoder().encode(data));
  const buf = new Uint8Array(SALT_LEN + IV_LEN + enc.byteLength);
  buf.set(salt, 0);
  buf.set(iv, SALT_LEN);
  buf.set(new Uint8Array(enc), SALT_LEN + IV_LEN);
  return btoa(String.fromCharCode(...buf));
}

export async function decrypt(encoded: string, passphrase: string): Promise<string> {
  const buf = Uint8Array.from(atob(encoded), (c) => c.charCodeAt(0));
  const salt = buf.slice(0, SALT_LEN);
  const iv = buf.slice(SALT_LEN, SALT_LEN + IV_LEN);
  const ct = buf.slice(SALT_LEN + IV_LEN);
  const key = await deriveKey(passphrase, salt);
  const dec = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, ct);
  return new TextDecoder().decode(dec);
}

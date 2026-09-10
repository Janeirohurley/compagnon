// Shared AES-256-GCM crypto for secrets at rest (connections, model providers).
// Format: `${ivBase64}.${authTagBase64}.${ciphertextBase64}`.
import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto';

function encryptionKey() {
  return createHash('sha256')
    .update(process.env.APP_ENCRYPTION_KEY || 'compagnon-local-dev-key')
    .digest();
}

export function encryptObject(value: Record<string, unknown>): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', encryptionKey(), iv);
  const encrypted = Buffer.concat([cipher.update(JSON.stringify(value), 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();

  return `${iv.toString('base64')}.${tag.toString('base64')}.${encrypted.toString('base64')}`;
}

export function decryptObject(value: string | null): Record<string, unknown> {
  if (!value) return {};

  const [iv, tag, encrypted] = value.split('.');
  if (!iv || !tag || !encrypted) return {};

  const decipher = createDecipheriv('aes-256-gcm', encryptionKey(), Buffer.from(iv, 'base64'));
  decipher.setAuthTag(Buffer.from(tag, 'base64'));

  return JSON.parse(
    Buffer.concat([
      decipher.update(Buffer.from(encrypted, 'base64')),
      decipher.final(),
    ]).toString('utf8'),
  );
}
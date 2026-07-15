/**
 * utils/crypto.js
 * -----------------------------------------------------------------------
 * Field-level encryption utilities using AES-256-GCM.
 *
 * Used to encrypt high-sensitivity fields before they are persisted to
 * MongoDB (CNIC/passport numbers, base salary, bank account/IBAN data)
 * so that a raw database dump or backup leak does not expose PII.
 *
 * GCM is an authenticated mode: it gives us confidentiality AND integrity
 * (via the auth tag), so tampered ciphertext is detected on decrypt rather
 * than silently producing garbage plaintext.
 *
 * Storage format produced by encryptField():
 *   base64(iv) + ':' + base64(authTag) + ':' + base64(ciphertext)
 * This single string is what gets saved in the Mongoose schema field, so
 * no extra columns are needed to track iv/tag per record.
 * -----------------------------------------------------------------------
 */

const crypto = require('crypto');

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH_BYTES = 12; // 96-bit IV is the NIST-recommended size for GCM
const AUTH_TAG_LENGTH_BYTES = 16;
const KEY_LENGTH_BYTES = 32; // 256-bit key
const SEGMENT_DELIMITER = ':';

/**
 * Loads and validates the master encryption key from environment config.
 * The key must be supplied as a 64-character hex string (32 bytes) via
 * ENCRYPTION_MASTER_KEY. We fail loudly at startup rather than silently
 * falling back to a weak/default key.
 */
function loadMasterKey() {
  const hexKey = process.env.ENCRYPTION_MASTER_KEY;

  if (!hexKey) {
    throw new Error(
      'ENCRYPTION_MASTER_KEY is not set. Refusing to start with no encryption key configured.'
    );
  }

  const key = Buffer.from(hexKey, 'hex');

  if (key.length !== KEY_LENGTH_BYTES) {
    throw new Error(
      `ENCRYPTION_MASTER_KEY must decode to ${KEY_LENGTH_BYTES} bytes (64 hex chars), got ${key.length}.`
    );
  }

  return key;
}

// Loaded once per process. In production this should be sourced from a
// secrets manager (AWS KMS / Vault) and injected as an env var at deploy
// time — this module does not care where the value came from, only that
// it is valid.
const MASTER_KEY = loadMasterKey();

/**
 * Encrypts a single plaintext value (string) for storage.
 * Numbers/objects should be JSON.stringify'd by the caller before passing
 * in, and JSON.parse'd back out after decryptField().
 *
 * @param {string} plaintext
 * @returns {string} encoded ciphertext bundle: iv:authTag:ciphertext (base64 segments)
 */
function encryptField(plaintext) {
  if (plaintext === null || plaintext === undefined) return plaintext;
  if (typeof plaintext !== 'string') {
    throw new TypeError('encryptField expects a string. Serialize objects/numbers first.');
  }

  const iv = crypto.randomBytes(IV_LENGTH_BYTES);
  const cipher = crypto.createCipheriv(ALGORITHM, MASTER_KEY, iv, {
    authTagLength: AUTH_TAG_LENGTH_BYTES,
  });

  const ciphertext = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const authTag = cipher.getAuthTag();

  return [
    iv.toString('base64'),
    authTag.toString('base64'),
    ciphertext.toString('base64'),
  ].join(SEGMENT_DELIMITER);
}

/**
 * Decrypts a value previously produced by encryptField().
 * Throws if the auth tag does not verify — i.e. the ciphertext was
 * tampered with or the wrong key is in use. Callers should treat a thrown
 * error here as "data integrity failure", not attempt to recover a partial
 * plaintext.
 *
 * @param {string} encoded
 * @returns {string} original plaintext
 */
function decryptField(encoded) {
  if (encoded === null || encoded === undefined) return encoded;
  if (typeof encoded !== 'string') {
    throw new TypeError('decryptField expects a string produced by encryptField.');
  }

  const parts = encoded.split(SEGMENT_DELIMITER);
  if (parts.length !== 3) {
    throw new Error('Malformed ciphertext bundle — expected iv:authTag:ciphertext.');
  }

  const [ivB64, authTagB64, ciphertextB64] = parts;
  const iv = Buffer.from(ivB64, 'base64');
  const authTag = Buffer.from(authTagB64, 'base64');
  const ciphertext = Buffer.from(ciphertextB64, 'base64');

  const decipher = crypto.createDecipheriv(ALGORITHM, MASTER_KEY, iv, {
    authTagLength: AUTH_TAG_LENGTH_BYTES,
  });
  decipher.setAuthTag(authTag);

  const plaintext = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
  return plaintext.toString('utf8');
}

/**
 * Convenience helper for Mongoose schema setters/getters, e.g.:
 *   cnic: { type: String, set: encryptField, get: decryptField }
 * Note: getters on encrypted fields require { toJSON: { getters: true } }
 * and { toObject: { getters: true } } schema options to apply on reads.
 */

/**
 * One-way hash for values that need to be searchable/indexable but never
 * reversed (e.g. a secondary lookup hash for CNIC to support exact-match
 * queries without decrypting every document). Uses HMAC-SHA256 keyed with
 * the same master key so the hash cannot be reproduced without it.
 */
function hashForLookup(value) {
  if (typeof value !== 'string') {
    throw new TypeError('hashForLookup expects a string.');
  }
  return crypto.createHmac('sha256', MASTER_KEY).update(value).digest('hex');
}

/**
 * Generates a cryptographically secure random token, used for things like
 * password-reset tokens, refresh-token identifiers, and API keys.
 * @param {number} bytes
 * @returns {string} hex-encoded token
 */
function generateSecureToken(bytes = 32) {
  return crypto.randomBytes(bytes).toString('hex');
}

/**
 * Constant-time string comparison to prevent timing attacks when
 * comparing secrets (e.g. verifying a reset token against the stored hash).
 */
function safeCompare(a, b) {
  const bufA = Buffer.from(String(a));
  const bufB = Buffer.from(String(b));
  if (bufA.length !== bufB.length) return false;
  return crypto.timingSafeEqual(bufA, bufB);
}

module.exports = {
  encryptField,
  decryptField,
  hashForLookup,
  generateSecureToken,
  safeCompare,
};

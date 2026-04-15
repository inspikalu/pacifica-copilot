/**
 * Browser-side cryptography using Web Crypto API (SubtleCrypto).
 * Matches the Node.js implementation in @/lib/crypto.ts
 */

function hexToUint8Array(hex: string) {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < bytes.length; i++) {
    bytes[i] = parseInt(hex.substring(i * 2, i * 2 + 2), 16);
  }
  return bytes;
}

function uint8ArrayToHex(arr: Uint8Array) {
  return Array.from(arr)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/**
 * Derives a key from a passphrase using PBKDF2 (matches Node's crypto implementation).
 */
async function deriveKey(passphrase: string, salt: Uint8Array) {
  const encoder = new TextEncoder();
  const baseKey = await window.crypto.subtle.importKey(
    "raw",
    encoder.encode(passphrase),
    "PBKDF2",
    false,
    ["deriveBits", "deriveKey"]
  );

  return await window.crypto.subtle.deriveKey(
    {
      name: "PBKDF2",
      salt: salt,
      iterations: 100000,
      hash: "SHA-256",
    },
    baseKey,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"]
  );
}

export async function encryptClient(plaintext: string, passphrase: string) {
  const encoder = new TextEncoder();
  const salt = window.crypto.getRandomValues(new Uint8Array(16));
  const iv = window.crypto.getRandomValues(new Uint8Array(12));
  
  const key = await deriveKey(passphrase, salt);
  
  const encryptedContent = await window.crypto.subtle.encrypt(
    {
      name: "AES-GCM",
      iv: iv,
    },
    key,
    encoder.encode(plaintext)
  );

  const encryptedArray = new Uint8Array(encryptedContent);
  
  // AES-GCM in WebCrypto appends the auth tag (16 bytes) to the end of the ciphertext
  const authTag = encryptedArray.slice(-16);
  const ciphertext = encryptedArray.slice(0, -16);

  return {
    ciphertext: uint8ArrayToHex(ciphertext),
    iv: uint8ArrayToHex(iv),
    salt: uint8ArrayToHex(salt),
    authTag: uint8ArrayToHex(authTag),
  };
}

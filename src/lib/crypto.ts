import { createCipheriv, createDecipheriv, randomBytes, pbkdf2Sync } from "node:crypto";

/**
 * Derives a consistent 32-byte key from a user passphrase using PBKDF2.
 * PBKDF2 is widely available in both Node.js and Browser (SubtleCrypto).
 */
function deriveKey(passphrase: string, salt: string) {
  return pbkdf2Sync(passphrase, salt, 100000, 32, "sha256");
}

export function encrypt(plaintext: string, passphrase: string) {
  const salt = randomBytes(16).toString("hex");
  const iv = randomBytes(12);
  const key = deriveKey(passphrase, salt);
  
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  
  let encrypted = cipher.update(plaintext, "utf8", "hex");
  encrypted += cipher.final("hex");
  
  const authTag = cipher.getAuthTag().toString("hex");
  
  return {
    ciphertext: encrypted,
    iv: iv.toString("hex"),
    salt,
    authTag,
  };
}

export function decrypt(ciphertext: string, ivHex: string, salt: string, authTagHex: string, passphrase: string) {
  try {
    const key = deriveKey(passphrase, salt);
    const iv = Buffer.from(ivHex, "hex");
    const authTag = Buffer.from(authTagHex, "hex");
    
    const decipher = createDecipheriv("aes-256-gcm", key, iv);
    decipher.setAuthTag(authTag);
    
    let decrypted = decipher.update(ciphertext, "hex", "utf8");
    decrypted += decipher.final("utf8");
    
    return decrypted;
  } catch (error) {
    console.error("[Crypto] Decryption failed. Incorrect passphrase or corrupted data.");
    return null;
  }
}

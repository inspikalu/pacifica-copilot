import bs58 from "bs58";
import nacl from "tweetnacl";

/**
 * Recursively sorts the keys of a JSON-serializable object.
 */
function sortJsonKeys(value: any): any {
  if (value === null || typeof value !== "object") {
    return value;
  }

  if (Array.isArray(value)) {
    return value.map(sortJsonKeys);
  }

  const sortedDict: Record<string, any> = {};
  const keys = Object.keys(value).sort();
  for (const key of keys) {
    sortedDict[key] = sortJsonKeys(value[key]);
  }
  return sortedDict;
}

/**
 * Signs a Pacifica API operation.
 * 
 * Flow:
 * 1. Create message with header and operation data.
 * 2. Recursively sort keys.
 * 3. Serialize to compact JSON (no whitespace).
 * 4. Sign UTF-8 bytes with Ed25519.
 * 5. Encode signature in Base58.
 */
export function signOperation(
  type: string,
  data: any,
  privateKeyBase58: string,
  options?: {
    timestamp?: number;
    expiryWindow?: number;
  }
) {
  const timestamp = options?.timestamp ?? Date.now();
  const expiryWindow = options?.expiryWindow ?? 5_000;

  const dataToSign = {
    timestamp,
    expiry_window: expiryWindow,
    type,
    data,
  };

  const sortedMessage = sortJsonKeys(dataToSign);
  const compactJson = JSON.stringify(sortedMessage);
  const messageBytes = Buffer.from(compactJson, "utf-8");
  
  const privateKey = bs58.decode(privateKeyBase58);
  // tweetnacl expects 64-byte secret key (seed + pubkey) or 32-byte seed.
  // In many Solana contexts, the "private key" is 64 bytes.
  const keyPair = nacl.sign.keyPair.fromSecretKey(privateKey);
  
  const signature = nacl.sign.detached(messageBytes, keyPair.secretKey);
  return {
    signature: bs58.encode(signature),
    timestamp,
    expiryWindow,
  };
}

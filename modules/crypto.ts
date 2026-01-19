// Cryptographic operations: hash, encode/decode, random, encrypt/decrypt.
// Tags: built-in
//
// Usage Examples:
// Hash generation:
// {
//   "module": "crypto",
//   "params": {
//     "op": "hash",
//     "input": "hello world",
//     "algorithm": "SHA-256",
//     "encoding": "hex"
//   }
// }
// Returns: { "hash": "b94d27b9...", "algorithm": "SHA-256", "encoding": "hex" }
//
// Base64 encoding:
// {
//   "module": "crypto",
//   "params": {
//     "op": "encode",
//     "input": "hello",
//     "encoding": "base64"
//   }
// }
// Returns: "aGVsbG8="
//
// Random token generation:
// {
//   "module": "crypto",
//   "params": {
//     "op": "random",
//     "length": 32,
//     "encoding": "hex"
//   }
// }
// Returns: "a1b2c3d4..."
//
// Encrypt data:
// {
//   "module": "crypto",
//   "params": {
//     "op": "encrypt",
//     "input": "secret data",
//     "key": "base64encodedkey...",
//     "algorithm": "AES-GCM"
//   }
// }
// Returns: { "encrypted": "...", "algorithm": "AES-GCM", "iv": "..." }
//
// Full params:
// {
//   "module": "crypto",
//   "params": {
//     "op": "hash",                    // Operation: hash, encode, decode, random, encrypt, decrypt (required)
//     "input": "data",                  // Input data (required for hash, encode, decode, encrypt, decrypt)
//     "algorithm": "SHA-256",          // Hash/encrypt algorithm (required for hash, encrypt, decrypt)
//     "encoding": "hex",                // Encoding format: hex, base64, base64url (for hash, encode, decode, random)
//     "key": "...",                    // Encryption key (required for encrypt, decrypt)
//     "iv": "...",                     // Initialization vector (required for decrypt)
//     "length": 32                     // Length for random token (optional, default: 32)
//   }
// }
//
// Returns:
// - hash: { "hash": string, "algorithm": string, "encoding": string }
// - encode: string (encoded value)
// - decode: string (decoded value)
// - random: string (random token)
// - encrypt: { "encrypted": string, "algorithm": string, "iv": string }
// - decrypt: string (decrypted value)

import type { PipelineContext, ModuleResult } from "../server/types/index.ts";

/** Schema for editor hints */
export const schema = {
  params: {
    op: {
      type: "string",
      required: true,
      enum: ["hash", "encode", "decode", "random", "encrypt", "decrypt"],
      description: "Crypto operation to perform"
    },
    input: {
      type: "string",
      required: false,
      description: "Input data (required for hash, encode, decode, encrypt, decrypt)",
      visibleWhen: { param: "op", equals: ["hash", "encode", "decode", "encrypt", "decrypt"] }
    },
    algorithm: {
      type: "string",
      required: false,
      enum: ["MD5", "SHA-256", "SHA-512", "AES-GCM", "AES-CBC"],
      description: "Hash or encryption algorithm (required for hash, encrypt, decrypt)",
      visibleWhen: { param: "op", equals: ["hash", "encrypt", "decrypt"] }
    },
    encoding: {
      type: "string",
      required: false,
      enum: ["hex", "base64", "base64url"],
      default: "hex",
      description: "Encoding format (for hash, encode, decode, random)",
      visibleWhen: { param: "op", equals: ["hash", "encode", "decode", "random"] }
    },
    key: {
      type: "string",
      required: false,
      description: "Encryption key in base64 or hex format (required for encrypt, decrypt)",
      visibleWhen: { param: "op", equals: ["encrypt", "decrypt"] }
    },
    iv: {
      type: "string",
      required: false,
      description: "Initialization vector in base64 format (required for decrypt)",
      visibleWhen: { param: "op", equals: "decrypt" }
    },
    length: {
      type: "number",
      required: false,
      default: 32,
      description: "Length of random token in bytes (for random operation)",
      visibleWhen: { param: "op", equals: "random" }
    }
  }
};

interface CryptoParams {
  op: "hash" | "encode" | "decode" | "random" | "encrypt" | "decrypt";
  input?: string;
  algorithm?: "MD5" | "SHA-256" | "SHA-512" | "AES-GCM" | "AES-CBC";
  encoding?: "hex" | "base64" | "base64url";
  key?: string;
  iv?: string;
  length?: number;
}

export async function run(ctx: PipelineContext, params: CryptoParams): Promise<ModuleResult> {
  if (ctx.signal?.aborted) {
    throw new Error("Pipeline stopped by user");
  }

  switch (params.op) {
    case "hash":
      return await handleHash(ctx, params);
    case "encode":
      return handleEncode(ctx, params);
    case "decode":
      return handleDecode(ctx, params);
    case "random":
      return handleRandom(ctx, params);
    case "encrypt":
      return await handleEncrypt(ctx, params);
    case "decrypt":
      return await handleDecrypt(ctx, params);
    default:
      throw new Error(`Unknown crypto operation: ${params.op}`);
  }
}

// Helper: Convert Uint8Array to hex string
function uint8ArrayToHex(bytes: Uint8Array): string {
  return Array.from(bytes)
    .map(b => b.toString(16).padStart(2, "0"))
    .join("");
}

// Helper: Convert hex string to Uint8Array
function hexToUint8Array(hex: string): Uint8Array {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < hex.length; i += 2) {
    bytes[i / 2] = parseInt(hex.substring(i, i + 2), 16);
  }
  return bytes;
}

// Helper: Convert Uint8Array to base64
function uint8ArrayToBase64(bytes: Uint8Array): string {
  const binary = String.fromCharCode(...bytes);
  return btoa(binary);
}

// Helper: Convert base64 to Uint8Array
function base64ToUint8Array(base64: string): Uint8Array {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

// Helper: Convert base64url to base64
function base64urlToBase64(base64url: string): string {
  return base64url.replace(/-/g, "+").replace(/_/g, "/") + "=".repeat((4 - base64url.length % 4) % 4);
}

// Helper: Convert base64 to base64url
function base64ToBase64url(base64: string): string {
  return base64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=/g, "");
}

async function handleHash(ctx: PipelineContext, params: CryptoParams): Promise<ModuleResult> {
  if (!params.input) throw new Error("Input required for hash operation");
  if (!params.algorithm) throw new Error("Algorithm required for hash operation");
  
  const encoding = params.encoding || "hex";
  const encoder = new TextEncoder();
  const data = encoder.encode(params.input);

  let hashBytes: Uint8Array;

  if (params.algorithm === "MD5") {
    // Use node:crypto for MD5 (not available in Web Crypto API)
    const nodeCrypto = await import("node:crypto");
    const hash = nodeCrypto.createHash("md5");
    hash.update(data);
    const hashBuffer = hash.digest();
    hashBytes = new Uint8Array(hashBuffer);
  } else {
    // Use Web Crypto API for SHA-256, SHA-512
    const algorithm = params.algorithm === "SHA-256" ? "SHA-256" : "SHA-512";
    const digest = await crypto.subtle.digest(algorithm, data);
    hashBytes = new Uint8Array(digest);
  }

  let hashString: string;
  if (encoding === "hex") {
    hashString = uint8ArrayToHex(hashBytes);
  } else if (encoding === "base64") {
    hashString = uint8ArrayToBase64(hashBytes);
  } else {
    // base64url
    hashString = base64ToBase64url(uint8ArrayToBase64(hashBytes));
  }

  if (ctx.log) ctx.log(`[Crypto] Generated ${params.algorithm} hash (${encoding})`);

  return {
    hash: hashString,
    algorithm: params.algorithm,
    encoding: encoding,
  };
}

function handleEncode(ctx: PipelineContext, params: CryptoParams): ModuleResult {
  if (!params.input) throw new Error("Input required for encode operation");
  if (!params.encoding) throw new Error("Encoding required for encode operation");

  const encoder = new TextEncoder();
  const data = encoder.encode(params.input);

  let encoded: string;
  if (params.encoding === "base64") {
    encoded = uint8ArrayToBase64(data);
  } else if (params.encoding === "base64url") {
    encoded = base64ToBase64url(uint8ArrayToBase64(data));
  } else {
    // hex
    encoded = uint8ArrayToHex(data);
  }

  if (ctx.log) ctx.log(`[Crypto] Encoded to ${params.encoding}`);

  return encoded;
}

function handleDecode(ctx: PipelineContext, params: CryptoParams): ModuleResult {
  if (!params.input) throw new Error("Input required for decode operation");
  if (!params.encoding) throw new Error("Encoding required for decode operation");

  let data: Uint8Array;
  if (params.encoding === "base64") {
    data = base64ToUint8Array(params.input);
  } else if (params.encoding === "base64url") {
    const base64 = base64urlToBase64(params.input);
    data = base64ToUint8Array(base64);
  } else {
    // hex
    data = hexToUint8Array(params.input);
  }

  const decoder = new TextDecoder();
  const decoded = decoder.decode(data);

  if (ctx.log) ctx.log(`[Crypto] Decoded from ${params.encoding}`);

  return decoded;
}

function handleRandom(ctx: PipelineContext, params: CryptoParams): ModuleResult {
  const length = params.length || 32;
  const encoding = params.encoding || "hex";

  if (length <= 0 || length > 1024) {
    throw new Error("Length must be between 1 and 1024 bytes");
  }

  const randomBytes = new Uint8Array(length);
  crypto.getRandomValues(randomBytes);

  let token: string;
  if (encoding === "hex") {
    token = uint8ArrayToHex(randomBytes);
  } else if (encoding === "base64") {
    token = uint8ArrayToBase64(randomBytes);
  } else {
    // base64url
    token = base64ToBase64url(uint8ArrayToBase64(randomBytes));
  }

  if (ctx.log) ctx.log(`[Crypto] Generated random token (${length} bytes, ${encoding})`);

  return token;
}

async function handleEncrypt(ctx: PipelineContext, params: CryptoParams): Promise<ModuleResult> {
  if (!params.input) throw new Error("Input required for encrypt operation");
  if (!params.key) throw new Error("Key required for encrypt operation");
  if (!params.algorithm) throw new Error("Algorithm required for encrypt operation");

  if (params.algorithm !== "AES-GCM" && params.algorithm !== "AES-CBC") {
    throw new Error("Algorithm must be AES-GCM or AES-CBC");
  }

  // Parse key (assume base64 or hex)
  let keyBytes: Uint8Array;
  try {
    keyBytes = base64ToUint8Array(params.key);
  } catch {
    try {
      keyBytes = hexToUint8Array(params.key);
    } catch {
      throw new Error("Key must be valid base64 or hex format");
    }
  }

  // Validate key length (AES requires 128, 192, or 256 bits = 16, 24, or 32 bytes)
  if (keyBytes.length !== 16 && keyBytes.length !== 24 && keyBytes.length !== 32) {
    throw new Error("Key must be 16, 24, or 32 bytes (128, 192, or 256 bits)");
  }

  // Generate IV (12 bytes for GCM, 16 bytes for CBC)
  const ivLength = params.algorithm === "AES-GCM" ? 12 : 16;
  const iv = new Uint8Array(ivLength);
  crypto.getRandomValues(iv);

  // Convert keyBytes to ArrayBuffer for crypto API
  const keyBuffer = new ArrayBuffer(keyBytes.length);
  new Uint8Array(keyBuffer).set(keyBytes);

  // Import key
  const cryptoKey = await crypto.subtle.importKey(
    "raw",
    keyBuffer,
    {
      name: params.algorithm,
      length: keyBytes.length * 8, // Convert bytes to bits
    },
    false,
    ["encrypt"]
  );

  // Encrypt data
  const encoder = new TextEncoder();
  const dataBytes = encoder.encode(params.input);
  const dataBuffer = new ArrayBuffer(dataBytes.length);
  new Uint8Array(dataBuffer).set(dataBytes);

  // Convert IV to ArrayBuffer
  const ivBuffer = new ArrayBuffer(iv.length);
  new Uint8Array(ivBuffer).set(iv);

  const encrypted = await crypto.subtle.encrypt(
    {
      name: params.algorithm,
      iv: ivBuffer,
      tagLength: params.algorithm === "AES-GCM" ? 128 : undefined,
    },
    cryptoKey,
    dataBuffer
  );

  const encryptedBytes = new Uint8Array(encrypted);
  const encryptedBase64 = uint8ArrayToBase64(encryptedBytes);
  const ivBase64 = uint8ArrayToBase64(iv);

  if (ctx.log) ctx.log(`[Crypto] Encrypted data using ${params.algorithm}`);

  return {
    encrypted: encryptedBase64,
    algorithm: params.algorithm,
    iv: ivBase64,
  };
}

async function handleDecrypt(ctx: PipelineContext, params: CryptoParams): Promise<ModuleResult> {
  if (!params.input) throw new Error("Input required for decrypt operation");
  if (!params.key) throw new Error("Key required for decrypt operation");
  if (!params.algorithm) throw new Error("Algorithm required for decrypt operation");
  if (!params.iv) throw new Error("IV required for decrypt operation");

  if (params.algorithm !== "AES-GCM" && params.algorithm !== "AES-CBC") {
    throw new Error("Algorithm must be AES-GCM or AES-CBC");
  }

  // Parse key (assume base64 or hex)
  let keyBytes: Uint8Array;
  try {
    keyBytes = base64ToUint8Array(params.key);
  } catch {
    try {
      keyBytes = hexToUint8Array(params.key);
    } catch {
      throw new Error("Key must be valid base64 or hex format");
    }
  }

  // Validate key length
  if (keyBytes.length !== 16 && keyBytes.length !== 24 && keyBytes.length !== 32) {
    throw new Error("Key must be 16, 24, or 32 bytes (128, 192, or 256 bits)");
  }

  // Parse IV and encrypted data
  let iv: Uint8Array;
  let encryptedBytes: Uint8Array;
  try {
    iv = base64ToUint8Array(params.iv);
    encryptedBytes = base64ToUint8Array(params.input);
  } catch {
    throw new Error("IV and encrypted data must be valid base64 format");
  }

  // Validate IV length
  const expectedIvLength = params.algorithm === "AES-GCM" ? 12 : 16;
  if (iv.length !== expectedIvLength) {
    throw new Error(`IV must be ${expectedIvLength} bytes for ${params.algorithm}`);
  }

  // Convert keyBytes to ArrayBuffer for crypto API
  const keyBuffer = new ArrayBuffer(keyBytes.length);
  new Uint8Array(keyBuffer).set(keyBytes);

  // Import key
  const cryptoKey = await crypto.subtle.importKey(
    "raw",
    keyBuffer,
    {
      name: params.algorithm,
      length: keyBytes.length * 8,
    },
    false,
    ["decrypt"]
  );

  // Convert IV and encrypted data to ArrayBuffer
  const ivBuffer = new ArrayBuffer(iv.length);
  new Uint8Array(ivBuffer).set(iv);
  const encryptedBuffer = new ArrayBuffer(encryptedBytes.length);
  new Uint8Array(encryptedBuffer).set(encryptedBytes);

  // Decrypt data
  try {
    const decrypted = await crypto.subtle.decrypt(
      {
        name: params.algorithm,
        iv: ivBuffer,
        tagLength: params.algorithm === "AES-GCM" ? 128 : undefined,
      },
      cryptoKey,
      encryptedBuffer
    );

    const decoder = new TextDecoder();
    const decryptedText = decoder.decode(new Uint8Array(decrypted));

    if (ctx.log) ctx.log(`[Crypto] Decrypted data using ${params.algorithm}`);

    return decryptedText;
  } catch (e) {
    throw new Error(`Decryption failed: ${e instanceof Error ? e.message : String(e)}`);
  }
}

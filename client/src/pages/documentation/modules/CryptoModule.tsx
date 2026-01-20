import { Code } from "@mui/icons-material";
import { ModuleDoc } from "../../../components/DocumentationComponents.tsx";

export function CryptoModule() {
  return (
    <ModuleDoc
      id="mod-crypto"
      icon={<Code fontSize="small" />}
      title="crypto"
      description="Cryptographic operations: hash generation (MD5, SHA-256, SHA-512), encoding/decoding (Base64, Hex), random token generation, encryption/decryption (AES-GCM, AES-CBC)."
      params={[
        { name: 'op', type: '"hash" | "encode" | "decode" | "random" | "encrypt" | "decrypt"', required: true, description: 'Operation type' },
        { name: 'input', type: 'string', description: 'Input data (required for hash, encode, decode, encrypt, decrypt)' },
        { name: 'algorithm', type: '"MD5" | "SHA-256" | "SHA-512" | "AES-GCM" | "AES-CBC"', description: 'Hash or encryption algorithm (required for hash, encrypt, decrypt)' },
        { name: 'encoding', type: '"hex" | "base64" | "base64url"', description: 'Encoding format (for hash, encode, decode, random, default: hex)' },
        { name: 'key', type: 'string', description: 'Encryption key in base64 or hex format (required for encrypt, decrypt)' },
        { name: 'iv', type: 'string', description: 'Initialization vector in base64 format (required for decrypt)' },
        { name: 'length', type: 'number', description: 'Length of random token in bytes (for random, default: 32)' }
      ]}
      returns='hash: { "hash": string, "algorithm": string, "encoding": string }. encode: Encoded string. decode: Decoded string. random: Random token string. encrypt: { "encrypted": string, "algorithm": string, "iv": string }. decrypt: Decrypted string.'
      example={`// Generate SHA-256 hash
{
  "module": "crypto",
  "params": {
    "op": "hash",
    "input": "hello world",
    "algorithm": "SHA-256",
    "encoding": "hex"
  }
}

// Base64 encoding
{
  "module": "crypto",
  "params": {
    "op": "encode",
    "input": "hello",
    "encoding": "base64"
  }
}

// Generate random token
{
  "module": "crypto",
  "params": {
    "op": "random",
    "length": 32,
    "encoding": "hex"
  }
}

// Encrypt data
{
  "module": "crypto",
  "params": {
    "op": "encrypt",
    "input": "secret data",
    "key": "base64encodedkey...",
    "algorithm": "AES-GCM"
  }
}

// Decrypt data
{
  "module": "crypto",
  "params": {
    "op": "decrypt",
    "input": "\${results.encryptStep.encrypted}",
    "key": "base64encodedkey...",
    "algorithm": "AES-GCM",
    "iv": "\${results.encryptStep.iv}"
  }
}`}
    />
  );
}

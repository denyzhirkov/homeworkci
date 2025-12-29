// Security utilities for pipeline execution
// Handles log sanitization and ID validation

// Patterns to detect and mask sensitive data in logs
const SENSITIVE_PATTERNS = [
  /(?:password|passwd|pwd|secret|token|api[_-]?key|auth|bearer|credential)[\s]*[=:]\s*['"]?([^'"\s,;]+)/gi,
  /Bearer\s+[A-Za-z0-9\-._~+/]+=*/gi,
  /[a-f0-9]{32,}/gi, // Long hex strings (potential tokens/hashes)
];

/**
 * Sanitizes log messages by masking sensitive data
 * Detects passwords, tokens, API keys, and long hex strings
 */
export function sanitizeLogMessage(msg: string): string {
  let sanitized = msg;
  for (const pattern of SENSITIVE_PATTERNS) {
    sanitized = sanitized.replace(pattern, (match) => {
      if (match.length > 8) {
        return match.substring(0, 4) + "*".repeat(Math.min(match.length - 4, 16));
      }
      return "****";
    });
  }
  return sanitized;
}

/**
 * Validates pipeline ID format
 * - Must be non-empty string
 * - Only alphanumeric, underscore, and hyphen allowed
 * - Maximum 128 characters
 */
export function validatePipelineId(id: string): void {
  if (!id || typeof id !== "string") {
    throw new Error("Pipeline ID must be a non-empty string");
  }
  if (!/^[a-zA-Z0-9_-]+$/.test(id)) {
    throw new Error("Pipeline ID contains invalid characters");
  }
  if (id.length > 128) {
    throw new Error("Pipeline ID too long");
  }
}



/**
 * Utility to detect and sanitize/mask sensitive information from audit logs.
 * Sensitive items:
 * - Passwords / secrets
 * - Access tokens / refresh tokens (Bearer tokens, JWTs)
 * - Credit card numbers (PAN)
 * - CVV / CVC numbers
 */

const SENSITIVE_PATTERNS = [
  // Password fields in JSON, key-value, or prose ("password:", "password=", "password was:", "password is:")
  /(?:password|passwd|pwd|secret)\s*(?:is|was|[:=])\s*["']?([^"',\s]+)/i,
  // Bearer or JWT tokens
  /bearer\s+[a-zA-Z0-9_\-\.]+/i,
  /eyJ[a-zA-Z0-9_\-]{10,}\.[a-zA-Z0-9_\-]{10,}\.[a-zA-Z0-9_\-]+/i,
  // Credit card numbers (13 to 19 digits with optional spaces or dashes)
  /\b(?:\d{4}[ -]?){3}\d{4}\b/,
  /\b\d{15,16}\b/,
  // CVV / CVC
  /(?:cvv|cvc|security_code)\s*(?:is|was|[:=])\s*["']?\d{3,4}/i,
];

/**
 * Checks whether text contains any forbidden sensitive data
 */
export function containsSensitiveData(text?: string | null): { hasSensitive: boolean; reason?: string } {
  if (!text) return { hasSensitive: false };

  for (const pattern of SENSITIVE_PATTERNS) {
    if (pattern.test(text)) {
      return {
        hasSensitive: true,
        reason: 'Security violation: Audit logs must NOT contain passwords, tokens, credit card numbers, or CVVs.',
      };
    }
  }

  return { hasSensitive: false };
}

/**
 * Masks credit card numbers keeping only last 4 digits: ****-****-****-1234
 */
export function maskCreditCard(text: string): string {
  return text.replace(/\b(\d{4})[ -]?(\d{4})[ -]?(\d{4})[ -]?(\d{4})\b/g, '****-****-****-$4');
}

/**
 * Masks sensitive patterns inside a text message or string
 */
export function maskSensitiveText(text?: string | null): string {
  if (!text) return '';
  let masked = String(text);

  // Mask credit card numbers
  masked = maskCreditCard(masked);

  // Mask passwords / secrets in key-value or JSON syntax
  masked = masked.replace(
    /((?:password|passwd|pwd|secret)\s*(?:is|was|[:=])\s*["']?)([^"',\s]+)(["']?)/gi,
    '$1***REDACTED***$3'
  );

  // Mask Bearer tokens
  masked = masked.replace(/bearer\s+[a-zA-Z0-9_\-\.]+/gi, 'Bearer ***REDACTED***');

  // Mask raw JWT strings
  masked = masked.replace(/eyJ[a-zA-Z0-9_\-]{10,}\.[a-zA-Z0-9_\-]{10,}\.[a-zA-Z0-9_\-]+/gi, '***REDACTED_JWT***');

  // Mask CVV/CVC
  masked = masked.replace(
    /((?:cvv|cvc|security_code)\s*(?:is|was|[:=])\s*["']?)(\d{3,4})(["']?)/gi,
    '$1***REDACTED***$3'
  );

  return masked;
}

/**
 * Recursively sanitizes an object or string to remove sensitive fields and values
 */
export function sanitizeLogDetails(details: any): string {
  if (!details) return '';
  if (typeof details === 'string') {
    return maskSensitiveText(details);
  }

  if (typeof details === 'object') {
    const sensitiveKeySubstrings = [
      'password',
      'pwd',
      'passwd',
      'token',
      'accesstoken',
      'refreshtoken',
      'secret',
      'creditcard',
      'cardnumber',
      'cvv',
      'cvc',
      'apikey',
      'api_key',
      'privatekey',
      'private_key',
    ];

    const cleanObject = (obj: any): any => {
      if (obj === null || obj === undefined) return obj;
      if (Array.isArray(obj)) return obj.map(cleanObject);
      if (typeof obj !== 'object') {
        if (typeof obj === 'string') return maskSensitiveText(obj);
        return obj;
      }

      const copy: Record<string, any> = {};
      for (const [key, value] of Object.entries(obj)) {
        const lowerKey = key.toLowerCase();
        if (sensitiveKeySubstrings.some((sk) => lowerKey.includes(sk))) {
          copy[key] = '***REDACTED***';
        } else if (typeof value === 'object' && value !== null) {
          copy[key] = cleanObject(value);
        } else if (typeof value === 'string') {
          copy[key] = maskSensitiveText(value);
        } else {
          copy[key] = value;
        }
      }
      return copy;
    };

    return JSON.stringify(cleanObject(details));
  }

  return String(details);
}

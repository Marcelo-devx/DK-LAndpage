/**
 * Logging Utilities
 * Sanitiza dados sensíveis antes de logar
 */

/**
 * Mascarar CPF/CNPJ parcialmente
 */
export function maskCpfCnpj(value: string | null | undefined): string {
  if (!value) return '[null]';
  const cleaned = String(value).replace(/\D/g, '');
  if (cleaned.length <= 3) return cleaned;
  if (cleaned.length <= 6) return `${cleaned.slice(0, 2)}***`;
  if (cleaned.length <= 9) return `${cleaned.slice(0, 3)}***${cleaned.slice(-2)}`;
  return `${cleaned.slice(0, 3)}***${cleaned.slice(-2)}`;
}

/**
 * Mascarar email (mostra só primeiros 3 chars do usuário)
 */
export function maskEmail(value: string | null | undefined): string {
  if (!value) return '[null]';
  const [user, domain] = String(value).split('@');
  if (!user || !domain) return '[invalid]';
  const maskedUser = user.length > 3 ? user.slice(0, 3) + '***' : user;
  return `${maskedUser}@${domain}`;
}

/**
 * Mascarar telefone parcialmente
 */
export function maskPhone(value: string | null | undefined): string {
  if (!value) return '[null]';
  const cleaned = String(value).replace(/\D/g, '');
  if (cleaned.length <= 4) return `${cleaned.slice(0, 2)}**`;
  return `${cleaned.slice(0, 2)}****${cleaned.slice(-2)}`;
}

/**
 * Sanitizar objeto para logging (remove/mascara campos sensíveis)
 */
export function sanitizeLogObject(obj: any): any {
  if (!obj || typeof obj !== 'object') return obj;

  const sanitized: any = Array.isArray(obj) ? [] : {};

  for (const key in obj) {
    if (obj.hasOwnProperty(key)) {
      const value = obj[key];
      const lowerKey = key.toLowerCase();

      // Campos sensíveis - mascarar
      if (lowerKey.includes('cpf') || lowerKey.includes('cnpj')) {
        sanitized[key] = maskCpfCnpj(value);
      } else if (lowerKey.includes('email')) {
        sanitized[key] = maskEmail(value);
      } else if (lowerKey.includes('phone') || lowerKey.includes('telefone')) {
        sanitized[key] = maskPhone(value);
      } else if (lowerKey === 'token' || lowerKey === 'password' || lowerKey === 'secret') {
        sanitized[key] = '[REDACTED]';
      } else if (typeof value === 'object' && value !== null) {
        sanitized[key] = sanitizeLogObject(value);
      } else {
        sanitized[key] = value;
      }
    }
  }

  return sanitized;
}

/**
 * Log seguro - sanitiza automaticamente
 */
export function safeLog(prefix: string, data: any) {
  console.log(prefix, sanitizeLogObject(data));
}

/**
 * Log de erro seguro
 */
export function safeErrorLog(prefix: string, error: any) {
  console.error(prefix, {
    message: error?.message || String(error),
    ...(error && typeof error === 'object' ? sanitizeLogObject(error) : {})
  });
}

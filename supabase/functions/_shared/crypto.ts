// _shared/crypto.ts — comparação em tempo constante para validar assinatura de webhook (HMAC).
// Use em todo webhook de terceiro (Meta, Tray, etc.). Nunca compare com === (timing attack).
export function constantTimeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let result = 0;
  for (let i = 0; i < a.length; i++) {
    result |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return result === 0;
}

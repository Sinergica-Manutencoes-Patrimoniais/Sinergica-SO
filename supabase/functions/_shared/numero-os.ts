/** Replica a convenção 0209 para OS nova ainda sem Chamado. Não altera números existentes. */
export function identidadeOsProvisoria(id: string): { id: string; numero: string } {
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id)) throw new Error("ID de OS inválido.");
  return { id, numero: `PRE-${id.slice(0, 8).toUpperCase()}` };
}

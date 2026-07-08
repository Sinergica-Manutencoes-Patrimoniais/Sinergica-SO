import type { SincronizarAuvoGateway } from "./sincronizar-auvo-gateway";

export async function sincronizarAuvo(gateway: SincronizarAuvoGateway) {
  return gateway.sincronizar();
}

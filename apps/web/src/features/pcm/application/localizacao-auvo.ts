import type { PreferenciaLocalizacaoAuvo } from "../domain/localizacao-auvo";
import type { LocalizacaoAuvoGateway } from "./localizacao-auvo-gateway";

export async function obterPreferenciaLocalizacaoAuvo(
  gateway: LocalizacaoAuvoGateway,
): Promise<PreferenciaLocalizacaoAuvo> {
  return gateway.obterPreferencia();
}

/** E01-S85 AC-1: valida antes de gravar — separador não pode ficar vazio (viraria uma localização
 * ilegível, concatenada sem nada entre as partes). */
export async function salvarPreferenciaLocalizacaoAuvo(
  gateway: LocalizacaoAuvoGateway,
  preferencia: PreferenciaLocalizacaoAuvo,
  updatedBy: string,
): Promise<void> {
  if (!preferencia.separador.trim()) throw new Error("Separador não pode ficar vazio.");
  await gateway.salvarPreferencia(preferencia, updatedBy);
}

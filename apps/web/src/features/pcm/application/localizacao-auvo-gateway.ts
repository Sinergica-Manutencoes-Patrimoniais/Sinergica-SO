import type { PreferenciaLocalizacaoAuvo } from "../domain/localizacao-auvo";

export interface LocalizacaoAuvoGateway {
  obterPreferencia(): Promise<PreferenciaLocalizacaoAuvo>;
  salvarPreferencia(preferencia: PreferenciaLocalizacaoAuvo, updatedBy: string): Promise<void>;
}

// Porta (interface) que a infrastructure implementa. A application só conhece este contrato —
// nunca importa @supabase/supabase-js diretamente.

export interface Integracao {
  id: string;
  chave: string;
  provedor: string | null;
  ativo: boolean;
  configPublico: Record<string, unknown>;
  /** true = segredo já gravado no Vault; nunca expõe o valor (E00-S12 AC-3). */
  temSegredo: boolean;
}

export interface SalvarIntegracaoInput {
  chave: string;
  provedor: string | null;
  ativo: boolean;
  configPublico: Record<string, unknown>;
}

export interface IntegracoesGateway {
  listar(): Promise<Integracao[]>;
  salvarMetadado(input: SalvarIntegracaoInput): Promise<Integracao>;
  /** E00-S12 AC-1: grava o segredo no Vault via RPC — nunca numa tabela. */
  definirSegredo(chave: string, valor: string): Promise<void>;
}

// E02-S35 (ADR-1686) — adapter da função NOVA `evolution-configurar`. Arquivo separado de
// `supabase-evolution-adapter.ts` (legado, função `atendimento-evolution`) de propósito: mesma
// SPEC_DEVIATION já registrada em tasks.md pra função — a legada continua intacta durante a
// transição, sem risco de regressão na tela em produção.
import { supabase } from "../../../lib/supabase-client";
import type { PortaDeConfiguracaoEvolution } from "../application/configurar-evolution";

export interface SalvarServidorInput {
  urlBase: string;
  apikeyGlobal: string;
}

export interface SalvarServidorResultado {
  estado: "compativel" | "incompativel";
  versao: string | null;
  motivo?: string;
}

async function invocar<T>(body: Record<string, unknown>): Promise<T> {
  const { data, error } = await supabase.functions.invoke<T>("evolution-configurar", { body });
  if (error) {
    const context = (error as { context?: unknown }).context;
    if (context instanceof Response) {
      const problema = (await context
        .clone()
        .json()
        .catch(() => null)) as { codigo?: string } | null;
      if (problema?.codigo) throw new Error(problema.codigo);
    }
    throw new Error(error.message || "Não foi possível acessar a configuração do Evolution.");
  }
  if (data === null || data === undefined) throw new Error("Resposta vazia do Evolution.");
  return data;
}

export const supabaseConfiguracaoEvolutionAdapter: PortaDeConfiguracaoEvolution & {
  salvarServidor(input: SalvarServidorInput): Promise<SalvarServidorResultado>;
} = {
  async salvarServidor(input) {
    return invocar<SalvarServidorResultado>({ acao: "salvar_servidor", ...input });
  },

  async criarInstancia(canalId) {
    return invocar({ acao: "criar_instancia", canalId });
  },

  async instalarWebhook(canalId) {
    return invocar({ acao: "instalar_webhook", canalId });
  },
};

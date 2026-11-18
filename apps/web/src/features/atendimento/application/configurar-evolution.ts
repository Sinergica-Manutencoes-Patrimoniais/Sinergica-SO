// E02-S35 (ADR-1686, plan.md "Application") — sequência atômica de ativação do canal: cria (ou
// adota, ver SPEC_DEVIATION no edge function) a instância remota e instala o webhook por canal.
// Falha em instalar sobe sem disfarce (AC-5) — quem chamou decide o que mostrar.

export interface PortaDeConfiguracaoEvolution {
  criarInstancia(
    canalId: string,
  ): Promise<{ estado: string; jaExistia: boolean; adotada?: boolean }>;
  instalarWebhook(canalId: string): Promise<{ estado: string }>;
}

function exigirCanalId(canalId: string): string {
  const normalizado = canalId.trim();
  if (!normalizado) throw new Error("Canal é obrigatório para configurar o Evolution.");
  return normalizado;
}

export async function configurarInstanciaEvolution(
  porta: PortaDeConfiguracaoEvolution,
  canalId: string,
): Promise<{ estado: string; adotada: boolean }> {
  const id = exigirCanalId(canalId);
  const criacao = await porta.criarInstancia(id);
  const instalacao = await porta.instalarWebhook(id);
  return { estado: instalacao.estado, adotada: criacao.adotada === true };
}

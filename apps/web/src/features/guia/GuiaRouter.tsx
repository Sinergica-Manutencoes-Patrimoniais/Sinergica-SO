import type { ComponentType } from "react";
import { AtendimentoGuia } from "./AtendimentoGuia";
import { FinanceiroGuia } from "./FinanceiroGuia";
import { PapeisGuia } from "./PapeisGuia";
import { PcmGuia } from "./PcmGuia";
import { AreaClienteGuia, CockpitGuia, ComercialGuia, MarketingGuia } from "./PlanejadosGuia";
import { VisaoGeralGuia } from "./VisaoGeralGuia";

export type GuiaView =
  | "visao-geral"
  | "pcm"
  | "atendimento"
  | "comercial"
  | "financeiro"
  | "marketing"
  | "cockpit"
  | "area-cliente"
  | "papeis";

const PAGINAS: Record<GuiaView, ComponentType> = {
  "visao-geral": VisaoGeralGuia,
  pcm: PcmGuia,
  atendimento: AtendimentoGuia,
  comercial: ComercialGuia,
  financeiro: FinanceiroGuia,
  marketing: MarketingGuia,
  cockpit: CockpitGuia,
  "area-cliente": AreaClienteGuia,
  papeis: PapeisGuia,
};

/** Guia do SO — documentação de onboarding, integrada como módulo do próprio app (último item da
 * barra de módulos). Conteúdo estático, sem domínio/backend — explica pra quem não conhece o
 * sistema o que cada módulo faz e como ajuda no dia a dia da operação. */
export function GuiaRouter({ view }: { view: GuiaView }) {
  const Pagina = PAGINAS[view];
  return <Pagina />;
}

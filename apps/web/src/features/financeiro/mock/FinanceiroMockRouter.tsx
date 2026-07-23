import type { ComponentType } from "react";
import { CobrancaPage } from "../pages/CobrancaPage";
import { CockpitFinanceiroPage } from "../pages/CockpitFinanceiroPage";
import { DrePage } from "../pages/DrePage";
import { FechamentoPage } from "../pages/FechamentoPage";
import { ImpostosPage } from "../pages/ImpostosPage";
import { OrcamentoPage } from "../pages/OrcamentoPage";
import { CategoriasMock } from "./CategoriasMock";
import { ContasBancariasMock } from "./ContasBancariasMock";
import { ContasPagarMock } from "./ContasPagarMock";
import { ContasReceberMock } from "./ContasReceberMock";
import { ContratosMock } from "./ContratosMock";
import { CustosPessoalMock } from "./CustosPessoalMock";
import { DashboardMock } from "./DashboardMock";
import { ImportOfxMock } from "./ImportOfxMock";
import { LancamentosMock } from "./LancamentosMock";
import { MockBanner } from "./MockUi";
import { RentabilidadeMock } from "./RentabilidadeMock";

export type FinanceiroView =
  | "dashboard"
  | "lancamentos"
  | "categorias"
  | "contas"
  | "ofx"
  | "receber"
  | "contratos"
  | "pagar"
  | "rentabilidade"
  | "pessoal"
  | "cobranca"
  | "impostos"
  | "fechamento"
  | "dre"
  | "orcamento"
  | "cockpit";

const TELAS: Record<FinanceiroView, ComponentType> = {
  dashboard: DashboardMock,
  lancamentos: LancamentosMock,
  categorias: CategoriasMock,
  contas: ContasBancariasMock,
  ofx: ImportOfxMock,
  receber: ContasReceberMock,
  contratos: ContratosMock,
  pagar: ContasPagarMock,
  rentabilidade: RentabilidadeMock,
  pessoal: CustosPessoalMock,
  // Sem mock: E04-S08 nasceu direto real (feature nova, sem protótipo prévio). HomePage sempre
  // intercepta "cobranca" antes de chegar aqui — mapeada pra a página real por segurança/tipo.
  cobranca: CobrancaPage,
  impostos: ImpostosPage,
  fechamento: FechamentoPage,
  dre: DrePage,
  orcamento: OrcamentoPage,
  cockpit: CockpitFinanceiroPage,
};

/** Protótipo navegável do Financeiro (specs/E04-S01-fundacao-financeiro/) — dados fictícios,
 * hardcoded em mock-data.ts, sem leitura de banco. Existe pra Lucas/Fabrício/Aline navegarem
 * dentro do próprio app real (mesma sidebar/topbar/tema) e darem feedback de produto antes de
 * qualquer implementação de verdade. Não é código de referência pra copiar quando a E04 for
 * implementada (sem hexagonal, sem tipos de domínio — só front estático). */
export function FinanceiroMockRouter({ view }: { view: FinanceiroView }) {
  const Tela = TELAS[view];
  return (
    <div>
      <MockBanner />
      <Tela />
    </div>
  );
}

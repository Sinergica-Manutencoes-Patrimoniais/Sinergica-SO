import type { ComponentType } from "react";
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
  | "pessoal";

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

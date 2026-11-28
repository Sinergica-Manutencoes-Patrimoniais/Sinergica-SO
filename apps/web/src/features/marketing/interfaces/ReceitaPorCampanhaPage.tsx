/** Receita por campanha (E06-S01 — AC-16, AC-17, AC-18).
 *
 * Responde "qual campanha gerou receita" ligando anúncio → lead → oportunidade → contrato. O
 * Marketing **referencia** o Comercial; não reimplementa funil nem proposta (ADR-1699 §2). Toda
 * a junção acontece numa RPC só, que exige permissão nos dois módulos — e esta tela traduz a
 * recusa em uma frase, não num código. */

import { Badge, Button, Card, CardHeader, DataTable, EmptyState } from "@sinergica/ui";
import type { DataTableColumn } from "@sinergica/ui";
import { useState } from "react";
import { ErroDoMarketing } from "../application/marketing-gateway";
import { useReceitaPorCampanha } from "../application/marketing-queries";
import type { Periodo } from "../domain/periodo";
import { ultimosDias } from "../domain/periodo";
import type { ColunaDeReceita, LinhaDeReceitaComRetorno } from "../domain/receita-campanha";
import { marketingSupabaseGateway } from "../infrastructure/marketing-supabase";
import { type AtalhoDePeriodo, FiltroDePeriodo, periodoDoAtalho } from "./FiltroDePeriodo";
import { dataCurta, dinheiro, quantidade, retorno } from "./formato";

export function ReceitaPorCampanhaPage() {
  const [atalho, setAtalho] = useState<AtalhoDePeriodo>("90");
  const [periodo, setPeriodo] = useState<Periodo>(() => ultimosDias(90));
  const [coluna, setColuna] = useState<ColunaDeReceita>("receitaCentavos");

  const receitaQuery = useReceitaPorCampanha(marketingSupabaseGateway, periodo, coluna);
  const erro = receitaQuery.error;
  const semComercial = erro instanceof ErroDoMarketing && erro.codigo === "sem_permissao_comercial";
  const totais = receitaQuery.data?.totais;
  const linhas = receitaQuery.data?.linhas ?? [];
  const semCampanhas =
    receitaQuery.isSuccess && !receitaQuery.isPlaceholderData && linhas.length === 0;

  function trocarAtalho(novo: AtalhoDePeriodo) {
    setAtalho(novo);
    setPeriodo((atual) => periodoDoAtalho(novo, atual));
  }

  const colunas: DataTableColumn<LinhaDeReceitaComRetorno>[] = [
    {
      chave: "campanha",
      cabecalho: "Campanha",
      cabecalhoLinha: true,
      larguraMin: "16rem",
      render: (l) => (
        <span className="flex items-center gap-1.5">
          <span className="truncate">{l.campanhaNome}</span>
          {/* AC-18: a campanha que gastou e não trouxe nada continua aqui, e diz isso em voz
              alta. Esconder gasto sem retorno é o erro que este relatório existe para evitar. */}
          {l.semAtribuicao && <Badge tone="warning">sem atribuição</Badge>}
        </span>
      ),
    },
    {
      chave: "gastoCentavos",
      cabecalho: "Gasto",
      numerica: true,
      ordenavel: true,
      render: (l) => dinheiro(l.gastoCentavos),
    },
    {
      chave: "leads",
      cabecalho: "Leads",
      numerica: true,
      ordenavel: true,
      render: (l) => quantidade(l.leads),
    },
    {
      chave: "oportunidades",
      cabecalho: "Oportunidades",
      numerica: true,
      ordenavel: true,
      render: (l) => quantidade(l.oportunidades),
    },
    {
      chave: "contratos",
      cabecalho: "Contratos",
      numerica: true,
      ordenavel: true,
      render: (l) => quantidade(l.contratos),
    },
    {
      chave: "receitaCentavos",
      cabecalho: "Receita",
      numerica: true,
      ordenavel: true,
      render: (l) => dinheiro(l.receitaCentavos),
    },
    {
      chave: "retorno",
      cabecalho: "Retorno",
      numerica: true,
      render: (l) => retorno(l.retorno),
    },
  ];

  return (
    <div className="flex flex-col gap-4">
      <header>
        <h1 className="text-lg font-semibold text-ink">Receita por campanha</h1>
        <p className="text-body text-ink-3">
          Do anúncio ao contrato: quanto cada campanha custou e quanto ela trouxe de volta.
        </p>
      </header>

      <FiltroDePeriodo
        atalho={atalho}
        periodo={periodo}
        onAtalho={trocarAtalho}
        onPeriodo={setPeriodo}
      />

      {/* AC-17: a recusa do servidor vira uma frase que explica o que fazer, não um 42501. */}
      {semComercial && (
        <EmptyState titulo="Você precisa de acesso ao Comercial para ver receita por campanha">
          A receita vem do contrato, que é do módulo Comercial. Peça permissão de leitura nele a
          quem administra — o resto dos indicadores de Marketing continua disponível.
        </EmptyState>
      )}

      {receitaQuery.isError && !semComercial && (
        <EmptyState
          titulo="Não foi possível carregar a receita por campanha"
          acao={
            <Button variant="secondary" onClick={() => receitaQuery.refetch()}>
              Tentar de novo
            </Button>
          }
        >
          Os números que já estavam na tela não foram alterados.
        </EmptyState>
      )}

      {!receitaQuery.isError && (
        <>
          {totais && (
            <div className="grid grid-cols-2 gap-2 lg:grid-cols-4">
              <Card className="px-3.5 py-3">
                <p className="text-caption font-semibold uppercase tracking-wide text-ink-3">
                  Gasto
                </p>
                <p className="mt-1 text-lg font-semibold tabular-nums text-ink">
                  {dinheiro(totais.gastoCentavos)}
                </p>
              </Card>
              <Card className="px-3.5 py-3">
                <p className="text-caption font-semibold uppercase tracking-wide text-ink-3">
                  Receita
                </p>
                <p className="mt-1 text-lg font-semibold tabular-nums text-ink">
                  {dinheiro(totais.receitaCentavos)}
                </p>
              </Card>
              <Card className="px-3.5 py-3">
                <p className="text-caption font-semibold uppercase tracking-wide text-ink-3">
                  Contratos
                </p>
                <p className="mt-1 text-lg font-semibold tabular-nums text-ink">
                  {quantidade(totais.contratos)}
                </p>
              </Card>
              <Card className="px-3.5 py-3">
                <p className="text-caption font-semibold uppercase tracking-wide text-ink-3">
                  Retorno
                </p>
                <p className="mt-1 text-lg font-semibold tabular-nums text-ink">
                  {retorno(totais.retorno)}
                </p>
                <p className="mt-0.5 text-micro text-ink-4">receita atribuída ÷ gasto</p>
              </Card>
            </div>
          )}

          <Card>
            <CardHeader>
              <h2 className="text-body font-semibold text-ink">Atribuição por campanha</h2>
              <p className="text-caption text-ink-3">
                Uma oportunidade conta uma vez só, na campanha da entrada que a originou.
              </p>
            </CardHeader>
            {semCampanhas ? (
              <div className="p-3">
                <EmptyState titulo="Nenhuma campanha com gasto ou lead no período">
                  De {dataCurta(periodo.de)} a {dataCurta(periodo.ate)}.
                </EmptyState>
              </div>
            ) : (
              <DataTable
                colunas={colunas}
                itens={[...linhas]}
                chaveLinha={(l) => l.campanhaId}
                carregando={
                  receitaQuery.isPending || (linhas.length === 0 && receitaQuery.isPlaceholderData)
                }
                ordenacao={{ coluna, direcao: "desc" }}
                onOrdenar={(chave) => setColuna(chave as ColunaDeReceita)}
                vazio="Nenhuma campanha para mostrar."
              />
            )}
          </Card>
        </>
      )}
    </div>
  );
}

/** Indicadores das campanhas da Meta (E06-S01 — AC-1 a AC-7, AC-10, AC-11).
 *
 * Estrutura: período → cartões do total → tabela hierárquica colapsável campanha → conjunto →
 * anúncio. Os números vêm todos do mesmo grão (anúncio × dia), agregados no domínio, então o que
 * a pessoa lê no topo é literalmente a soma do que ela abre embaixo.
 *
 * O achatamento da árvore em linhas é `linhasVisiveis` (domínio, testado); aqui só se desenha o
 * recuo. Nenhum `useState` + `useEffect` buscando servidor: tudo passa por TanStack Query. */

import { Badge, Button, Card, CardHeader, DataTable, EmptyState, Skeleton } from "@sinergica/ui";
import type { DataTableColumn } from "@sinergica/ui";
import { ChevronDown, ChevronRight, RefreshCw } from "lucide-react";
import { useMemo, useState } from "react";
import { usePermissoes } from "../../../app/permissoes-context";
import {
  useContasDeAnuncio,
  useIndicadores,
  useSincronizar,
  useUltimasSincronizacoes,
} from "../application/marketing-queries";
import type { LinhaDaTabela } from "../domain/indicadores";
import { linhasVisiveis, semVeiculacao } from "../domain/indicadores";
import type { Periodo } from "../domain/periodo";
import { ultimosDias } from "../domain/periodo";
import { marketingSupabaseGateway } from "../infrastructure/marketing-supabase";
import { type AtalhoDePeriodo, FiltroDePeriodo, periodoDoAtalho } from "./FiltroDePeriodo";
import { dataCurta, dinheiro, dinheiroPreciso, quantidade, taxa } from "./formato";

function CartaoIndicador({
  rotulo,
  valor,
  nota,
}: {
  rotulo: string;
  valor: string;
  nota?: string;
}) {
  return (
    <Card className="px-3.5 py-3">
      <p className="text-caption font-semibold uppercase tracking-wide text-ink-3">{rotulo}</p>
      <p className="mt-1 text-lg font-semibold tabular-nums text-ink">{valor}</p>
      {nota && <p className="mt-0.5 text-micro text-ink-4">{nota}</p>}
    </Card>
  );
}

const RECUO: Record<LinhaDaTabela["nivel"], string> = {
  0: "pl-0",
  1: "pl-5",
  2: "pl-10",
};

export function IndicadoresMetaPage() {
  const { podeAcessar } = usePermissoes();
  const podeSincronizar = podeAcessar("marketing", "escrita");

  const [atalho, setAtalho] = useState<AtalhoDePeriodo>("30");
  const [periodo, setPeriodo] = useState<Periodo>(() => ultimosDias(30));
  const [abertos, setAbertos] = useState<ReadonlySet<string>>(() => new Set<string>());

  const contasQuery = useContasDeAnuncio(marketingSupabaseGateway);
  const contaAtiva = contasQuery.data?.find((conta) => conta.ativa) ?? null;
  const indicadoresQuery = useIndicadores(marketingSupabaseGateway, periodo);
  const sincronizacoesQuery = useUltimasSincronizacoes(marketingSupabaseGateway, 1);
  const sincronizar = useSincronizar(marketingSupabaseGateway);

  const ultima = sincronizacoesQuery.data?.[0];
  const relatorio = indicadoresQuery.data;
  const vazio = relatorio ? semVeiculacao(relatorio) : false;

  const linhas = useMemo(
    () => (relatorio ? linhasVisiveis(relatorio, abertos) : []),
    [relatorio, abertos],
  );

  function alternar(id: string) {
    setAbertos((atual) => {
      const novo = new Set(atual);
      if (novo.has(id)) novo.delete(id);
      else novo.add(id);
      return novo;
    });
  }

  function trocarAtalho(novo: AtalhoDePeriodo) {
    setAtalho(novo);
    setPeriodo((atual) => periodoDoAtalho(novo, atual));
    // Fechar tudo ao trocar de período: a campanha aberta pode nem existir no período novo, e
    // deixar o estado aberto apontando para id que sumiu confunde mais do que ajuda.
    setAbertos(new Set<string>());
  }

  const colunas: DataTableColumn<LinhaDaTabela>[] = [
    {
      chave: "origem",
      cabecalho: "Origem",
      cabecalhoLinha: true,
      larguraMin: "16rem",
      render: (l) =>
        l.temFilhos ? (
          <button
            type="button"
            onClick={() => alternar(l.id)}
            aria-expanded={l.aberto}
            className={`inline-flex items-center gap-1 cursor-pointer text-left ${RECUO[l.nivel]} ${
              l.nivel === 0 ? "font-semibold text-ink" : "text-ink-2"
            }`}
          >
            {l.aberto ? (
              <ChevronDown className="size-3.5 shrink-0" />
            ) : (
              <ChevronRight className="size-3.5 shrink-0" />
            )}
            <span className="truncate">{l.nome}</span>
          </button>
        ) : (
          <span className={`block truncate text-ink-3 ${RECUO[l.nivel]}`}>{l.nome}</span>
        ),
    },
    {
      chave: "gasto",
      cabecalho: "Gasto",
      numerica: true,
      render: (l) => dinheiro(l.indicadores.gastoCentavos),
    },
    {
      chave: "impressoes",
      cabecalho: "Impressões",
      numerica: true,
      render: (l) => quantidade(l.indicadores.impressoes),
    },
    {
      chave: "cliques",
      cabecalho: "Cliques",
      numerica: true,
      render: (l) => quantidade(l.indicadores.cliques),
    },
    { chave: "ctr", cabecalho: "CTR", numerica: true, render: (l) => taxa(l.indicadores.ctr) },
    {
      chave: "cpc",
      cabecalho: "CPC",
      numerica: true,
      render: (l) => dinheiroPreciso(l.indicadores.cpcCentavos),
    },
    {
      chave: "leads",
      cabecalho: "Leads",
      numerica: true,
      render: (l) => quantidade(l.indicadores.leads),
    },
    {
      chave: "cpl",
      cabecalho: "Custo por lead",
      numerica: true,
      render: (l) => dinheiro(l.indicadores.custoPorLeadCentavos),
    },
  ];

  return (
    <div className="flex flex-col gap-4">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-lg font-semibold text-ink">Indicadores das campanhas</h1>
          <p className="text-body text-ink-3">
            Gasto, alcance, cliques e leads por campanha, conjunto e anúncio.
          </p>
        </div>
        {podeSincronizar && (
          <div className="flex flex-col items-start gap-1 sm:items-end">
            <Button
              variant="secondary"
              onClick={() =>
                contaAtiva && sincronizar.mutate({ contaId: contaAtiva.id, janelaDias: 7 })
              }
              disabled={!contaAtiva || sincronizar.isPending}
            >
              <RefreshCw className="size-4" />
              {sincronizar.isPending ? "Sincronizando…" : "Sincronizar 7 dias"}
            </Button>
            {sincronizar.isError && (
              <p role="alert" className="text-caption text-danger">
                A sincronização falhou. O registro da tentativa ficou no histórico.
              </p>
            )}
          </div>
        )}
      </header>

      {/* AC-10: dado de demonstração JAMAIS se passa por real. A tarja é a primeira coisa que a
          pessoa lê, antes de qualquer número. */}
      {ultima?.origem === "demonstracao" && (
        /* `<output>` em vez de `<div role="status">`: mesmo papel de acessibilidade, com
           elemento semântico de verdade — o que `lint/a11y/useSemanticElements` cobra. */
        <output className="block rounded-md border border-warning-line bg-orange-soft px-3.5 py-2 text-body text-ink-2">
          <strong className="font-semibold">Números de demonstração.</strong> A conta da Meta ainda
          não está conectada — o que aparece abaixo é um exemplo com a mesma forma do dado real,
          para a tela poder ser conferida. Assim que a credencial de leitura for gravada no cofre, a
          próxima sincronização traz os números verdadeiros.
        </output>
      )}

      <FiltroDePeriodo
        atalho={atalho}
        periodo={periodo}
        onAtalho={trocarAtalho}
        onPeriodo={setPeriodo}
      />

      {/* AC-11: de quando é o número que está na tela. Sem isto, "o relatório está errado" e "o
          relatório está velho" são indistinguíveis. */}
      {ultima && (
        <p className="flex flex-wrap items-center gap-1.5 text-caption text-ink-4">
          Última sincronização em {dataCurta(ultima.concluidaEm)} · janela{" "}
          {dataCurta(ultima.janelaDe)} a {dataCurta(ultima.janelaAte)} ·
          {ultima.resultado === "sucesso" ? (
            <Badge tone="success">sucesso</Badge>
          ) : (
            <Badge tone="danger">falha</Badge>
          )}
        </p>
      )}

      {/* AC-6: erro com ação de tentar de novo — nunca tela em branco sem explicação. */}
      {indicadoresQuery.isError && (
        <EmptyState
          titulo="Não foi possível carregar os indicadores"
          acao={
            <Button variant="secondary" onClick={() => indicadoresQuery.refetch()}>
              Tentar de novo
            </Button>
          }
        >
          Os números que já estavam na tela não foram alterados.
        </EmptyState>
      )}

      {!indicadoresQuery.isError && (
        <>
          <div
            className="grid grid-cols-2 gap-2 lg:grid-cols-4"
            aria-busy={indicadoresQuery.isFetching}
          >
            {indicadoresQuery.isPending || !relatorio ? (
              <>
                <Skeleton className="h-20 w-full" />
                <Skeleton className="h-20 w-full" />
                <Skeleton className="h-20 w-full" />
                <Skeleton className="h-20 w-full" />
              </>
            ) : (
              <>
                <CartaoIndicador rotulo="Gasto" valor={dinheiro(relatorio.total.gastoCentavos)} />
                <CartaoIndicador rotulo="Leads" valor={quantidade(relatorio.total.leads)} />
                <CartaoIndicador
                  rotulo="Custo por lead"
                  valor={dinheiro(relatorio.total.custoPorLeadCentavos)}
                  nota={relatorio.total.leads === 0 ? "sem lead no período" : undefined}
                />
                <CartaoIndicador rotulo="Cliques" valor={quantidade(relatorio.total.cliques)} />
                <CartaoIndicador
                  rotulo="Impressões"
                  valor={quantidade(relatorio.total.impressoes)}
                />
                <CartaoIndicador rotulo="CTR" valor={taxa(relatorio.total.ctr)} />
                <CartaoIndicador
                  rotulo="CPM"
                  valor={dinheiroPreciso(relatorio.total.cpmCentavos)}
                />
                <CartaoIndicador
                  rotulo="Alcance (soma diária)"
                  valor={quantidade(relatorio.total.alcance)}
                  // Alcance é gente distinta; somar dias conta a mesma pessoa de novo. Dizer isso
                  // custa uma linha e evita uma conclusão errada.
                  nota="pessoas por dia, somadas — não é público único do período"
                />
              </>
            )}
          </div>

          <Card>
            <CardHeader>
              <h2 className="text-body font-semibold text-ink">Campanha → conjunto → anúncio</h2>
              <p className="text-caption text-ink-3">
                Abra uma campanha para ver os conjuntos; abra o conjunto para ver os anúncios.
              </p>
            </CardHeader>
            <DataTable
              colunas={colunas}
              itens={linhas}
              chaveLinha={(l) => l.chave}
              carregando={indicadoresQuery.isPending}
              vazio={
                // AC-4: vazio nomeado. Uma tabela de zeros afirmaria que houve veiculação sem
                // resultado, que é outra coisa.
                vazio
                  ? `Nenhuma veiculação entre ${dataCurta(periodo.de)} e ${dataCurta(periodo.ate)}.`
                  : "Nenhuma campanha para mostrar."
              }
            />
          </Card>
        </>
      )}
    </div>
  );
}

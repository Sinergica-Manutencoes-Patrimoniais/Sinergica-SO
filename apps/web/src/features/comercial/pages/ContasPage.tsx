/** Lista de Contas (E03-S01, AC-7).
 *
 * A diferença para a Lista de Clientes do PCM é o que esta tela NÃO faz: não filtra por `ativo`.
 * O PCM mostra quem está em operação; o Comercial precisa ver lead, prospecto, cliente ativo e
 * cliente antigo na mesma lista — é a "visão 360 de todo mundo" que motivou o ADR-0020.
 *
 * Data fetching por TanStack Query (regra do projeto, `CLAUDE.md` § Data fetching): o filtro faz
 * parte da query key, `keepPreviousData` evita a lista piscar, e o debounce de 250 ms na busca
 * segue o mesmo número escolhido pela E01-S145 no board de Operação. */

import { Badge, Button, Card, DataTable, EmptyState, Field, Input, Select } from "@sinergica/ui";
import { Plus, RefreshCw } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { usePermissoes } from "../../../app/permissoes-context";
import type { ContaComFunil, FiltroSituacaoConta } from "../application/comercial-gateway";
import { useContas, useEtapas } from "../application/comercial-queries";
import { NovaOportunidadeModal } from "../components/NovaOportunidadeModal";
import { etapasVisiveis } from "../domain/funil";
import { supabaseComercialAdapter } from "../infrastructure/supabase-comercial-adapter";

const DEBOUNCE_BUSCA_MS = 250;

export function ContasPage({
  onAbrirConta,
}: {
  onAbrirConta?: (clienteId: string) => void;
}) {
  const { carregando: permissoesCarregando, podeAcessar } = usePermissoes();
  const [texto, setTexto] = useState("");
  const [textoDebounced, setTextoDebounced] = useState("");
  const [situacao, setSituacao] = useState<FiltroSituacaoConta>("todas");
  const [etapaId, setEtapaId] = useState<string>("");
  const [contaParaOportunidade, setContaParaOportunidade] = useState<ContaComFunil | null>(null);

  const temLeitura = podeAcessar("comercial", "leitura");
  const temEscrita = podeAcessar("comercial", "escrita");
  const habilitado = !permissoesCarregando && temLeitura;

  // Só o valor debounced entra na query key — digitar não dispara uma request por tecla.
  useEffect(() => {
    const timer = setTimeout(() => setTextoDebounced(texto), DEBOUNCE_BUSCA_MS);
    return () => clearTimeout(timer);
  }, [texto]);

  const filtro = useMemo(
    () => ({
      texto: textoDebounced || undefined,
      situacao,
      etapaId: etapaId || null,
    }),
    [textoDebounced, situacao, etapaId],
  );

  const etapasQuery = useEtapas(supabaseComercialAdapter, habilitado);
  const contasQuery = useContas(supabaseComercialAdapter, filtro, habilitado);

  const etapasParaFiltro = useMemo(
    () => etapasVisiveis(etapasQuery.data ?? []),
    [etapasQuery.data],
  );

  if (permissoesCarregando) return null;

  if (!temLeitura) {
    return (
      <EmptyState titulo="Sem acesso ao Comercial">
        Seu usuário não tem permissão no módulo Comercial. Fale com quem administra o sistema.
      </EmptyState>
    );
  }

  const contas = contasQuery.data ?? [];
  const erro = contasQuery.error ?? etapasQuery.error;
  // `isPending` é carga fria (sem dado nenhum). Refetch com dado anterior na tela mostra só o
  // indicador discreto — a lista não pisca.
  const cargaFria = contasQuery.isPending;
  const atualizando = contasQuery.isFetching && !cargaFria;

  return (
    <div className="space-y-4">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-brand text-xl font-bold text-ink">Contas</h1>
          <p className="text-sm text-ink-2">
            Todas as contas — lead, prospecto, cliente ativo e antigo. O PCM mostra só as ativas.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {atualizando && <span className="text-xs text-ink-2">atualizando…</span>}
          <Button variant="ghost" onClick={() => contasQuery.refetch()}>
            <RefreshCw className="size-4" aria-hidden />
            Atualizar
          </Button>
        </div>
      </header>

      <Card>
        <div className="flex flex-wrap items-end gap-3 p-3">
          <div className="min-w-52 flex-1">
            <Field label="Buscar">
              {(props) => (
                <Input
                  {...props}
                  value={texto}
                  onChange={(e) => setTexto(e.target.value)}
                  placeholder="Nome ou CNPJ"
                />
              )}
            </Field>
          </div>
          <Field label="Situação">
            {(props) => (
              <Select
                {...props}
                value={situacao}
                onChange={(e) => setSituacao(e.target.value as FiltroSituacaoConta)}
              >
                <option value="todas">Todas</option>
                <option value="ativas">Ativas</option>
                <option value="inativas">Inativas</option>
              </Select>
            )}
          </Field>
          <Field label="Etapa do funil">
            {(props) => (
              <Select {...props} value={etapaId} onChange={(e) => setEtapaId(e.target.value)}>
                <option value="">Todas</option>
                {etapasParaFiltro.map((etapa) => (
                  <option key={etapa.id} value={etapa.id}>
                    {etapa.nome}
                  </option>
                ))}
              </Select>
            )}
          </Field>
        </div>
      </Card>

      {cargaFria && <p className="text-sm text-ink-2">Carregando contas…</p>}

      {erro && (
        <Card>
          <p className="p-4 text-sm text-danger">
            {erro instanceof Error ? erro.message : "Falha ao carregar contas."}
          </p>
        </Card>
      )}

      {!cargaFria && !erro && contas.length === 0 && (
        // `filtrado` e não `vazio`: há 49 contas vivas em produção, então lista vazia aqui é
        // sempre resultado de filtro — a E00-S17 exige que as duas telas não se pareçam.
        <EmptyState titulo="Nenhuma conta encontrada" variante="filtrado">
          Ajuste os filtros de busca, situação ou etapa do funil.
        </EmptyState>
      )}

      {contas.length > 0 && (
        <Card>
          <DataTable
            colunas={[
              {
                chave: "conta",
                cabecalho: "Conta",
                render: (conta) => (
                  <>
                    <button
                      type="button"
                      className="text-left font-semibold text-ink hover:underline"
                      onClick={() => onAbrirConta?.(conta.id)}
                    >
                      {conta.nome}
                    </button>
                    {conta.cnpj && <p className="text-xs text-ink-2">{conta.cnpj}</p>}
                  </>
                ),
              },
              {
                chave: "situacao",
                cabecalho: "Situação",
                render: (conta) => (
                  <Badge tone={conta.ativo ? "success" : "neutral"}>
                    {conta.ativo ? "Ativa" : "Inativa"}
                  </Badge>
                ),
              },
              {
                chave: "etapa",
                cabecalho: "Etapa do funil",
                render: (conta) =>
                  conta.etapa ? (
                    <span className="inline-flex items-center gap-2">
                      <span
                        aria-hidden
                        className="size-2 rounded-full"
                        style={{ backgroundColor: conta.etapa.cor }}
                      />
                      {conta.etapa.nome}
                      {conta.oportunidadesAbertas > 1 && (
                        <span className="text-xs text-ink-2">
                          +{conta.oportunidadesAbertas - 1}
                        </span>
                      )}
                    </span>
                  ) : (
                    <span className="text-ink-2">Sem oportunidade</span>
                  ),
              },
              {
                chave: "contato",
                cabecalho: "Contato",
                render: (conta) => conta.contatoNome ?? conta.contatoTelefone ?? "—",
              },
              {
                chave: "local",
                cabecalho: "Local",
                render: (conta) => [conta.cidade, conta.estado].filter(Boolean).join("/") || "—",
              },
              {
                chave: "acoes",
                cabecalho: "",
                render: (conta) =>
                  temEscrita && (
                    <div className="flex justify-end">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setContaParaOportunidade(conta)}
                      >
                        <Plus className="size-4" aria-hidden />
                        Oportunidade
                      </Button>
                    </div>
                  ),
              },
            ]}
            itens={contas}
            chaveLinha={(conta) => conta.id}
            vazio={<>Nenhuma conta encontrada.</>}
          />
        </Card>
      )}

      {contaParaOportunidade && (
        <NovaOportunidadeModal
          conta={contaParaOportunidade}
          etapas={etapasQuery.data ?? []}
          onFechar={() => setContaParaOportunidade(null)}
          // A invalidação de chave está no `useCriarOportunidade` — a lista se atualiza sozinha,
          // sem a tela chamar recarga.
          onCriada={() => setContaParaOportunidade(null)}
        />
      )}
    </div>
  );
}

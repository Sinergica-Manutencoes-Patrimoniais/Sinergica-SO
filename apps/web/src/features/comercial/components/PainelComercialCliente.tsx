/** Aba Comercial da Visão 360 (E03-S01, AC-9).
 *
 * Mora em `features/comercial/` e é montado pela Visão 360 do PCM. Isso mantém a regra de
 * fronteira: o PCM não conhece o funil, o Comercial não reimplementa a agregação da 360 — a
 * página do PCM só monta o componente e passa o `clienteId`, que é a Conta compartilhada
 * (ADR-0020). */

import { Badge, Button, Card, EmptyState } from "@sinergica/ui";
import { ClipboardList, FileText, MessageCircle, Plus, Search } from "lucide-react";
import { useState } from "react";
import { usePermissoes } from "../../../app/permissoes-context";
import { useEtapas, useOportunidadesDaConta } from "../application/comercial-queries";
import { useCriarLevantamento, useLevantamentosDaConta } from "../application/levantamento-queries";
import { supabaseComercialAdapter } from "../infrastructure/supabase-comercial-adapter";
import { supabaseLevantamentoAdapter } from "../infrastructure/supabase-levantamento-adapter";
import { PropostaEditorPage } from "../pages/PropostaEditorPage";
import { NovaOportunidadeModal } from "./NovaOportunidadeModal";

function formatarValor(centavos: number | null): string {
  if (centavos === null) return "—";
  return (centavos / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function formatarData(iso: string): string {
  // Parse por componente, sem passar por `new Date(iso)` + toLocaleDateString: data ISO em UTC
  // convertida para America/Sao_Paulo rola para o dia anterior (bug real corrigido na E04-S10).
  const [ano, mes, dia] = iso.slice(0, 10).split("-");
  return `${dia}/${mes}/${ano}`;
}

export function PainelComercialCliente({
  clienteId,
  clienteNome,
  onAbrirLevantamento,
  onAbrirConversa,
}: {
  clienteId: string;
  /** Só enfeita o título do modal. Opcional porque a Visão 360 já mostra o nome da Conta no
   * cabeçalho — repassá-lo daria ao shell o trabalho de carregar o cliente só para isso. */
  clienteNome?: string;
  /** E03-S05, AC-7: "link para o Assessment completo" — o Comercial não conhece a tela do PCM, o
   * shell (`HomePage`) é quem sabe navegar até `InspecoesPage` com a inspeção certa selecionada. */
  onAbrirLevantamento?: (inspecaoId: string) => void;
  /** E03-S09, AC-5: "link para a conversa que originou a oportunidade" — mesmo raciocínio acima,
   * mas pra `AtendimentoInboxPage`. Só aparece quando a oportunidade tem `conversaId` (nasceu do
   * agente de WhatsApp, S09) — a maioria não tem, e o botão simplesmente não aparece nelas. */
  onAbrirConversa?: (conversaId: string) => void;
}) {
  const { podeAcessar } = usePermissoes();
  const [criando, setCriando] = useState(false);
  const [oportunidadeAberta, setOportunidadeAberta] = useState<string | null>(null);

  const temLeitura = podeAcessar("comercial", "leitura");
  const temEscrita = podeAcessar("comercial", "escrita");

  const etapasQuery = useEtapas(supabaseComercialAdapter, temLeitura);
  const oportunidadesQuery = useOportunidadesDaConta(
    supabaseComercialAdapter,
    clienteId,
    temLeitura,
  );
  // AC-7: levantamentos aparecem junto da oportunidade na aba Comercial, independente de já
  // estarem vinculados a uma proposta.
  const levantamentosQuery = useLevantamentosDaConta(
    supabaseLevantamentoAdapter,
    clienteId,
    temLeitura,
  );
  const criarLevantamento = useCriarLevantamento(supabaseLevantamentoAdapter);

  // Sem o módulo, a aba não mostra dado de funil — mas também não finge que a Conta não existe.
  if (!temLeitura) {
    return (
      <EmptyState titulo="Sem acesso ao Comercial">
        Seu usuário não tem permissão no módulo Comercial.
      </EmptyState>
    );
  }

  if (oportunidadesQuery.isPending) {
    return <p className="text-sm text-ink-2">Carregando oportunidades…</p>;
  }

  const erro = oportunidadesQuery.error ?? etapasQuery.error;
  if (erro) {
    return (
      <Card>
        <p className="p-4 text-sm text-danger">
          {erro instanceof Error ? erro.message : "Falha ao carregar o funil."}
        </p>
      </Card>
    );
  }

  const oportunidades = oportunidadesQuery.data ?? [];
  const etapas = etapasQuery.data ?? [];
  const etapaPorId = new Map(etapas.map((e) => [e.id, e]));

  if (oportunidadeAberta) {
    return (
      <PropostaEditorPage
        oportunidadeId={oportunidadeAberta}
        clienteId={clienteId}
        clienteNome={clienteNome}
        onVoltar={() => setOportunidadeAberta(null)}
      />
    );
  }

  const levantamentos = levantamentosQuery.data ?? [];

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-3">
        <h2 className="font-semibold text-ink">Oportunidades</h2>
        {temEscrita && (
          <Button size="sm" onClick={() => setCriando(true)}>
            <Plus className="size-4" aria-hidden />
            Nova oportunidade
          </Button>
        )}
      </div>

      {oportunidades.length === 0 ? (
        // Conta sem oportunidade é o caso comum (as 49 contas vivas nasceram antes do módulo) —
        // estado vazio explicativo, nunca erro.
        <EmptyState titulo="Nenhuma oportunidade nesta conta">
          Quando houver uma negociação em andamento, ela aparece aqui com a etapa do funil.
        </EmptyState>
      ) : (
        <Card>
          <ul className="divide-y divide-line/60">
            {oportunidades.map((op) => {
              const etapa = etapaPorId.get(op.etapaId);
              return (
                <li key={op.id} className="flex flex-wrap items-center gap-3 p-3">
                  <div className="min-w-48 flex-1">
                    <p className="font-semibold text-ink">{op.titulo}</p>
                    <p className="text-xs text-ink-2">
                      Criada em {formatarData(op.criadaEm)}
                      {op.fechadaEm && ` · fechada em ${formatarData(op.fechadaEm)}`}
                    </p>
                  </div>
                  {etapa && (
                    <span className="inline-flex items-center gap-2 text-sm text-ink">
                      <span
                        aria-hidden
                        className="size-2 rounded-full"
                        style={{ backgroundColor: etapa.cor }}
                      />
                      {etapa.nome}
                    </span>
                  )}
                  {op.score !== null && (
                    <Badge tone={op.score >= 60 ? "success" : "neutral"}>
                      Score {op.score}
                      {op.leadTier && ` · ${op.leadTier}`}
                    </Badge>
                  )}
                  {op.origem && <Badge tone="info">{op.origem}</Badge>}
                  <span className="tabular-nums text-sm text-ink">
                    {formatarValor(op.valorEstimadoCentavos)}
                  </span>
                  {/* E03-S09 AC-5: só oportunidade nascida do agente de WhatsApp tem conversaId. */}
                  {op.conversaId && onAbrirConversa && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => onAbrirConversa(op.conversaId as string)}
                    >
                      <MessageCircle className="size-4" aria-hidden />
                      Ver conversa
                    </Button>
                  )}
                  <Button variant="ghost" size="sm" onClick={() => setOportunidadeAberta(op.id)}>
                    <FileText className="size-4" aria-hidden />
                    Propostas
                  </Button>
                </li>
              );
            })}
          </ul>
        </Card>
      )}

      {criando && (
        <NovaOportunidadeModal
          conta={{ id: clienteId, nome: clienteNome ?? "esta conta" }}
          etapas={etapas}
          onFechar={() => setCriando(false)}
          // Invalidação de chave na mutation atualiza a lista — sem recarga manual.
          onCriada={() => setCriando(false)}
        />
      )}

      {/* Levantamentos — E03-S05, AC-1/AC-7. O atalho "novo levantamento" só existe a partir de
          uma oportunidade (edge case da spec): sem oportunidade nesta Conta, o botão some, mas os
          levantamentos existentes (criados por outra Conta com oportunidade, ou herdados do PCM)
          continuam listados aqui. */}
      <div className="flex items-center justify-between gap-3">
        <h2 className="font-semibold text-ink">Levantamentos</h2>
        {temEscrita && oportunidades.length > 0 && (
          <Button
            size="sm"
            variant="ghost"
            disabled={criarLevantamento.isPending}
            onClick={() => criarLevantamento.mutateAsync({ clienteId })}
          >
            <ClipboardList className="size-4" aria-hidden />
            {criarLevantamento.isPending ? "Criando…" : "Novo levantamento"}
          </Button>
        )}
      </div>

      {levantamentosQuery.isPending ? (
        <p className="text-sm text-ink-2">Carregando levantamentos…</p>
      ) : levantamentos.length === 0 ? (
        <EmptyState titulo="Nenhum levantamento nesta conta">
          {oportunidades.length > 0
            ? "Peça um novo levantamento para reusar a coleta do PCM como ponto de partida da proposta."
            : "O atalho de novo levantamento aparece quando houver uma oportunidade nesta conta."}
        </EmptyState>
      ) : (
        <Card>
          <ul className="divide-y divide-line/60">
            {levantamentos.map((l) => (
              <li key={l.id} className="flex flex-wrap items-center gap-3 p-3">
                <div className="min-w-48 flex-1">
                  <p className="font-semibold text-ink">{l.titulo}</p>
                  <p className="text-xs text-ink-2">
                    Criado em {formatarData(l.criadoEm)} · {l.itensNaoConformes + l.itensAtencao}{" "}
                    achado(s) de {l.totalItens} item(ns)
                  </p>
                </div>
                {l.status !== "concluida" && <Badge tone="warning">Em andamento</Badge>}
                {onAbrirLevantamento && (
                  <Button variant="ghost" size="sm" onClick={() => onAbrirLevantamento(l.id)}>
                    <Search className="size-4" aria-hidden />
                    Ver assessment completo
                  </Button>
                )}
              </li>
            ))}
          </ul>
        </Card>
      )}
    </div>
  );
}

/** Configuração do funil (E03-S01, AC-2 e AC-6): etapas e motivos de perda.
 *
 * Etapas são configuráveis (decisão 7 do PO) — o processo comercial muda sem migration. O `tipo`
 * (`aberta`/`ganha`/`perdida`) é o que segura as métricas: o dashboard agrega por tipo, então
 * renomear "Ganho" para "Fechado" não quebra a taxa de conversão. */

import { Badge, Button, Card, Field, Input } from "@sinergica/ui";
import { ChevronDown, ChevronUp, Plus, RefreshCw } from "lucide-react";
import { useState } from "react";
import { usePermissoes } from "../../../app/permissoes-context";
import {
  useCriarEtapa,
  useCriarMotivoPerda,
  useEditarEtapa,
  useEditarMotivoPerda,
  useEtapas,
  useMotivosPerda,
  useReordenarEtapas,
} from "../application/comercial-queries";
import type { Etapa } from "../domain/funil";
import { etapasVisiveis, moverEtapa, podeDesativarEtapa } from "../domain/funil";
import { supabaseComercialAdapter } from "../infrastructure/supabase-comercial-adapter";

const TIPO_ROTULO: Record<Etapa["tipo"], string> = {
  aberta: "Em andamento",
  ganha: "Ganho",
  perdida: "Perdido",
};

const TIPO_TOM: Record<Etapa["tipo"], "info" | "success" | "danger"> = {
  aberta: "info",
  ganha: "success",
  perdida: "danger",
};

export function ConfigFunilPage() {
  const { carregando: permissoesCarregando, podeAcessar } = usePermissoes();
  const [erroAcao, setErroAcao] = useState<string | null>(null);
  const [novaEtapa, setNovaEtapa] = useState("");
  const [novoMotivo, setNovoMotivo] = useState("");

  const temLeitura = podeAcessar("comercial", "leitura");
  const temEscrita = podeAcessar("comercial", "escrita");
  const habilitado = !permissoesCarregando && temLeitura;

  const etapasQuery = useEtapas(supabaseComercialAdapter, habilitado);
  const motivosQuery = useMotivosPerda(supabaseComercialAdapter, habilitado);
  const criarEtapaMutation = useCriarEtapa(supabaseComercialAdapter);
  const editarEtapaMutation = useEditarEtapa(supabaseComercialAdapter);
  const reordenarMutation = useReordenarEtapas(supabaseComercialAdapter);
  const criarMotivoMutation = useCriarMotivoPerda(supabaseComercialAdapter);
  const editarMotivoMutation = useEditarMotivoPerda(supabaseComercialAdapter);

  async function alternarEtapa(etapa: Etapa, etapas: Etapa[]) {
    setErroAcao(null);
    // Desativar a última etapa aberta deixaria o funil sem lugar para nascer oportunidade —
    // a regra é do domínio, e a checagem acontece antes da ida ao banco.
    if (etapa.ativo) {
      const impedimento = podeDesativarEtapa(etapa, etapas);
      if (impedimento) {
        setErroAcao(impedimento);
        return;
      }
    }
    try {
      await editarEtapaMutation.mutateAsync({ id: etapa.id, ativo: !etapa.ativo });
    } catch (e) {
      setErroAcao(e instanceof Error ? e.message : "Falha ao atualizar a etapa.");
    }
  }

  async function criarEtapa(etapas: Etapa[]) {
    const nome = novaEtapa.trim();
    if (!nome) return;
    setErroAcao(null);
    try {
      const proximaOrdem = Math.max(0, ...etapas.map((e) => e.ordem)) + 1;
      await criarEtapaMutation.mutateAsync({
        nome,
        ordem: proximaOrdem,
        cor: "#64748B",
        tipo: "aberta",
      });
      setNovaEtapa("");
    } catch (e) {
      setErroAcao(e instanceof Error ? e.message : "Falha ao criar a etapa.");
    }
  }

  async function mover(etapa: Etapa, direcao: "cima" | "baixo") {
    setErroAcao(null);
    const resultado = moverEtapa(etapas, etapa.id, direcao);
    // `moverEtapa` já devolve a lista inalterada quando não há vizinha (primeira/última) — nesse
    // caso não há o que persistir.
    const mudou = resultado.some(
      (nova) => nova.ordem !== etapas.find((antiga) => antiga.id === nova.id)?.ordem,
    );
    if (!mudou) return;
    try {
      await reordenarMutation.mutateAsync(resultado);
    } catch (e) {
      setErroAcao(e instanceof Error ? e.message : "Falha ao reordenar as etapas.");
    }
  }

  async function criarMotivo() {
    const nome = novoMotivo.trim();
    if (!nome) return;
    setErroAcao(null);
    try {
      await criarMotivoMutation.mutateAsync({ nome });
      setNovoMotivo("");
    } catch (e) {
      setErroAcao(e instanceof Error ? e.message : "Falha ao criar o motivo.");
    }
  }

  if (permissoesCarregando) return null;
  if (!temLeitura) return null;

  const etapas = etapasQuery.data ?? [];
  const motivos = motivosQuery.data ?? [];
  const erroCarga = etapasQuery.error ?? motivosQuery.error;

  return (
    <div className="space-y-4">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-brand text-title font-bold text-ink">Configuração do funil</h1>
          <p className="text-body text-ink-2">
            Etapas e motivos de perda. Renomear uma etapa não afeta as métricas — elas usam o tipo.
          </p>
        </div>
        <Button
          variant="ghost"
          onClick={() => {
            etapasQuery.refetch();
            motivosQuery.refetch();
          }}
        >
          <RefreshCw className="size-4" aria-hidden />
          Atualizar
        </Button>
      </header>

      {erroAcao && (
        <Card>
          <p className="p-3 text-body text-danger">{erroAcao}</p>
        </Card>
      )}

      {erroCarga && (
        <Card>
          <p className="p-4 text-body text-danger">
            {erroCarga instanceof Error ? erroCarga.message : "Falha ao carregar a configuração."}
          </p>
        </Card>
      )}

      {!erroCarga && (
        <div className="grid gap-4 lg:grid-cols-2">
          <Card>
            <div className="border-b border-line p-3">
              <h2 className="font-semibold text-ink">Etapas</h2>
            </div>
            <ul className="divide-y divide-line/60">
              {/* Ordenadas visualmente pela `ordem` real, mesmo que a query devolva outra ordem —
               * é a lista que o AC-"reordenar" descreve. Etapas inativas ficam ao final. */}
              {[...etapasVisiveis(etapas), ...etapas.filter((e) => !e.ativo)].map((etapa) => {
                const visiveisAtivas = etapasVisiveis(etapas);
                const indiceVisivel = visiveisAtivas.findIndex((e) => e.id === etapa.id);
                const podeSubir = indiceVisivel > 0;
                const podeDescer =
                  indiceVisivel !== -1 && indiceVisivel < visiveisAtivas.length - 1;
                return (
                  <li key={etapa.id} className="flex items-center gap-2 p-3">
                    {temEscrita && etapa.ativo && (
                      <div className="flex flex-col">
                        <button
                          type="button"
                          disabled={!podeSubir || reordenarMutation.isPending}
                          onClick={() => mover(etapa, "cima")}
                          className="text-ink-3 hover:text-ink disabled:opacity-30"
                          aria-label={`Mover ${etapa.nome} para cima`}
                        >
                          <ChevronUp className="size-3.5" />
                        </button>
                        <button
                          type="button"
                          disabled={!podeDescer || reordenarMutation.isPending}
                          onClick={() => mover(etapa, "baixo")}
                          className="text-ink-3 hover:text-ink disabled:opacity-30"
                          aria-label={`Mover ${etapa.nome} para baixo`}
                        >
                          <ChevronDown className="size-3.5" />
                        </button>
                      </div>
                    )}
                    <span
                      aria-hidden
                      className="size-3 shrink-0 rounded-full"
                      style={{ backgroundColor: etapa.cor }}
                    />
                    <span className="flex-1 text-body text-ink">{etapa.nome}</span>
                    <Badge tone={TIPO_TOM[etapa.tipo]}>{TIPO_ROTULO[etapa.tipo]}</Badge>
                    {!etapa.ativo && <Badge tone="neutral">Desativada</Badge>}
                    {temEscrita && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => alternarEtapa(etapa, etapas)}
                      >
                        {etapa.ativo ? "Desativar" : "Reativar"}
                      </Button>
                    )}
                  </li>
                );
              })}
            </ul>
            {temEscrita && (
              <div className="flex items-end gap-2 border-t border-line p-3">
                <div className="flex-1">
                  <Field label="Nova etapa">
                    {(props) => (
                      <Input
                        {...props}
                        value={novaEtapa}
                        onChange={(e) => setNovaEtapa(e.target.value)}
                        placeholder="Nome da etapa"
                      />
                    )}
                  </Field>
                </div>
                <Button onClick={() => criarEtapa(etapas)} disabled={!novaEtapa.trim()}>
                  <Plus className="size-4" aria-hidden />
                  Adicionar
                </Button>
              </div>
            )}
          </Card>

          <Card>
            <div className="border-b border-line p-3">
              <h2 className="font-semibold text-ink">Motivos de perda</h2>
              <p className="text-caption text-ink-2">
                Obrigatórios ao marcar uma oportunidade como perdida — é o que alimenta o win/loss.
              </p>
            </div>
            <ul className="divide-y divide-line/60">
              {motivos.map((motivo) => (
                <li key={motivo.id} className="flex items-center gap-3 p-3">
                  <span className="flex-1 text-body text-ink">{motivo.nome}</span>
                  {!motivo.ativo && <Badge tone="neutral">Desativado</Badge>}
                  {temEscrita && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={async () => {
                        await editarMotivoMutation.mutateAsync({
                          id: motivo.id,
                          ativo: !motivo.ativo,
                        });
                      }}
                    >
                      {motivo.ativo ? "Desativar" : "Reativar"}
                    </Button>
                  )}
                </li>
              ))}
            </ul>
            {temEscrita && (
              <div className="flex items-end gap-2 border-t border-line p-3">
                <div className="flex-1">
                  <Field label="Novo motivo">
                    {(props) => (
                      <Input
                        {...props}
                        value={novoMotivo}
                        onChange={(e) => setNovoMotivo(e.target.value)}
                        placeholder="Ex.: Prazo de execução"
                      />
                    )}
                  </Field>
                </div>
                <Button onClick={criarMotivo} disabled={!novoMotivo.trim()}>
                  <Plus className="size-4" aria-hidden />
                  Adicionar
                </Button>
              </div>
            )}
          </Card>
        </div>
      )}
    </div>
  );
}

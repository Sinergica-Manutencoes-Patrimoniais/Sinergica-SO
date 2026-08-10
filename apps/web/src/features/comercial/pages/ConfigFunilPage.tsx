/** Configuração do funil (E03-S01, AC-2 e AC-6): etapas e motivos de perda.
 *
 * Etapas são configuráveis (decisão 7 do PO) — o processo comercial muda sem migration. O `tipo`
 * (`aberta`/`ganha`/`perdida`) é o que segura as métricas: o dashboard agrega por tipo, então
 * renomear "Ganho" para "Fechado" não quebra a taxa de conversão. */

import { Badge, Button, Card, Input, Select } from "@sinergica/ui";
import { Plus, RefreshCw } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { usePermissoes } from "../../../app/permissoes-context";
import type { Etapa, MotivoPerda } from "../domain/funil";
import { podeDesativarEtapa } from "../domain/funil";
import { supabaseComercialAdapter } from "../infrastructure/supabase-comercial-adapter";

type Estado =
  | { fase: "carregando" }
  | { fase: "erro"; mensagem: string }
  | { fase: "pronto"; etapas: Etapa[]; motivos: MotivoPerda[] };

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
  const [estado, setEstado] = useState<Estado>({ fase: "carregando" });
  const [erroAcao, setErroAcao] = useState<string | null>(null);
  const [novaEtapa, setNovaEtapa] = useState("");
  const [novoMotivo, setNovoMotivo] = useState("");

  const temLeitura = podeAcessar("comercial", "leitura");
  const temEscrita = podeAcessar("comercial", "escrita");

  const carregar = useCallback(async () => {
    setEstado({ fase: "carregando" });
    try {
      const [etapas, motivos] = await Promise.all([
        supabaseComercialAdapter.listarEtapas(),
        supabaseComercialAdapter.listarMotivosPerda(),
      ]);
      setEstado({ fase: "pronto", etapas, motivos });
    } catch (error) {
      setEstado({
        fase: "erro",
        mensagem: error instanceof Error ? error.message : "Falha ao carregar a configuração.",
      });
    }
  }, []);

  useEffect(() => {
    if (!permissoesCarregando && temLeitura) carregar();
  }, [permissoesCarregando, temLeitura, carregar]);

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
      await supabaseComercialAdapter.editarEtapa({ id: etapa.id, ativo: !etapa.ativo });
      await carregar();
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
      await supabaseComercialAdapter.criarEtapa({
        nome,
        ordem: proximaOrdem,
        cor: "#64748B",
        tipo: "aberta",
      });
      setNovaEtapa("");
      await carregar();
    } catch (e) {
      setErroAcao(e instanceof Error ? e.message : "Falha ao criar a etapa.");
    }
  }

  async function criarMotivo() {
    const nome = novoMotivo.trim();
    if (!nome) return;
    setErroAcao(null);
    try {
      await supabaseComercialAdapter.criarMotivoPerda({ nome });
      setNovoMotivo("");
      await carregar();
    } catch (e) {
      setErroAcao(e instanceof Error ? e.message : "Falha ao criar o motivo.");
    }
  }

  if (permissoesCarregando) return null;
  if (!temLeitura) return null;

  return (
    <div className="space-y-4">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-brand text-xl font-bold text-ink">Configuração do funil</h1>
          <p className="text-sm text-ink-2">
            Etapas e motivos de perda. Renomear uma etapa não afeta as métricas — elas usam o tipo.
          </p>
        </div>
        <Button variant="ghost" onClick={carregar}>
          <RefreshCw className="size-4" aria-hidden />
          Atualizar
        </Button>
      </header>

      {erroAcao && (
        <Card>
          <p className="p-3 text-sm text-danger">{erroAcao}</p>
        </Card>
      )}

      {estado.fase === "erro" && (
        <Card>
          <p className="p-4 text-sm text-danger">{estado.mensagem}</p>
        </Card>
      )}

      {estado.fase === "pronto" && (
        <div className="grid gap-4 lg:grid-cols-2">
          <Card>
            <div className="border-b border-line p-3">
              <h2 className="font-semibold text-ink">Etapas</h2>
            </div>
            <ul className="divide-y divide-line/60">
              {estado.etapas.map((etapa) => (
                <li key={etapa.id} className="flex items-center gap-3 p-3">
                  <span
                    aria-hidden
                    className="size-3 shrink-0 rounded-full"
                    style={{ backgroundColor: etapa.cor }}
                  />
                  <span className="flex-1 text-sm text-ink">{etapa.nome}</span>
                  <Badge tone={TIPO_TOM[etapa.tipo]}>{TIPO_ROTULO[etapa.tipo]}</Badge>
                  {!etapa.ativo && <Badge tone="neutral">Desativada</Badge>}
                  {temEscrita && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => alternarEtapa(etapa, estado.etapas)}
                    >
                      {etapa.ativo ? "Desativar" : "Reativar"}
                    </Button>
                  )}
                </li>
              ))}
            </ul>
            {temEscrita && (
              <div className="flex items-end gap-2 border-t border-line p-3">
                <label className="flex-1 text-xs font-semibold text-ink-2">
                  Nova etapa
                  <Input
                    value={novaEtapa}
                    onChange={(e) => setNovaEtapa(e.target.value)}
                    placeholder="Nome da etapa"
                  />
                </label>
                <Button onClick={() => criarEtapa(estado.etapas)} disabled={!novaEtapa.trim()}>
                  <Plus className="size-4" aria-hidden />
                  Adicionar
                </Button>
              </div>
            )}
          </Card>

          <Card>
            <div className="border-b border-line p-3">
              <h2 className="font-semibold text-ink">Motivos de perda</h2>
              <p className="text-xs text-ink-2">
                Obrigatórios ao marcar uma oportunidade como perdida — é o que alimenta o win/loss.
              </p>
            </div>
            <ul className="divide-y divide-line/60">
              {estado.motivos.map((motivo) => (
                <li key={motivo.id} className="flex items-center gap-3 p-3">
                  <span className="flex-1 text-sm text-ink">{motivo.nome}</span>
                  {!motivo.ativo && <Badge tone="neutral">Desativado</Badge>}
                  {temEscrita && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={async () => {
                        await supabaseComercialAdapter.editarMotivoPerda({
                          id: motivo.id,
                          ativo: !motivo.ativo,
                        });
                        await carregar();
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
                <label className="flex-1 text-xs font-semibold text-ink-2">
                  Novo motivo
                  <Input
                    value={novoMotivo}
                    onChange={(e) => setNovoMotivo(e.target.value)}
                    placeholder="Ex.: Prazo de execução"
                  />
                </label>
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

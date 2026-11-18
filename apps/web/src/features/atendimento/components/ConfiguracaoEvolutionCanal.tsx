import { CheckCircle2, RefreshCw, ShieldCheck } from "lucide-react";
import { useState } from "react";
import type { PortaDeConfiguracaoEvolution } from "../application/configurar-evolution";
import { configurarInstanciaEvolution } from "../application/configurar-evolution";

// E02-S35 (ADR-1686, tasks 12-15) — máquina de vistas pra migrar um canal do webhook legado
// (token global, instância resolvida pelo corpo do evento) pro webhook novo por canal (E02-S36).
//
// SPEC_DEVIATION: plan.md chamava este arquivo de `ConfiguracaoEvolution.tsx`, mas esse nome já
// existe como componente interno (não exportado) em `EvolutionTab.tsx` (o formulário simples de
// URL/chave do fluxo legado). Nome trocado pra `ConfiguracaoEvolutionCanal` pra não colidir —
// os dois coexistem durante a transição, igual a função `evolution-configurar` já coexiste com
// `atendimento-evolution` (SPEC_DEVIATION já registrada em specs/E02-S35-canal-evolution-confiavel/tasks.md).

export interface PortaDeConfiguracaoEvolutionCompleta extends PortaDeConfiguracaoEvolution {
  salvarServidor(input: {
    urlBase: string;
    apikeyGlobal: string;
  }): Promise<{ estado: "compativel" | "incompativel"; versao: string | null; motivo?: string }>;
}

export function ConfiguracaoEvolutionCanal({
  porta,
  canais,
  temEscrita,
}: {
  porta: PortaDeConfiguracaoEvolutionCompleta;
  canais: Array<{ id: string; label: string }>;
  temEscrita: boolean;
}) {
  const [urlBase, setUrlBase] = useState("");
  const [apikeyGlobal, setApikeyGlobal] = useState("");
  const [salvandoServidor, setSalvandoServidor] = useState(false);
  const [resultadoServidor, setResultadoServidor] = useState<{
    estado: "compativel" | "incompativel";
    versao: string | null;
    motivo?: string;
  } | null>(null);
  const [erroServidor, setErroServidor] = useState<string | null>(null);

  const [migrando, setMigrando] = useState<string | null>(null);
  const [resultadoPorCanal, setResultadoPorCanal] = useState<
    Record<string, { estado: string; adotada: boolean } | { erro: string }>
  >({});

  if (!temEscrita) return null;

  async function salvarServidor() {
    setErroServidor(null);
    setResultadoServidor(null);
    setSalvandoServidor(true);
    try {
      const resultado = await porta.salvarServidor({
        urlBase: urlBase.trim(),
        apikeyGlobal: apikeyGlobal.trim(),
      });
      setResultadoServidor(resultado);
      setApikeyGlobal("");
    } catch (erro) {
      setErroServidor(erro instanceof Error ? erro.message : "Não foi possível salvar o servidor.");
    } finally {
      setSalvandoServidor(false);
    }
  }

  async function migrarWebhook(canalId: string) {
    setMigrando(canalId);
    setResultadoPorCanal((atual) => {
      const { [canalId]: _descartado, ...resto } = atual;
      return resto;
    });
    try {
      const resultado = await configurarInstanciaEvolution(porta, canalId);
      setResultadoPorCanal((atual) => ({ ...atual, [canalId]: resultado }));
    } catch (erro) {
      setResultadoPorCanal((atual) => ({
        ...atual,
        [canalId]: { erro: erro instanceof Error ? erro.message : "Falha ao migrar o webhook." },
      }));
    } finally {
      setMigrando(null);
    }
  }

  return (
    <section className="rounded-xl border border-info-line bg-info-soft p-4">
      <h3 className="flex items-center gap-1.5 text-body font-semibold text-ink">
        <ShieldCheck className="h-4 w-4" />
        Webhook por canal (E02-S36)
      </h3>
      <p className="mt-1 text-caption text-ink-3">
        Migra o webhook do token global (legado) para o segredo por canal, sem derrubar a conexão já
        pareada — a instância existente é adotada, nunca recriada.
      </p>

      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        <label className="block">
          <span className="mb-1 block text-caption font-semibold text-ink-3">
            URL do servidor Evolution
          </span>
          <input
            className="input w-full"
            value={urlBase}
            onChange={(event) => setUrlBase(event.target.value)}
            placeholder="https://evolution.exemplo.com.br"
          />
        </label>
        <label className="block">
          <span className="mb-1 block text-caption font-semibold text-ink-3">
            Apikey global (a mesma já usada hoje)
          </span>
          <input
            type="password"
            className="input w-full"
            value={apikeyGlobal}
            onChange={(event) => setApikeyGlobal(event.target.value)}
            placeholder="apikey"
          />
        </label>
      </div>
      <button
        type="button"
        onClick={() => void salvarServidor()}
        disabled={salvandoServidor || !urlBase.trim() || !apikeyGlobal.trim()}
        className="mt-3 btn-primary"
      >
        {salvandoServidor ? "Salvando…" : "1. Salvar servidor"}
      </button>
      {erroServidor && <p className="mt-2 text-body text-danger">{erroServidor}</p>}
      {resultadoServidor && (
        <p
          className={`mt-2 text-body ${resultadoServidor.estado === "compativel" ? "text-success" : "text-danger"}`}
        >
          {resultadoServidor.estado === "compativel"
            ? `Servidor compatível (versão ${resultadoServidor.versao ?? "desconhecida"}).`
            : `Servidor incompatível: ${resultadoServidor.motivo ?? "motivo desconhecido"}.`}
        </p>
      )}

      {canais.length > 0 && (
        <div className="mt-4 divide-y divide-line-soft border-t border-line-soft pt-3">
          {canais.map((canal) => {
            const resultado = resultadoPorCanal[canal.id];
            return (
              <div
                key={canal.id}
                className="flex flex-wrap items-center justify-between gap-2 py-2"
              >
                <p className="text-body text-ink-2">{canal.label}</p>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => void migrarWebhook(canal.id)}
                    disabled={migrando !== null}
                    className="inline-flex items-center gap-1 text-caption font-semibold text-orange disabled:opacity-60"
                  >
                    <RefreshCw className="h-3.5 w-3.5" />
                    {migrando === canal.id ? "Migrando…" : "2. Migrar webhook"}
                  </button>
                  {resultado && "erro" in resultado && (
                    <span className="text-caption text-danger">{resultado.erro}</span>
                  )}
                  {resultado && "estado" in resultado && (
                    <span className="inline-flex items-center gap-1 text-caption text-success">
                      <CheckCircle2 className="h-3.5 w-3.5" />
                      {resultado.adotada
                        ? "migrado, conexão mantida"
                        : `estado: ${resultado.estado}`}
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}

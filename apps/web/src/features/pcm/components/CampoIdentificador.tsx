import { Button, ConfirmDialog } from "@sinergica/ui";
import { useEffect, useState } from "react";
import { usePreviaIdentificador } from "../application/ativos-cliente-queries";
import type { EntradaIdentificadorAtivo } from "../application/identificador-ativo";
import type { NivelComSigla } from "../application/identificador-ativo-gateway";
import { sugerirSigla } from "../domain/siglas";
import { supabaseIdentificadorAtivoAdapter } from "../infrastructure/supabase-identificador-ativo-adapter";

type SiglaInformada = { nivel: NivelComSigla; id: string; sigla: string };

export function CampoIdentificador({
  modo,
  input,
  valor,
  onManualChange,
  siglasInformadas,
  onSiglasChange,
}: {
  modo: "criar" | "editar";
  input: EntradaIdentificadorAtivo | null;
  valor: string;
  onManualChange: (valor: string, alterado: boolean) => void;
  siglasInformadas: SiglaInformada[];
  onSiglasChange: (siglas: SiglaInformada[]) => void;
}) {
  const [editando, setEditando] = useState(false);
  const [confirmarAlteracao, setConfirmarAlteracao] = useState(false);
  const previa = usePreviaIdentificador(supabaseIdentificadorAtivoAdapter, input);
  const resultado = previa.data;
  const sugestao = resultado?.prefixo ? `${resultado.prefixo}-${resultado.nn ?? "##"}` : "—";

  useEffect(() => {
    const faltantes = resultado?.faltantes ?? [];
    const novas = faltantes
      .filter(
        (faltante) =>
          !siglasInformadas.some(
            (item) => item.id === faltante.id && item.nivel === faltante.nivel,
          ),
      )
      .map((faltante) => ({
        nivel: faltante.nivel,
        id: faltante.id,
        sigla: sugerirSigla(faltante.nome, { manterNumero: true }).sigla,
      }));
    if (novas.length) onSiglasChange([...siglasInformadas, ...novas]);
  }, [resultado?.faltantes, siglasInformadas, onSiglasChange]);

  function atualizarSigla(nivel: NivelComSigla, id: string, sigla: string) {
    const restante = siglasInformadas.filter((item) => item.id !== id || item.nivel !== nivel);
    onSiglasChange([...restante, { nivel, id, sigla: sigla.toUpperCase() }]);
  }

  if (!editando) {
    return (
      <section className="space-y-2 md:col-span-2">
        <label className="block">
          <span className="mb-1 block text-caption font-semibold text-ink-3">Identificador</span>
          <div className="flex gap-2">
            <input readOnly value={valor || sugestao} className="input w-full bg-line-soft" />
            <Button
              type="button"
              variant="secondary"
              onClick={() => (modo === "editar" ? setConfirmarAlteracao(true) : setEditando(true))}
            >
              Editar identificador
            </Button>
          </div>
        </label>
        {resultado?.faltantes.length ? (
          <SiglasFaltantes
            resultado={resultado.faltantes}
            siglasInformadas={siglasInformadas}
            atualizarSigla={atualizarSigla}
          />
        ) : null}
        <ConfirmDialog
          open={confirmarAlteracao}
          onOpenChange={setConfirmarAlteracao}
          titulo="Alterar identificador?"
          descricao="O identificador é usado no QR Code do Auvo. Etiquetas já impressas deixarão de corresponder a este ativo. Deseja continuar?"
          onConfirmar={async () => setEditando(true)}
        />
      </section>
    );
  }

  return (
    <section className="space-y-2 md:col-span-2">
      <div className="flex items-end gap-2">
        <label className="block min-w-0 flex-1">
          <span className="mb-1 block text-caption font-semibold text-ink-3">Identificador</span>
          <input
            value={valor}
            onChange={(event) => onManualChange(event.target.value, true)}
            placeholder={sugestao}
            className="input w-full"
          />
        </label>
        {modo === "criar" && !valor && (
          <span className="pb-2 text-caption text-ink-3">Sugestão: {sugestao}</span>
        )}
      </div>
      {resultado?.faltantes.length ? (
        <SiglasFaltantes
          resultado={resultado.faltantes}
          siglasInformadas={siglasInformadas}
          atualizarSigla={atualizarSigla}
        />
      ) : null}
    </section>
  );
}

function SiglasFaltantes({
  resultado,
  siglasInformadas,
  atualizarSigla,
}: {
  resultado: readonly { nivel: NivelComSigla; id: string; nome: string }[];
  siglasInformadas: SiglaInformada[];
  atualizarSigla: (nivel: NivelComSigla, id: string, sigla: string) => void;
}) {
  return (
    <div className="rounded-md border border-warning-line bg-warning-soft p-3">
      <p className="mb-2 text-caption font-semibold text-ink-2">Siglas faltando</p>
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        {resultado.map((faltante) => {
          const atual = siglasInformadas.find(
            (item) => item.id === faltante.id && item.nivel === faltante.nivel,
          );
          return (
            <label
              key={`${faltante.nivel}-${faltante.id}`}
              className="block text-caption text-ink-3"
            >
              {faltante.nome}
              <input
                value={atual?.sigla ?? sugerirSigla(faltante.nome, { manterNumero: true }).sigla}
                onChange={(event) =>
                  atualizarSigla(faltante.nivel, faltante.id, event.target.value)
                }
                onFocus={() => {
                  if (!atual)
                    atualizarSigla(
                      faltante.nivel,
                      faltante.id,
                      sugerirSigla(faltante.nome, { manterNumero: true }).sigla,
                    );
                }}
                maxLength={3}
                className="input mt-1 w-full"
              />
            </label>
          );
        })}
      </div>
    </div>
  );
}

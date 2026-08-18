// E01-S125 — nenhum clique cria task automaticamente: primeiro busca preview sem efeito, depois
// exige confirmação explícita. O contrato de Edge devolve somente campos não secretos.
import { Button, Modal } from "@sinergica/ui";
import { useEffect, useState } from "react";
import { erroDetalhado } from "../../../lib/http/edge-function-error";
import { supabase } from "../../../lib/supabase-client";

interface PreviewAuvo {
  jaAberta: boolean;
  taskIdExistente: number | null;
  podeAbrir: boolean;
  pendencias: string[];
  payload: {
    customerId: number | null;
    taskTypeId: number | null;
    priority: number;
    orientation: string;
  };
  conferenciaPcm: {
    cliente: string;
    tecnico: string;
    dataAgendada: string | null;
    local: string | null;
  };
}

export function AbrirOsAuvoModal({
  osId,
  onFechar,
  onAberta,
}: { osId: string; onFechar: () => void; onAberta: () => void }) {
  const [preview, setPreview] = useState<PreviewAuvo | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false);

  useEffect(() => {
    let ativo = true;
    async function carregar() {
      setErro(null);
      const { data, error } = await supabase.functions.invoke("pcm-auvo-open-task", {
        body: { osId, dryRun: true },
      });
      if (error) {
        if (ativo) setErro((await erroDetalhado(error)).message);
        return;
      }
      if (ativo) setPreview(data as PreviewAuvo);
    }
    carregar();
    return () => {
      ativo = false;
    };
  }, [osId]);

  async function confirmar() {
    setSalvando(true);
    setErro(null);
    try {
      const { data, error } = await supabase.functions.invoke("pcm-auvo-open-task", {
        body: { osId, dryRun: false },
      });
      if (error) throw await erroDetalhado(error);
      const resultado = data as { ok?: boolean; taskId?: number; detail?: string };
      if (!resultado.ok)
        throw new Error(resultado.detail ?? "Auvo não confirmou a abertura. Tente novamente.");
      onAberta();
      onFechar();
    } catch (causa) {
      setErro(causa instanceof Error ? causa.message : "Não foi possível abrir OS no Auvo.");
    } finally {
      setSalvando(false);
    }
  }

  return (
    <Modal
      open
      onOpenChange={(open) => {
        if (!open) onFechar();
      }}
      titulo="Abrir OS no Auvo?"
      descricao="Confira dados. Nada foi enviado durante esta prévia."
    >
      <div className="space-y-3 text-sm">
        {!preview && !erro && <p className="py-8 text-sm text-ink-3">Montando prévia…</p>}
        {preview && (
          <div className="space-y-3 text-sm">
            {preview.jaAberta ? (
              <p className="rounded-md bg-orange-soft px-3 py-2 text-orange">
                Task Auvo #{preview.taskIdExistente} já existe. Nenhuma duplicata será criada.
              </p>
            ) : (
              <>
                <Campos
                  titulo="Campos enviados"
                  itens={[
                    [
                      "Cliente Auvo",
                      preview.payload.customerId == null
                        ? "Será resolvido ao confirmar"
                        : String(preview.payload.customerId),
                    ],
                    [
                      "Tipo de tarefa",
                      preview.payload.taskTypeId == null
                        ? "Não configurado"
                        : String(preview.payload.taskTypeId),
                    ],
                    ["Prioridade", String(preview.payload.priority)],
                    ["Orientação", preview.payload.orientation],
                  ]}
                />
                <Campos
                  titulo="Conferência PCM"
                  itens={[
                    ["Cliente", preview.conferenciaPcm.cliente],
                    ["Técnico", preview.conferenciaPcm.tecnico],
                    [
                      "Data",
                      preview.conferenciaPcm.dataAgendada
                        ? new Date(preview.conferenciaPcm.dataAgendada).toLocaleString("pt-BR")
                        : "Não agendada",
                    ],
                    ["Local", preview.conferenciaPcm.local ?? "Não informado"],
                  ]}
                />
                {preview.pendencias.map((pendencia) => (
                  <p key={pendencia} className="text-xs text-danger">
                    {pendencia}
                  </p>
                ))}
                <p className="text-micro text-ink-3">
                  Técnico, data e local são exibidos para conferência. Contrato Auvo atual não
                  confirma envio desses campos.
                </p>
              </>
            )}
          </div>
        )}
        {erro && <p className="text-sm text-danger">{erro}</p>}
        <div className="flex justify-end gap-2 border-t border-line-soft pt-3">
          <Button variant="secondary" onClick={onFechar}>
            {preview?.jaAberta ? "Fechar" : "Agora não"}
          </Button>
          {preview && !preview.jaAberta && (
            <Button
              variant="primary"
              onClick={confirmar}
              disabled={!preview.podeAbrir || salvando}
              loading={salvando}
            >
              {salvando ? "Abrindo…" : "Confirmar abertura"}
            </Button>
          )}
        </div>
      </div>
    </Modal>
  );
}

function Campos({ titulo, itens }: { titulo: string; itens: Array<[string, string]> }) {
  return (
    <div>
      <p className="mb-1 text-micro font-semibold uppercase tracking-wider text-ink-3">{titulo}</p>
      {itens.map(([rotulo, valor]) => (
        <p
          key={rotulo}
          className="grid grid-cols-[110px_1fr] gap-2 border-b border-line-soft py-1 text-xs"
        >
          <span className="text-ink-3">{rotulo}</span>
          <span className="break-words text-ink">{valor}</span>
        </p>
      ))}
    </div>
  );
}

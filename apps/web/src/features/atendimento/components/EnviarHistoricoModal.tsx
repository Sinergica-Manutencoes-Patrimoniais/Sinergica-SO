// EnviarHistoricoModal.tsx — E01-S89. Anexa X dias de conversa a um Chamado existente ou recém-criado.
import { Button, Modal } from "@sinergica/ui";
import { useEffect, useState } from "react";
import type { ChamadoOpcao } from "../application/historico-chamado-gateway";
import { JANELAS_DIAS_PADRAO } from "../domain/historico-chamado";

export function EnviarHistoricoModal({
  clienteNome,
  podeCriarChamado,
  onCarregarChamados,
  onCancel,
  onEnviar,
  onCriarChamado,
}: {
  clienteNome: string;
  podeCriarChamado: boolean;
  onCarregarChamados: () => Promise<ChamadoOpcao[]>;
  onCancel: () => void;
  onEnviar: (chamadoId: string, janelaDias: number) => Promise<void>;
  onCriarChamado: (titulo: string) => Promise<ChamadoOpcao>;
}) {
  const [chamados, setChamados] = useState<ChamadoOpcao[] | null>(null);
  const [chamadoId, setChamadoId] = useState("");
  const [janelaDias, setJanelaDias] = useState(7);
  const [criandoNovo, setCriandoNovo] = useState(false);
  const [tituloNovo, setTituloNovo] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    onCarregarChamados().then((lista) => {
      setChamados(lista);
      const primeiro = lista[0];
      if (primeiro) setChamadoId(primeiro.id);
      else if (podeCriarChamado) setCriandoNovo(true);
    });
  }, [onCarregarChamados, podeCriarChamado]);

  async function confirmar() {
    setEnviando(true);
    setErro(null);
    try {
      let idDestino = chamadoId;
      if (criandoNovo) {
        const criado = await onCriarChamado(tituloNovo.trim());
        idDestino = criado.id;
      }
      await onEnviar(idDestino, janelaDias);
      onCancel();
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Não foi possível enviar o histórico.");
    } finally {
      setEnviando(false);
    }
  }

  const podeConfirmar = criandoNovo ? tituloNovo.trim().length > 0 : chamadoId.length > 0;

  return (
    <Modal
      open
      onOpenChange={(aberto) => {
        if (!aberto) onCancel();
      }}
      titulo="Enviar histórico ao Chamado"
    >
      <div className="flex flex-col gap-3">
        <p className="text-sm text-ink-2">Cliente: {clienteNome}</p>

        <label className="block">
          <span className="mb-1 block text-xs font-semibold text-ink-3">Janela de mensagens</span>
          <select
            value={janelaDias}
            onChange={(e) => setJanelaDias(Number(e.target.value))}
            className="input w-full"
          >
            {JANELAS_DIAS_PADRAO.map((dias) => (
              <option key={dias} value={dias}>
                Últimos {dias} dia{dias > 1 ? "s" : ""}
              </option>
            ))}
          </select>
        </label>

        {chamados === null ? (
          <p className="text-xs text-ink-3">Carregando Chamados…</p>
        ) : (
          <div className="block">
            <span className="mb-1 block text-xs font-semibold text-ink-3">Chamado de destino</span>
            {!criandoNovo && chamados.length > 0 && (
              <select
                value={chamadoId}
                onChange={(e) => setChamadoId(e.target.value)}
                className="input w-full"
              >
                {chamados.map((chamado) => (
                  <option key={chamado.id} value={chamado.id}>
                    {chamado.numero} · {chamado.titulo}
                  </option>
                ))}
              </select>
            )}
            {podeCriarChamado && (
              <Button
                variant="ghost"
                size="sm"
                className="mt-2 text-orange hover:text-orange-deep"
                onClick={() => setCriandoNovo((v) => !v)}
              >
                {criandoNovo ? "Usar Chamado existente" : "+ Criar novo Chamado"}
              </Button>
            )}
            {criandoNovo && (
              <input
                value={tituloNovo}
                onChange={(e) => setTituloNovo(e.target.value)}
                className="input mt-2 w-full"
                placeholder="Título do novo Chamado"
              />
            )}
          </div>
        )}

        {erro && (
          <div className="rounded-md border border-danger-line bg-danger-soft px-3 py-2 text-sm text-danger">
            {erro}
          </div>
        )}

        <div className="flex justify-end gap-2 border-t border-line-soft pt-3">
          <Button variant="secondary" onClick={onCancel}>
            Cancelar
          </Button>
          <Button
            variant="primary"
            onClick={confirmar}
            disabled={enviando || !podeConfirmar}
            loading={enviando}
          >
            {enviando ? "Enviando…" : "Enviar histórico"}
          </Button>
        </div>
      </div>
    </Modal>
  );
}

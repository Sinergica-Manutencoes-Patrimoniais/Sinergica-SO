// NovoChamadoModal.tsx — E01-S118. Extraído da ChamadosPage pra ser reusado no board da Operação
// (o "Novo Chamado" do topo). Abrir um Chamado é o intake que, após tratativa, vira OS pro Auvo.
import { X } from "lucide-react";
import { useState } from "react";
import { useFormularioSujo } from "../../../app/use-formulario-sujo";
import type { DadosAberturaOs } from "../application/ordem-servico-gateway";
import type { ChamadoFormData } from "../domain/chamados";
import { SeletorLocal } from "./SeletorLocal";

export function NovoChamadoModal({
  clientes,
  onCancel,
  onSalvar,
}: {
  clientes: DadosAberturaOs["clientes"];
  onCancel: () => void;
  onSalvar: (dados: ChamadoFormData) => Promise<void>;
}) {
  const [clienteId, setClienteId] = useState(clientes[0]?.id ?? "");
  const [titulo, setTitulo] = useState("");
  const [descricao, setDescricao] = useState("");
  const [local, setLocal] = useState("");
  const [solicitante, setSolicitante] = useState("");
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  useFormularioSujo(
    { clienteId: clientes[0]?.id ?? "", titulo: "", descricao: "", local: "", solicitante: "" },
    { clienteId, titulo, descricao, local, solicitante },
  );

  async function salvar() {
    setSalvando(true);
    setErro(null);
    try {
      await onSalvar({
        clienteId,
        titulo,
        descricao: descricao || null,
        local: local || null,
        solicitante: solicitante || null,
      });
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Não foi possível criar o Chamado.");
    } finally {
      setSalvando(false);
    }
  }

  return (
    <div className="modal-backdrop">
      <div className="w-full max-w-lg rounded-lg border border-line bg-card shadow-modal">
        <div className="flex items-center justify-between border-b border-line px-4 py-3">
          <h3 className="text-base font-semibold text-ink">Novo Chamado</h3>
          <button type="button" onClick={onCancel} className="text-ink-3 hover:text-ink">
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="flex flex-col gap-3 p-4">
          <label className="block">
            <span className="mb-1 block text-xs font-semibold text-ink-3">Cliente *</span>
            <select
              value={clienteId}
              onChange={(e) => setClienteId(e.target.value)}
              className="input w-full"
            >
              {clientes.length === 0 ? (
                <option value="">Nenhum cliente disponível</option>
              ) : (
                clientes.map((cliente) => (
                  <option key={cliente.id} value={cliente.id}>
                    {cliente.nome}
                  </option>
                ))
              )}
            </select>
          </label>
          <label className="block">
            <span className="mb-1 block text-xs font-semibold text-ink-3">Título *</span>
            <input
              value={titulo}
              onChange={(e) => setTitulo(e.target.value)}
              className="input w-full"
              placeholder="Ex: Vazamento no térreo"
            />
          </label>
          <label className="block">
            <span className="mb-1 block text-xs font-semibold text-ink-3">Descrição</span>
            <textarea
              value={descricao}
              onChange={(e) => setDescricao(e.target.value)}
              className="input min-h-20 w-full resize-y"
            />
          </label>
          <SeletorLocal clienteId={clienteId} value={local} onChange={setLocal} />
          <label className="block">
            <span className="mb-1 block text-xs font-semibold text-ink-3">Solicitante</span>
            <input
              value={solicitante}
              onChange={(e) => setSolicitante(e.target.value)}
              className="input w-full"
              placeholder="Ex: João Silva (síndico)"
            />
          </label>
          {erro && (
            <div className="rounded-md border border-danger-line bg-danger-soft px-3 py-2 text-sm text-danger">
              {erro}
            </div>
          )}
        </div>
        <div className="flex justify-end gap-2 border-t border-line px-4 py-3">
          <button type="button" onClick={onCancel} className="btn-secondary">
            Cancelar
          </button>
          <button
            type="button"
            onClick={salvar}
            disabled={salvando || !clienteId || !titulo.trim()}
            className="h-9 rounded-md bg-navy px-3 text-sm font-semibold text-white hover:bg-navy-deep disabled:opacity-50"
          >
            {salvando ? "Salvando…" : "Criar Chamado"}
          </button>
        </div>
      </div>
    </div>
  );
}

import { Button, Modal } from "@sinergica/ui";
import { useState } from "react";
import type { EquipamentoClienteOpcao } from "../domain/equipamentos";
import type { Sistema, SistemaFormData } from "../domain/sistemas";
import { CampoIdentificador } from "./CampoIdentificador";
import { SeletorCategoria } from "./SeletorCategoria";
import { SeletorPosicao } from "./SeletorPosicao";

/** Formulário compartilhado pela tela global e Visão 360; nesta, cliente já vem do contexto. */
export function SistemaModal({
  sistema,
  clientes,
  clienteFixoId,
  userId,
  onCancel,
  onSalvar,
}: {
  sistema?: Sistema;
  clientes: EquipamentoClienteOpcao[];
  clienteFixoId?: string;
  userId?: string;
  onCancel: () => void;
  onSalvar: (dados: SistemaFormData) => Promise<void>;
}) {
  const [dados, setDados] = useState<SistemaFormData>({
    clienteId: clienteFixoId ?? sistema?.clienteId ?? "",
    areaId: sistema?.areaId ?? null,
    localId: sistema?.localId ?? null,
    nome: sistema?.nome ?? "",
    codigo: sistema?.codigo ?? "",
    identificadorManual: sistema?.codigo ?? null,
    siglasInformadas: [],
    categoriaId: sistema?.categoriaId ?? null,
    categoria: sistema?.categoria ?? null,
    descricao: sistema?.descricao ?? "",
  });
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  async function salvar() {
    try {
      setSalvando(true);
      setErro(null);
      await onSalvar(dados);
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Não foi possível salvar o Sistema.");
    } finally {
      setSalvando(false);
    }
  }

  return (
    <Modal
      open
      onOpenChange={(aberto) => {
        if (!aberto) onCancel();
      }}
      titulo={sistema ? "Editar Sistema" : "Novo Sistema"}
    >
      <div className="flex flex-col gap-3">
        {!clienteFixoId && (
          <label className="block">
            <span className="mb-1 block text-caption font-semibold text-ink-3">Cliente *</span>
            <select
              value={dados.clienteId}
              onChange={(e) =>
                setDados((atual) => ({
                  ...atual,
                  clienteId: e.target.value,
                  areaId: null,
                  localId: null,
                }))
              }
              className="input w-full"
              disabled={Boolean(sistema)}
            >
              <option value="">Selecione…</option>
              {clientes.map((cliente) => (
                <option key={cliente.id} value={cliente.id}>
                  {cliente.nome}
                </option>
              ))}
            </select>
          </label>
        )}
        <CampoIdentificador
          modo={sistema ? "editar" : "criar"}
          input={
            dados.clienteId && dados.categoriaId
              ? {
                  clienteId: dados.clienteId,
                  areaId: dados.areaId ?? null,
                  localId: dados.localId ?? null,
                  categoriaId: dados.categoriaId,
                  nomeAtivo: dados.nome,
                }
              : null
          }
          valor={dados.identificadorManual ?? ""}
          onManualChange={(identificadorManual, alterarIdentificador) =>
            setDados((atual) => ({
              ...atual,
              codigo: identificadorManual,
              identificadorManual,
              alterarIdentificador,
            }))
          }
          siglasInformadas={dados.siglasInformadas ?? []}
          onSiglasChange={(siglasInformadas) =>
            setDados((atual) => ({ ...atual, siglasInformadas }))
          }
        />
        <SeletorPosicao
          clienteId={dados.clienteId || null}
          areaId={dados.areaId ?? null}
          localId={dados.localId ?? null}
          onChange={({ areaId, localId }) => setDados((atual) => ({ ...atual, areaId, localId }))}
        />
        <label className="block">
          <span className="mb-1 block text-caption font-semibold text-ink-3">Nome *</span>
          <input
            value={dados.nome}
            onChange={(e) => setDados((atual) => ({ ...atual, nome: e.target.value }))}
            className="input w-full"
            placeholder='ex.: "Sistema de Hidrante Torre A"'
          />
        </label>
        <SeletorCategoria
          value={dados.categoriaId ?? null}
          textoLegado={dados.categoria}
          userId={userId}
          onChange={(categoriaId) => setDados((atual) => ({ ...atual, categoriaId }))}
        />
        {erro && (
          <div className="rounded-md border border-danger-line bg-danger-soft px-3 py-2 text-body text-danger">
            {erro}
          </div>
        )}
      </div>
      <div className="mt-4 flex justify-end gap-2 border-t border-line pt-4">
        <Button variant="secondary" onClick={onCancel}>
          Cancelar
        </Button>
        <button
          type="button"
          onClick={salvar}
          disabled={salvando}
          className="h-9 rounded-md bg-orange px-3 text-body font-semibold text-white hover:bg-orange-deep disabled:opacity-50"
        >
          {salvando ? "Salvando…" : "Salvar"}
        </button>
      </div>
    </Modal>
  );
}

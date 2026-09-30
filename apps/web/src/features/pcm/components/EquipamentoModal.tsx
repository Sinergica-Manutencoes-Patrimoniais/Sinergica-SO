// E01-S79: extraído de EquipamentosPage.tsx pra componente compartilhado — reusado também pelo
// drawer de detalhe do Board (E01-S78), que antes só permitia visualizar, nunca editar.
import { Button, Modal } from "@sinergica/ui";
import { useState } from "react";
import type {
  EquipamentoClienteOpcao,
  EquipamentoFormData,
  EquipamentoItem,
} from "../domain/equipamentos";
import { CampoIdentificador } from "./CampoIdentificador";
import { SeletorCategoria } from "./SeletorCategoria";
import { SeletorPosicao } from "./SeletorPosicao";

export function EquipamentoModal({
  equipamento,
  clientes,
  clienteFixoId,
  userId,
  onCancel,
  onSalvar,
}: {
  equipamento?: EquipamentoItem;
  clientes: EquipamentoClienteOpcao[];
  clienteFixoId?: string;
  userId?: string;
  onCancel: () => void;
  onSalvar: (input: EquipamentoFormData) => Promise<void>;
}) {
  const [dados, setDados] = useState<EquipamentoFormData>({
    nome: equipamento?.nome ?? "",
    identificador: equipamento?.identificador ?? "",
    identificadorManual: equipamento?.identificador ?? null,
    siglasInformadas: [],
    categoriaId: equipamento?.categoriaId ?? null,
    categoria: equipamento?.categoria ?? null,
    clientId: clienteFixoId ?? equipamento?.clientId ?? "",
    localizacao: equipamento?.localizacao ?? "",
    observacoes: equipamento?.observacoes ?? "",
    tipo: equipamento?.tipo ?? "equipamento",
    localId: equipamento?.localId ?? null,
    parentItemId: equipamento?.parentItemId ?? "",
    areaId: equipamento?.areaId ?? null,
  });
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  async function salvar() {
    try {
      setSalvando(true);
      setErro(null);
      await onSalvar(dados);
    } catch (error) {
      setErro(error instanceof Error ? error.message : "Não foi possível salvar componente.");
    } finally {
      setSalvando(false);
    }
  }

  function setCampo(campo: keyof EquipamentoFormData, valor: string) {
    setDados((atual) => ({ ...atual, [campo]: valor }));
  }

  return (
    <Modal
      open
      onOpenChange={(open) => {
        if (!open) onCancel();
      }}
      titulo={equipamento ? "Editar componente" : "Novo componente"}
      tamanho="lg"
    >
      <div className="grid max-h-[70vh] grid-cols-1 gap-3 overflow-y-auto md:grid-cols-2">
        <Field label="Nome *" value={dados.nome} onChange={(v) => setCampo("nome", v)} />
        <SeletorCategoria
          value={dados.categoriaId ?? null}
          textoLegado={dados.categoria}
          userId={userId}
          onChange={(categoriaId) => setDados((atual) => ({ ...atual, categoriaId }))}
        />
        {!clienteFixoId && (
          <label className="block">
            <span className="mb-1 block text-caption font-semibold text-ink-3">Cliente *</span>
            <select
              value={dados.clientId ?? ""}
              onChange={(event) =>
                setDados((atual) => ({
                  ...atual,
                  clientId: event.target.value,
                  areaId: null,
                  localId: null,
                }))
              }
              className="input w-full"
            >
              <option value="">Selecione…</option>
              {clientes.map((cliente) => (
                <option key={cliente.id} value={cliente.id}>
                  {cliente.nome}
                  {cliente.auvoId ? ` · Auvo ${cliente.auvoId}` : ""}
                </option>
              ))}
            </select>
          </label>
        )}
        <div className="grid grid-cols-1 gap-3 md:col-span-2 md:grid-cols-2">
          <SeletorPosicao
            clienteId={dados.clientId ?? null}
            areaId={dados.areaId ?? null}
            localId={dados.localId ?? null}
            onChange={({ areaId, localId }) => setDados((atual) => ({ ...atual, areaId, localId }))}
          />
        </div>
        <CampoIdentificador
          modo={equipamento ? "editar" : "criar"}
          input={
            dados.clientId && dados.categoriaId
              ? {
                  clienteId: dados.clientId,
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
              identificador: identificadorManual,
              identificadorManual,
              alterarIdentificador,
            }))
          }
          siglasInformadas={dados.siglasInformadas ?? []}
          onSiglasChange={(siglasInformadas) =>
            setDados((atual) => ({ ...atual, siglasInformadas }))
          }
        />
        <label className="block md:col-span-2">
          <span className="mb-1 block text-caption font-semibold text-ink-3">Observações</span>
          <textarea
            value={dados.observacoes ?? ""}
            onChange={(event) => setCampo("observacoes", event.target.value)}
            className="input min-h-[92px] w-full resize-y"
          />
        </label>
        {erro && (
          <div className="md:col-span-2 rounded-md border border-danger-line bg-danger-soft px-3 py-2 text-body text-danger">
            {erro}
          </div>
        )}
      </div>
      <div className="flex justify-end gap-2 border-t border-line-soft pt-3">
        <Button variant="secondary" onClick={onCancel}>
          Cancelar
        </Button>
        <Button variant="accent" onClick={salvar} disabled={salvando} loading={salvando}>
          {salvando ? "Salvando…" : "Salvar"}
        </Button>
      </div>
    </Modal>
  );
}

function Field({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-caption font-semibold text-ink-3">{label}</span>
      <input
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="input w-full"
      />
    </label>
  );
}

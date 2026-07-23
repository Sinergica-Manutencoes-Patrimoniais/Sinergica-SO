// E01-S79: extraído de EquipamentosPage.tsx pra componente compartilhado — reusado também pelo
// drawer de detalhe do Board (E01-S78), que antes só permitia visualizar, nunca editar.
import { X } from "lucide-react";
import { useEffect, useState } from "react";
import type {
  EquipamentoClienteOpcao,
  EquipamentoFormData,
  EquipamentoItem,
} from "../domain/equipamentos";
import { montarArvore } from "../domain/hierarquia";
import type { LocalArvoreNode } from "../domain/hierarquia";
import { supabaseHierarquiaAdapter } from "../infrastructure/supabase-hierarquia-adapter";

export function EquipamentoModal({
  equipamento,
  clientes,
  equipamentosDisponiveis,
  onCancel,
  onSalvar,
}: {
  equipamento?: EquipamentoItem;
  clientes: EquipamentoClienteOpcao[];
  equipamentosDisponiveis: EquipamentoItem[];
  onCancel: () => void;
  onSalvar: (input: EquipamentoFormData) => Promise<void>;
}) {
  const [dados, setDados] = useState<EquipamentoFormData>({
    nome: equipamento?.nome ?? "",
    identificador: equipamento?.identificador ?? "",
    categoria: equipamento?.categoria ?? "",
    clientId: equipamento?.clientId ?? "",
    localizacao: equipamento?.localizacao ?? "",
    observacoes: equipamento?.observacoes ?? "",
    tipo: equipamento?.tipo ?? "equipamento",
    localId: equipamento?.localId ?? "",
    parentItemId: equipamento?.parentItemId ?? "",
  });
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [locaisDoCliente, setLocaisDoCliente] = useState<LocalArvoreNode[]>([]);

  useEffect(() => {
    if (!dados.clientId) {
      setLocaisDoCliente([]);
      return;
    }
    let cancelado = false;
    supabaseHierarquiaAdapter.listarLocaisDoCliente(dados.clientId).then((locais) => {
      if (!cancelado) setLocaisDoCliente(montarArvore(locais));
    });
    return () => {
      cancelado = true;
    };
  }, [dados.clientId]);

  // AC-5: Componente pode ser filho de um Equipamento do MESMO cliente — lista só equipamentos
  // (não outros componentes) do cliente selecionado, excluindo o próprio item (edição).
  const paisDisponiveis = equipamentosDisponiveis.filter(
    (e) => e.tipo === "equipamento" && e.clientId === dados.clientId && e.id !== equipamento?.id,
  );

  async function salvar() {
    try {
      setSalvando(true);
      setErro(null);
      await onSalvar(dados);
    } catch (error) {
      setErro(error instanceof Error ? error.message : "Não foi possível salvar equipamento.");
    } finally {
      setSalvando(false);
    }
  }

  function setCampo(campo: keyof EquipamentoFormData, valor: string) {
    setDados((atual) => ({ ...atual, [campo]: valor }));
  }

  return (
    <div className="modal-backdrop">
      <div className="w-full max-w-3xl rounded-[8px] border border-line bg-card shadow-xl">
        <div className="flex items-center justify-between border-b border-line px-4 py-3">
          <h3 className="text-base font-semibold text-ink">
            {equipamento ? "Editar equipamento" : "Novo equipamento"}
          </h3>
          <button type="button" onClick={onCancel} className="text-ink-3 hover:text-ink">
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="grid max-h-[70vh] grid-cols-1 gap-3 overflow-y-auto p-4 md:grid-cols-2">
          <Field label="Nome *" value={dados.nome} onChange={(v) => setCampo("nome", v)} />
          <Field
            label="Identificador"
            value={dados.identificador ?? ""}
            onChange={(v) => setCampo("identificador", v)}
          />
          <Field
            label="Categoria"
            value={dados.categoria ?? ""}
            onChange={(v) => setCampo("categoria", v)}
          />
          <label className="block">
            <span className="mb-1 block text-xs font-semibold text-ink-3">Cliente</span>
            <select
              value={dados.clientId ?? ""}
              onChange={(event) => setCampo("clientId", event.target.value)}
              className="input w-full"
            >
              <option value="">Sem vínculo</option>
              {clientes.map((cliente) => (
                <option key={cliente.id} value={cliente.id}>
                  {cliente.nome}
                  {cliente.auvoId ? ` · Auvo ${cliente.auvoId}` : ""}
                </option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className="mb-1 block text-xs font-semibold text-ink-3">Tipo</span>
            <select
              value={dados.tipo ?? "equipamento"}
              onChange={(event) =>
                setDados((atual) => ({
                  ...atual,
                  tipo: event.target.value as EquipamentoFormData["tipo"],
                  // trocar pra "equipamento" limpa o pai — invariante só faz sentido pra componente
                  parentItemId: event.target.value === "componente" ? atual.parentItemId : "",
                }))
              }
              className="input w-full"
            >
              <option value="equipamento">Equipamento</option>
              <option value="componente">Componente</option>
            </select>
          </label>
          <label className="block">
            <span className="mb-1 block text-xs font-semibold text-ink-3">Local (AC-4)</span>
            <select
              value={dados.localId ?? ""}
              onChange={(event) => setCampo("localId", event.target.value)}
              className="input w-full"
              disabled={!dados.clientId}
            >
              <option value="">Sem local</option>
              {flattenArvore(locaisDoCliente).map(({ local, profundidade }) => (
                <option key={local.id} value={local.id}>
                  {"— ".repeat(profundidade)}
                  {local.nome}
                </option>
              ))}
            </select>
          </label>
          {dados.tipo === "componente" && (
            <label className="block">
              <span className="mb-1 block text-xs font-semibold text-ink-3">
                Equipamento pai (AC-5)
              </span>
              <select
                value={dados.parentItemId ?? ""}
                onChange={(event) => setCampo("parentItemId", event.target.value)}
                className="input w-full"
                disabled={!dados.clientId}
              >
                <option value="">Nenhum</option>
                {paisDisponiveis.map((pai) => (
                  <option key={pai.id} value={pai.id}>
                    {pai.nome}
                  </option>
                ))}
              </select>
            </label>
          )}
          <label className="block md:col-span-2">
            <span className="mb-1 block text-xs font-semibold text-ink-3">Observações</span>
            <textarea
              value={dados.observacoes ?? ""}
              onChange={(event) => setCampo("observacoes", event.target.value)}
              className="input min-h-[92px] w-full resize-y"
            />
          </label>
          {erro && (
            <div className="md:col-span-2 rounded-[6px] border border-[#F2C0B5] bg-[#FFF4F1] px-3 py-2 text-sm text-[#A23B25]">
              {erro}
            </div>
          )}
        </div>
        <div className="flex justify-end gap-2 border-t border-line px-4 py-3">
          <button
            type="button"
            onClick={onCancel}
            className="h-9 rounded-[6px] border border-line px-3 text-sm font-semibold text-ink-2 hover:bg-line-soft"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={salvar}
            disabled={salvando}
            className="h-9 rounded-[6px] bg-orange px-3 text-sm font-semibold text-white hover:bg-orange-deep disabled:opacity-50"
          >
            {salvando ? "Salvando..." : "Salvar"}
          </button>
        </div>
      </div>
    </div>
  );
}

function flattenArvore(
  nodes: LocalArvoreNode[],
  profundidade = 0,
): Array<{ local: LocalArvoreNode; profundidade: number }> {
  return nodes.flatMap((node) => [
    { local: node, profundidade },
    ...flattenArvore(node.filhos, profundidade + 1),
  ]);
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
      <span className="mb-1 block text-xs font-semibold text-ink-3">{label}</span>
      <input
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="input w-full"
      />
    </label>
  );
}

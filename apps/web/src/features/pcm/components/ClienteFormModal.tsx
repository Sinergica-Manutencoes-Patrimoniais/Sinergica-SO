import { X } from "lucide-react";
import { useState } from "react";
import type { ClienteFormData } from "../application/cliente-360-gateway";

/** E01-S50: extraído de `ListaClientesPage.tsx` pra ser reaproveitado também na edição direto na
 * Visão 360 do cliente — mesmo formulário/validação, dois pontos de entrada. */
interface ClienteFormPrefill {
  nome: string;
  cnpj?: string | null;
  endereco?: string | null;
  cidade?: string | null;
  estado?: string | null;
  cep?: string | null;
  contatoNome?: string | null;
  contatoTelefone?: string | null;
  contatoEmail?: string | null;
  observacoes?: string | null;
  ativo?: boolean;
  tipo?: "cliente" | "lead";
  statusComercial?: "ativo" | "inativo" | "prospecto";
}

export function ClienteFormModal({
  cliente,
  onCancel,
  onSalvar,
}: {
  cliente?: ClienteFormPrefill;
  onCancel: () => void;
  onSalvar: (dados: ClienteFormData) => Promise<void>;
}) {
  const ehEdicao = Boolean(cliente);
  const [dados, setDados] = useState<ClienteFormData>({
    nome: cliente?.nome ?? "",
    cnpj: cliente?.cnpj ?? "",
    endereco: cliente?.endereco ?? "",
    cidade: cliente?.cidade ?? "",
    estado: cliente?.estado ?? "",
    cep: cliente?.cep ?? "",
    contatoNome: cliente?.contatoNome ?? "",
    contatoTelefone: cliente?.contatoTelefone ?? "",
    contatoEmail: cliente?.contatoEmail ?? "",
    observacoes: cliente?.observacoes ?? "",
    ativo: cliente?.ativo ?? true,
    tipo: cliente?.tipo ?? "cliente",
    statusComercial: cliente?.statusComercial ?? "ativo",
  });
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  async function salvar() {
    try {
      setSalvando(true);
      setErro(null);
      await onSalvar(dados);
    } catch (error) {
      setErro(error instanceof Error ? error.message : "Não foi possível salvar o cliente.");
    } finally {
      setSalvando(false);
    }
  }

  function setCampo(campo: keyof ClienteFormData, valor: string) {
    setDados((atual) => ({ ...atual, [campo]: valor }));
  }

  return (
    <div className="modal-backdrop">
      <div className="w-full max-w-3xl rounded-lg border border-line bg-card shadow-modal">
        <div className="flex items-center justify-between border-b border-line px-5 py-4">
          <h3 className="text-base font-semibold text-ink">
            {cliente ? "Editar cliente" : "Novo cliente"}
          </h3>
          <button type="button" onClick={onCancel} className="text-ink-3 hover:text-ink">
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="grid max-h-[70vh] grid-cols-1 gap-3 overflow-y-auto p-5 md:grid-cols-2">
          <Field label="Nome *" value={dados.nome} onChange={(v) => setCampo("nome", v)} />
          <Field label="CNPJ/CPF" value={dados.cnpj ?? ""} onChange={(v) => setCampo("cnpj", v)} />
          <Field
            label="Endereço"
            value={dados.endereco ?? ""}
            onChange={(v) => setCampo("endereco", v)}
            className="md:col-span-2"
          />
          <Field
            label="Cidade"
            value={dados.cidade ?? ""}
            onChange={(v) => setCampo("cidade", v)}
          />
          <Field
            label="Estado"
            value={dados.estado ?? ""}
            onChange={(v) => setCampo("estado", v)}
          />
          <Field label="CEP" value={dados.cep ?? ""} onChange={(v) => setCampo("cep", v)} />
          <Field
            label="Contato"
            value={dados.contatoNome ?? ""}
            onChange={(v) => setCampo("contatoNome", v)}
          />
          <Field
            label="Telefone"
            value={dados.contatoTelefone ?? ""}
            onChange={(v) => setCampo("contatoTelefone", v)}
          />
          <Field
            label="E-mail"
            value={dados.contatoEmail ?? ""}
            onChange={(v) => setCampo("contatoEmail", v)}
          />
          {ehEdicao && (
            <>
              <label className="block">
                <span className="mb-1 block text-xs font-semibold text-ink-3">Status</span>
                <select
                  value={dados.statusComercial ?? "ativo"}
                  onChange={(event) =>
                    setDados((atual) => ({
                      ...atual,
                      statusComercial: event.target.value as ClienteFormData["statusComercial"],
                    }))
                  }
                  className="input w-full"
                >
                  <option value="ativo">Ativo</option>
                  <option value="inativo">Inativo</option>
                  <option value="prospecto">Prospecto</option>
                </select>
              </label>
              <label className="flex items-center gap-2 pt-5">
                <input
                  type="checkbox"
                  checked={dados.ativo ?? true}
                  onChange={(event) =>
                    setDados((atual) => ({ ...atual, ativo: event.target.checked }))
                  }
                  className="h-4 w-4 accent-orange"
                />
                <span className="text-xs font-semibold text-ink-3">Cliente ativo (operação)</span>
              </label>
            </>
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
            <div className="md:col-span-2 rounded-md border border-danger-line bg-danger-soft px-3 py-2 text-sm text-danger">
              {erro}
            </div>
          )}
        </div>
        <div className="flex justify-end gap-2 border-t border-line px-5 py-4">
          <button
            type="button"
            onClick={onCancel}
            className="h-9 rounded-md border border-line px-3 text-sm font-semibold text-ink-2 hover:bg-line-soft"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={salvar}
            disabled={salvando}
            className="h-9 rounded-md bg-orange px-3 text-sm font-semibold text-white hover:bg-orange-deep disabled:opacity-50"
          >
            {salvando ? "Salvando…" : "Salvar"}
          </button>
        </div>
      </div>
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  className = "",
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  className?: string;
}) {
  return (
    <label className={`block ${className}`}>
      <span className="mb-1 block text-xs font-semibold text-ink-3">{label}</span>
      <input
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="input w-full"
      />
    </label>
  );
}

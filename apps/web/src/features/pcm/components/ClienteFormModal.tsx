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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/35 p-4">
      <div className="w-full max-w-3xl rounded-[8px] border border-line bg-card shadow-xl">
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
        <div className="flex justify-end gap-2 border-t border-line px-5 py-4">
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

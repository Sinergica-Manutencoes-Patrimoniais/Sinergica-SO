import { Tooltip } from "@sinergica/ui";
// AC-2: dados do cadastro Auvo apresentados no contexto do Cliente 360. A faixa preserva todos
// os campos relevantes sem repetir “Cliente / Ativo / ativo” como fazia o card anterior.
import { Building2, Link2, Mail, MapPin, Phone } from "lucide-react";
import type { ComponentType } from "react";
import type { ClienteHeader } from "../application/cliente-360-gateway";
import { rotuloOuPlaceholder } from "../domain/cliente-360";
import { TOOLTIP_CLIENTE } from "../domain/tooltips-cliente";

export function CabecalhoCliente({ cliente }: { cliente: ClienteHeader }) {
  const endereco = [cliente.endereco, cliente.cidade, cliente.estado].filter(Boolean).join(" — ");
  const cidade = [cliente.cidade, cliente.estado].filter(Boolean).join(" — ");
  const situacao = rotuloSituacao(cliente);

  return (
    <header
      aria-label="Contexto do cliente"
      className="flex flex-wrap items-center gap-x-5 gap-y-2 border-y border-line-soft bg-paper/35 px-4 py-3 xl:flex-nowrap"
    >
      <div className="flex min-w-0 items-center gap-2 xl:shrink-0">
        <h1 className="truncate text-heading font-semibold tracking-tight text-ink">
          {cliente.nome}
        </h1>
        <Tooltip content={TOOLTIP_CLIENTE.status} className="inline-flex shrink-0">
          <span
            className={`rounded-full px-2 py-0.5 text-micro font-medium ${
              cliente.ativo ? "bg-success-soft text-success" : "bg-line-soft text-ink-3"
            }`}
          >
            {situacao}
          </span>
        </Tooltip>
      </div>

      <ContextoItem
        icon={MapPin}
        label="Endereço"
        value={endereco || "Endereço ainda não sincronizado"}
        className="min-w-52 flex-1 xl:max-w-xl"
      />
      <ContextoItem
        icon={Building2}
        label="CNPJ"
        value={rotuloOuPlaceholder(cliente.cnpj, "CNPJ não informado")}
        className="shrink-0"
      />
      <ContextoItem
        icon={Building2}
        label="Cidade"
        value={cidade || "Cidade não informada"}
        className="shrink-0"
      />

      {(cliente.contatoNome || cliente.contatoTelefone || cliente.contatoEmail) && (
        <div className="flex min-w-0 items-center gap-2 text-caption text-ink-3 xl:max-w-sm">
          <Phone className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
          <span className="sr-only">Contato</span>
          <span className="truncate" title={cliente.contatoNome ?? undefined}>
            {cliente.contatoNome ?? "Contato"}
          </span>
          {cliente.contatoTelefone && (
            <a
              className="hidden shrink-0 hover:text-orange xl:inline"
              href={`tel:${cliente.contatoTelefone}`}
            >
              {cliente.contatoTelefone}
            </a>
          )}
          {cliente.contatoEmail && (
            <a
              className="hidden truncate hover:text-orange xl:inline"
              href={`mailto:${cliente.contatoEmail}`}
            >
              {cliente.contatoEmail}
            </a>
          )}
        </div>
      )}

      <Tooltip content={TOOLTIP_CLIENTE.auvo} className="inline-flex shrink-0">
        <span className="inline-flex items-center gap-1.5 text-caption text-ink-3">
          <Link2 className="h-3.5 w-3.5" aria-hidden="true" />
          <span className="text-micro font-medium uppercase tracking-wide">Auvo</span>
          <span className="font-brand tabular-nums text-ink-2">
            {rotuloOuPlaceholder(cliente.auvoId, "não sincronizado")}
          </span>
        </span>
      </Tooltip>
      {cliente.cep && (
        <span className="hidden text-caption text-ink-3 2xl:inline">CEP {cliente.cep}</span>
      )}
      {cliente.contatoEmail && (
        <Mail className="sr-only" aria-label={`E-mail ${cliente.contatoEmail}`} />
      )}
    </header>
  );
}

function ContextoItem({
  icon: Icon,
  label,
  value,
  className = "",
}: {
  icon: ComponentType<{ className?: string; "aria-hidden"?: boolean }>;
  label: string;
  value: string;
  className?: string;
}) {
  return (
    <div className={`flex min-w-0 items-center gap-1.5 text-caption text-ink-3 ${className}`}>
      <Icon className="h-3.5 w-3.5 shrink-0" aria-hidden />
      <span className="sr-only">{label}</span>
      <span className="truncate" title={value}>
        {value}
      </span>
    </div>
  );
}

function rotuloSituacao(cliente: ClienteHeader): string {
  if (cliente.tipo === "lead") return "Lead";
  if (!cliente.ativo) return "Inativo";
  if (cliente.statusComercial === "prospecto") return "Prospecto";
  return "Ativo";
}

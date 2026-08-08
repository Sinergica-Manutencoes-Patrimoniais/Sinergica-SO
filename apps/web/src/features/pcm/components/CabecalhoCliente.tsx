import { Tooltip } from "@sinergica/ui";
// AC-2: cabeçalho de cadastro do cliente. Cadastro incompleto (cnpj/auvo_id nulos) usa rótulo
// neutro via rotuloOuPlaceholder — nunca quebra a renderização.
import { Mail, MapPin, Phone } from "lucide-react";
import type { ClienteHeader } from "../application/cliente-360-gateway";
import { rotuloOuPlaceholder } from "../domain/cliente-360";
import { TOOLTIP_CLIENTE } from "../domain/tooltips-cliente";

export function CabecalhoCliente({ cliente }: { cliente: ClienteHeader }) {
  const local = [cliente.endereco, cliente.cidade, cliente.estado].filter(Boolean).join(" — ");
  const contato = cliente.contatoNome ?? cliente.contatoTelefone ?? cliente.contatoEmail;

  return (
    <div className="rounded-lg bg-navy text-white p-5 md:p-6 shadow-raised">
      <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
        <div className="min-w-0">
          <h1 className="text-2xl font-bold truncate">{cliente.nome}</h1>
          <p className="mt-1 flex items-center gap-2 text-sm text-white/75">
            <MapPin className="h-4 w-4 shrink-0" />
            <span className="truncate">{local || "Endereço ainda não sincronizado"}</span>
          </p>
          <div className="mt-3 flex flex-wrap items-center gap-2 text-xs">
            <Tooltip content={TOOLTIP_CLIENTE.tipo} className="inline-flex">
              <button
                type="button"
                className="appearance-none rounded-full border-0 bg-card/12 px-2.5 py-1 font-semibold text-inherit"
              >
                {cliente.tipo === "lead" ? "Lead" : "Cliente"}
              </button>
            </Tooltip>
            <Tooltip content={TOOLTIP_CLIENTE.status} className="inline-flex">
              <button
                type="button"
                className={`appearance-none rounded-full border-0 px-2.5 py-1 font-semibold text-inherit ${
                  cliente.ativo ? "bg-success/25 text-success-line" : "bg-card/12 text-white/70"
                }`}
              >
                {cliente.ativo ? "Ativo" : "Inativo"}
              </button>
            </Tooltip>
            {cliente.statusComercial && (
              <Tooltip content={TOOLTIP_CLIENTE.statusComercial} className="inline-flex">
                <button
                  type="button"
                  className="appearance-none rounded-full border-0 bg-card/12 px-2.5 py-1 font-semibold text-inherit"
                >
                  {cliente.statusComercial}
                </button>
              </Tooltip>
            )}
            {cliente.marcacao && (
              <Tooltip content={TOOLTIP_CLIENTE.marcacao} className="inline-flex">
                <button
                  type="button"
                  className="appearance-none rounded-full border-0 px-2.5 py-1 font-semibold text-white"
                  style={{ backgroundColor: cliente.marcacao.cor }}
                >
                  {cliente.marcacao.nome}
                </button>
              </Tooltip>
            )}
          </div>
        </div>
        <Tooltip content={TOOLTIP_CLIENTE.auvo} className="inline-flex">
          <button
            type="button"
            className="shrink-0 appearance-none rounded-lg border-0 bg-card/10 px-4 py-3 text-left text-sm text-inherit"
          >
            <p className="text-micro font-semibold uppercase tracking-wider text-white/55">Auvo</p>
            <p className="mt-1 font-brand text-lg tabular-nums">
              {rotuloOuPlaceholder(cliente.auvoId, "não sincronizado")}
            </p>
          </button>
        </Tooltip>
      </div>

      <div className="mt-6 grid grid-cols-1 md:grid-cols-4 gap-4">
        <Info label="CNPJ" value={rotuloOuPlaceholder(cliente.cnpj, "—")} />
        <Info label="Contato" value={contato ?? "Sem contato"} />
        <Info
          label="Cidade"
          value={[cliente.cidade, cliente.estado].filter(Boolean).join(" — ") || "—"}
        />
        <Info label="CEP" value={cliente.cep ?? "—"} />
      </div>

      {(cliente.contatoTelefone || cliente.contatoEmail) && (
        <div className="mt-4 flex flex-wrap gap-3 text-sm text-white/75">
          {cliente.contatoTelefone && (
            <span className="inline-flex items-center gap-2">
              <Phone className="h-4 w-4" />
              {cliente.contatoTelefone}
            </span>
          )}
          {cliente.contatoEmail && (
            <span className="inline-flex items-center gap-2">
              <Mail className="h-4 w-4" />
              {cliente.contatoEmail}
            </span>
          )}
        </div>
      )}
    </div>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-micro font-semibold uppercase tracking-wider text-white/45">{label}</p>
      <p className="mt-1 truncate text-sm font-semibold text-white">{value}</p>
    </div>
  );
}

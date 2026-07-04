// AC-2: cabeçalho de cadastro do cliente. Cadastro incompleto (cnpj/auvo_id nulos) usa rótulo
// neutro via rotuloOuPlaceholder — nunca quebra a renderização.
import type { ClienteHeader } from "../application/cliente-360-gateway";
import { rotuloOuPlaceholder } from "../domain/cliente-360";

export function CabecalhoCliente({ cliente }: { cliente: ClienteHeader }) {
  return (
    <div className="bg-card rounded-[10px] border border-line p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-lg font-bold text-ink truncate">{cliente.nome}</h1>
          <p className="text-sm text-ink-3 mt-0.5">
            CNPJ: <span className="tabular-nums">{rotuloOuPlaceholder(cliente.cnpj, "—")}</span>
          </p>
        </div>
        <span
          className={`shrink-0 inline-flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider rounded-full px-2.5 py-1 ${
            cliente.ativo ? "bg-[#E7F6EC] text-[#1E8E45]" : "bg-[#EFF1F4] text-[#5A6175]"
          }`}
        >
          <span
            className={`w-1.5 h-1.5 rounded-full ${cliente.ativo ? "bg-[#1E8E45]" : "bg-[#8A90A0]"}`}
          />
          {cliente.ativo ? "Ativo" : "Inativo"}
        </span>
      </div>
      <div className="mt-3 pt-3 border-t border-line-soft flex items-center gap-2 text-xs text-ink-3">
        <span className="font-semibold uppercase tracking-wider text-[10px]">Auvo</span>
        <span className="tabular-nums">
          {rotuloOuPlaceholder(cliente.auvoId, "não sincronizado")}
        </span>
      </div>
    </div>
  );
}

import { Building2, Mail, MapPin, Phone, Search } from "lucide-react";
// Lista mínima de clientes do PCM (Task 18/E01-S12) — ponto de entrada de navegação até a Visão
// 360. Escopo enxuto (decisão de produto do Lucas: lista mínima no mesmo PR, não esperar o Hub de
// OS/E01-S07): nome + CNPJ + status ativo, cada linha clicável abre a Visão 360 do cliente. Sem
// busca/filtro/paginação nesta v1 (fora de escopo). Mesmo gate AC-1 (leitura no módulo pcm) e mesmo
// padrão read-only da VisaoClientePage — a única ação é NAVEGAR (selecionar um cliente), nunca mutar.
import { useCallback, useEffect, useState } from "react";
import { usePermissoes } from "../../../app/permissoes-context";
import type { ClienteResumo } from "../application/cliente-360-gateway";
import { listarClientes } from "../application/listar-clientes";
import { rotuloOuPlaceholder } from "../domain/cliente-360";
import { supabaseCliente360Adapter } from "../infrastructure/supabase-cliente-360-adapter";

type Estado =
  | { fase: "carregando" }
  | { fase: "erro" }
  | { fase: "pronto"; clientes: ClienteResumo[] };

export function ListaClientesPage({
  onSelecionar,
}: {
  onSelecionar: (clienteId: string) => void;
}) {
  const { carregando: permissoesCarregando, podeAcessar } = usePermissoes();
  const [estado, setEstado] = useState<Estado>({ fase: "carregando" });
  const [busca, setBusca] = useState("");

  // Mesmo gate da Visão 360 (AC-1): sem leitura no módulo pcm, a lista não é acessível. A RLS de
  // pcm.clientes já garante isso no banco; este é o espelho de UI (sem permissão nova).
  const temAcesso = podeAcessar("pcm", "leitura");

  const carregar = useCallback(async () => {
    setEstado({ fase: "carregando" });
    try {
      const clientes = await listarClientes(supabaseCliente360Adapter);
      setEstado({ fase: "pronto", clientes });
    } catch {
      setEstado({ fase: "erro" });
    }
  }, []);

  useEffect(() => {
    if (!permissoesCarregando && temAcesso) carregar();
  }, [permissoesCarregando, temAcesso, carregar]);

  if (permissoesCarregando) {
    return <div className="p-8 text-center text-sm text-ink-3">Carregando…</div>;
  }

  if (!temAcesso) {
    return (
      <div className="p-12 text-center">
        <h2 className="text-lg font-semibold text-ink-2">Acesso restrito</h2>
        <p className="text-sm text-ink-3 mt-1">
          Você não tem permissão de leitura no módulo PCM para ver esta tela.
        </p>
      </div>
    );
  }

  if (estado.fase === "carregando") {
    return <div className="p-8 text-center text-sm text-ink-3">Carregando…</div>;
  }

  if (estado.fase === "erro") {
    return (
      <div className="p-12 text-center">
        <h2 className="text-lg font-semibold text-ink-2">Algo deu errado</h2>
        <p className="text-sm text-ink-3 mt-1">Não foi possível carregar a lista de clientes.</p>
        <button
          type="button"
          onClick={carregar}
          className="mt-4 text-sm font-semibold text-orange hover:text-orange-deep cursor-pointer"
        >
          Tentar novamente
        </button>
      </div>
    );
  }

  const termo = busca.trim().toLowerCase();
  const clientesFiltrados =
    estado.fase === "pronto"
      ? estado.clientes.filter((cliente) => {
          if (!termo) return true;
          return [
            cliente.nome,
            cliente.cnpj,
            cliente.cidade,
            cliente.estado,
            cliente.contatoTelefone,
            cliente.contatoEmail,
            cliente.auvoId ? String(cliente.auvoId) : null,
          ]
            .filter(Boolean)
            .some((valor) => String(valor).toLowerCase().includes(termo));
        })
      : [];

  return (
    <div className="flex flex-col gap-4">
      <div className="rounded-[8px] border border-line bg-card p-5">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <h3 className="text-lg font-semibold text-ink">Clientes</h3>
            <p className="text-sm text-ink-3 mt-0.5">
              {estado.clientes.length} cadastro(s) sincronizados via Auvo
            </p>
          </div>
          <div className="relative w-full md:w-[340px]">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-3" />
            <input
              value={busca}
              onChange={(event) => setBusca(event.target.value)}
              className="input w-full pl-9"
              placeholder="Buscar cliente, cidade, contato ou ID Auvo"
            />
          </div>
        </div>
      </div>

      {estado.clientes.length === 0 ? (
        <div className="rounded-[8px] border border-line bg-card px-5 py-10 text-center">
          <Building2 className="mx-auto h-9 w-9 text-ink-3" />
          <p className="mt-3 text-sm text-ink-3">Nenhum cliente cadastrado</p>
        </div>
      ) : clientesFiltrados.length === 0 ? (
        <div className="rounded-[8px] border border-line bg-card px-5 py-10 text-center text-sm text-ink-3">
          Nenhum cliente encontrado para a busca.
        </div>
      ) : (
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-3">
          {clientesFiltrados.map((cliente) => (
            <button
              key={cliente.id}
              type="button"
              onClick={() => onSelecionar(cliente.id)}
              className="rounded-[8px] border border-line bg-card p-4 text-left transition-colors hover:border-orange/60 hover:bg-orange-soft/30"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <p className="truncate text-sm font-semibold text-ink">{cliente.nome}</p>
                    <span
                      className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                        cliente.ativo
                          ? "bg-[#E7F6EC] text-[#1E8E45]"
                          : "bg-[#EFF1F4] text-[#5A6175]"
                      }`}
                    >
                      {cliente.ativo ? "Ativo" : "Inativo"}
                    </span>
                  </div>
                  <p className="mt-1 text-xs tabular-nums text-ink-3">
                    CNPJ: {rotuloOuPlaceholder(cliente.cnpj, "—")} · Auvo{" "}
                    {rotuloOuPlaceholder(cliente.auvoId ?? null, "—")}
                  </p>
                </div>
              </div>

              <div className="mt-3 flex flex-wrap gap-x-4 gap-y-2 text-xs text-ink-3">
                {(cliente.cidade || cliente.estado) && (
                  <span className="inline-flex items-center gap-1">
                    <MapPin className="h-3.5 w-3.5" />
                    {[cliente.cidade, cliente.estado].filter(Boolean).join(" — ")}
                  </span>
                )}
                {cliente.contatoTelefone && (
                  <span className="inline-flex items-center gap-1">
                    <Phone className="h-3.5 w-3.5" />
                    {cliente.contatoTelefone}
                  </span>
                )}
                {cliente.contatoEmail && (
                  <span className="inline-flex items-center gap-1">
                    <Mail className="h-3.5 w-3.5" />
                    {cliente.contatoEmail}
                  </span>
                )}
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

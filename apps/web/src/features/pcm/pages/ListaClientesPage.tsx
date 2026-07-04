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

  return (
    <div className="bg-card rounded-[10px] border border-line">
      <div className="px-5 py-4 border-b border-line-soft">
        <h3 className="text-sm font-semibold text-ink">Clientes</h3>
        <p className="text-xs text-ink-3 mt-0.5">Selecione um cliente para ver a Visão 360</p>
      </div>

      {estado.clientes.length === 0 ? (
        <div className="px-5 py-8 text-center text-sm text-ink-3">Nenhum cliente cadastrado</div>
      ) : (
        <div className="divide-y divide-line-soft">
          {estado.clientes.map((cliente) => (
            <button
              key={cliente.id}
              type="button"
              onClick={() => onSelecionar(cliente.id)}
              className="w-full px-5 py-3.5 flex items-center gap-3 text-left hover:bg-line-soft transition-colors cursor-pointer"
            >
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-ink truncate">{cliente.nome}</p>
                <p className="text-xs text-ink-3 truncate tabular-nums">
                  CNPJ: {rotuloOuPlaceholder(cliente.cnpj, "—")}
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
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

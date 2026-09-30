import { Button, Skeleton } from "@sinergica/ui";
import { useState } from "react";
import { useAuth } from "../../../app/auth-context";
import { useFormularioSujo } from "../../../app/use-formulario-sujo";
import {
  useAlocarFerramenta,
  useDevolverFerramenta,
  useFerramentasAlocadas,
  useFerramentasDisponiveis,
} from "../application/ativos-cliente-queries";
import { supabaseFerramentaAlocacaoClienteAdapter } from "../infrastructure/supabase-ferramenta-alocacao-cliente-adapter";

/** Ferramentas são patrimônio da Sinérgica: alocação temporária, nunca Componente do cliente. */
export function PainelFerramentasCliente({
  clienteId,
  temEscrita,
}: {
  clienteId: string;
  temEscrita: boolean;
}) {
  const { user } = useAuth();
  const [alocando, setAlocando] = useState(false);
  const alocacoes = useFerramentasAlocadas(supabaseFerramentaAlocacaoClienteAdapter, clienteId);
  const devolver = useDevolverFerramenta(supabaseFerramentaAlocacaoClienteAdapter, clienteId);

  if (alocacoes.isLoading) return <Skeleton className="h-24 w-full" />;
  if (alocacoes.error) {
    return (
      <div className="rounded-lg border border-danger-line bg-danger-soft px-5 py-6 text-body text-danger">
        {alocacoes.error instanceof Error
          ? alocacoes.error.message
          : "Não foi possível carregar ferramentas alocadas."}
        <Button
          variant="secondary"
          size="sm"
          className="ml-3"
          onClick={() => void alocacoes.refetch()}
        >
          Tentar de novo
        </Button>
      </div>
    );
  }

  const ativas = (alocacoes.data ?? []).filter((alocacao) => alocacao.devolvidaEm === null);
  const historico = (alocacoes.data ?? []).filter((alocacao) => alocacao.devolvidaEm !== null);
  return (
    <section className="rounded-lg border border-line bg-card">
      <div className="flex items-center justify-between gap-3 border-b border-line-soft px-4 py-3">
        <div>
          <h3 className="text-body font-semibold text-ink">Ferramentas alocadas</h3>
          <p className="mt-0.5 text-caption text-ink-3">
            Ferramentas da Sinérgica emprestadas/em uso neste cliente
          </p>
        </div>
        {temEscrita && (
          <Button size="sm" onClick={() => setAlocando(true)}>
            Alocar ferramenta
          </Button>
        )}
      </div>
      {ativas.length === 0 && historico.length === 0 ? (
        <div className="px-5 py-6 text-center text-body text-ink-3">
          Nenhuma ferramenta alocada.
        </div>
      ) : (
        <div className="divide-y divide-line-soft">
          {ativas.map((alocacao) => (
            <div key={alocacao.id} className="flex items-center justify-between gap-3 px-5 py-3">
              <div className="min-w-0">
                <p className="truncate text-body font-medium text-ink">{alocacao.ferramentaNome}</p>
                <p className="mt-0.5 text-caption text-ink-3">
                  Alocada em {new Date(alocacao.alocadaEm).toLocaleDateString("pt-BR")}
                </p>
              </div>
              {temEscrita && user && (
                <Button
                  variant="ghost"
                  size="sm"
                  loading={devolver.isPending}
                  onClick={() =>
                    void devolver.mutateAsync({ alocacaoId: alocacao.id, userId: user.id })
                  }
                >
                  Devolver
                </Button>
              )}
            </div>
          ))}
          {historico.slice(0, 5).map((alocacao) => (
            <div key={alocacao.id} className="px-5 py-3 opacity-60">
              <p className="truncate text-body text-ink-2">{alocacao.ferramentaNome}</p>
              <p className="mt-0.5 text-caption text-ink-3">
                {new Date(alocacao.alocadaEm).toLocaleDateString("pt-BR")} até{" "}
                {alocacao.devolvidaEm && new Date(alocacao.devolvidaEm).toLocaleDateString("pt-BR")}
              </p>
            </div>
          ))}
        </div>
      )}
      {alocando && (
        <AlocarFerramentaModal clienteId={clienteId} onCancel={() => setAlocando(false)} />
      )}
    </section>
  );
}

function AlocarFerramentaModal({
  clienteId,
  onCancel,
}: { clienteId: string; onCancel: () => void }) {
  const { user } = useAuth();
  const opcoes = useFerramentasDisponiveis(supabaseFerramentaAlocacaoClienteAdapter);
  const alocar = useAlocarFerramenta(supabaseFerramentaAlocacaoClienteAdapter, clienteId);
  const [ferramentaId, setFerramentaId] = useState("");
  const inicial = opcoes.data?.[0]?.id ?? "";
  useFormularioSujo({ ferramentaId: inicial }, { ferramentaId }, opcoes.isLoading);

  async function confirmar() {
    const selecionada = ferramentaId || inicial;
    if (!user || !selecionada) return;
    await alocar.mutateAsync({ ferramentaId: selecionada, userId: user.id });
    onCancel();
  }

  return (
    <dialog open className="fixed inset-0 z-50 grid place-items-center bg-black/45 p-4">
      <div className="w-full max-w-md rounded-xl bg-card p-6 shadow-modal">
        <h2 className="text-lg font-semibold text-ink">Alocar ferramenta</h2>
        <div className="mt-4">
          {opcoes.isLoading ? (
            <Skeleton className="h-4 w-40" />
          ) : opcoes.error ? (
            <p className="text-body text-danger">
              Não foi possível carregar ferramentas disponíveis.
            </p>
          ) : (opcoes.data ?? []).length === 0 ? (
            <p className="text-body text-ink-3">
              Nenhuma ferramenta disponível (todas já estão alocadas em algum cliente).
            </p>
          ) : (
            <label className="text-body text-ink-2">
              Ferramenta
              <select
                value={ferramentaId || inicial}
                onChange={(event) => setFerramentaId(event.target.value)}
                className="input mt-1 w-full"
              >
                {(opcoes.data ?? []).map((opcao) => (
                  <option key={opcao.id} value={opcao.id}>
                    {opcao.nome}
                  </option>
                ))}
              </select>
            </label>
          )}
          {alocar.error && <p className="mt-3 text-caption text-danger">{alocar.error.message}</p>}
        </div>
        <div className="mt-6 flex justify-end gap-2">
          <Button variant="secondary" onClick={onCancel}>
            Cancelar
          </Button>
          <Button
            variant="accent"
            loading={alocar.isPending}
            disabled={!ferramentaId && !inicial}
            onClick={() => void confirmar()}
          >
            Alocar
          </Button>
        </div>
      </div>
    </dialog>
  );
}

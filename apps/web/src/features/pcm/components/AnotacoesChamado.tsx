import { Skeleton } from "@sinergica/ui";
import { useCallback, useEffect, useState } from "react";
import { useAuth } from "../../../app/auth-context";
import { adicionarAnotacaoChamado, listarAnotacoesChamado } from "../application/chamados";
import type { ChamadosGateway } from "../application/chamados-gateway";
import type { AnotacaoChamado } from "../domain/chamados";

export function AnotacoesChamado({
  chamadoId,
  gateway,
  podeAdicionar,
}: {
  chamadoId: string;
  gateway: ChamadosGateway;
  podeAdicionar: boolean;
}) {
  const { user } = useAuth();
  const [anotacoes, setAnotacoes] = useState<AnotacaoChamado[]>([]);
  const [texto, setTexto] = useState("");
  const [carregando, setCarregando] = useState(true);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const carregar = useCallback(async () => {
    setCarregando(true);
    setErro(null);
    try {
      setAnotacoes(await listarAnotacoesChamado(gateway, chamadoId));
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Não foi possível carregar as anotações.");
    } finally {
      setCarregando(false);
    }
  }, [chamadoId, gateway]);

  useEffect(() => {
    carregar();
  }, [carregar]);

  async function adicionar() {
    if (!user || !texto.trim()) return;
    setSalvando(true);
    setErro(null);
    try {
      const anotacao = await adicionarAnotacaoChamado(gateway, chamadoId, texto, user.id);
      setAnotacoes((atual) => [anotacao, ...atual]);
      setTexto("");
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Não foi possível salvar a anotação.");
    } finally {
      setSalvando(false);
    }
  }

  return (
    <section aria-label="Anotações" className="flex flex-col gap-3">
      <h3 className="text-caption font-semibold uppercase tracking-wider text-ink-3">Anotações</h3>
      {podeAdicionar && (
        <div className="flex flex-col gap-2">
          <label htmlFor={`anotacao-${chamadoId}`} className="sr-only">
            Nova anotação
          </label>
          <textarea
            id={`anotacao-${chamadoId}`}
            value={texto}
            maxLength={5000}
            onChange={(event) => setTexto(event.target.value)}
            placeholder="Registre uma anotação interna"
            className="input min-h-20 w-full resize-y"
          />
          <div className="flex justify-end">
            <button
              type="button"
              disabled={salvando || !texto.trim()}
              onClick={adicionar}
              className="h-8 rounded-md bg-navy px-3 text-caption font-semibold text-white hover:bg-navy-deep disabled:opacity-50"
            >
              {salvando ? "Salvando…" : "Adicionar anotação"}
            </button>
          </div>
        </div>
      )}
      {carregando ? (
        <Skeleton className="h-4 w-40" />
      ) : anotacoes.length === 0 ? (
        <p className="text-body text-ink-3">Nenhuma anotação ainda.</p>
      ) : (
        <ol className="flex flex-col gap-2">
          {anotacoes.map((anotacao) => (
            <li key={anotacao.id} className="rounded-md border border-line-soft bg-card px-3 py-2">
              <p className="whitespace-pre-wrap text-body text-ink-2">{anotacao.texto}</p>
              <p className="mt-1 text-caption text-ink-3">
                {anotacao.autorNome} · {new Date(anotacao.createdAt).toLocaleString("pt-BR")}
              </p>
            </li>
          ))}
        </ol>
      )}
      {erro && <p className="text-caption text-danger">{erro}</p>}
    </section>
  );
}

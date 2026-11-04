import { Button } from "@sinergica/ui";
import { useQuery } from "@tanstack/react-query";
import { useRef, useState } from "react";
import { validarPlanoRascunho } from "../../application/plano-manutencao";
import type { PlanoResumo, SalvarPlanoCommand } from "../../application/plano-manutencao-gateway";
import { usePlanosManutencao } from "../../application/plano-manutencao-queries";
import { supabaseCapacidadesSsoAdapter } from "../../infrastructure/supabase-capacidades-sso-adapter";
import { supabasePlanoManutencaoAdapter } from "../../infrastructure/supabase-plano-manutencao-adapter";
import { supabase } from "../../../../lib/supabase-client";
import { AcoesRevisaoPlano } from "./AcoesRevisaoPlano";
import { DetalhePlano } from "./DetalhePlano";
import { TransicaoPlano } from "./TransicaoPlano";

export function PlanoManutencaoWorkspace(props: {
  userId: string;
  clienteId: string;
  clienteNome: string;
}) {
  const [contexto] = useState(() => props);
  const mudou = contexto.userId !== props.userId || contexto.clienteId !== props.clienteId;
  return (
    <>
      {mudou && (
        <p role="alert">
          O contexto mudou. Volte ao Cliente e usuário anteriores para preservar a edição antes de
          sair.
        </p>
      )}
      <div hidden={mudou}>
        <ConteudoPlanoManutencao {...contexto} />
      </div>
    </>
  );
}

function ConteudoPlanoManutencao({
  userId,
  clienteId,
  clienteNome,
}: { userId: string; clienteId: string; clienteNome: string }) {
  const chave = `sso-plano-pendente:${userId}:${clienteId}`;
  const [recuperacao] = useState(() => {
    try {
      const valor = sessionStorage.getItem(chave);
      const comando = valor ? validarPlanoRascunho(JSON.parse(valor)) : null;
      if (comando && comando.clienteId !== clienteId) throw new Error("Cliente divergente");
      return { comando, falhou: false };
    } catch {
      return { comando: null, falhou: true };
    }
  });
  const [pendente, setPendente] = useState(recuperacao.comando);
  const trava = useRef(false);
  const [aberto, setAberto] = useState(false);
  const [editando, setEditando] = useState<PlanoResumo | null>(null);
  const [planoAbertoId, setPlanoAbertoId] = useState<string | null>(null);
  const [edicaoRotinaId, setEdicaoRotinaId] = useState<string | null>(null);
  const [nome, setNome] = useState("");
  const [erro, setErro] = useState("");
  async function conferirSessao(signal?: AbortSignal) {
    const { data, error } = await supabase.auth.getUser();
    if (error || data.user?.id !== userId || signal?.aborted) throw new Error("Sessão alterada.");
  }
  const permissao = useQuery({
    queryKey: ["plano-manutencao-permissao", userId, clienteId],
    queryFn: async ({ signal }) => {
      await conferirSessao(signal);
      const autorizada = await supabaseCapacidadesSsoAdapter.autorizarAcao("plano.gerir", clienteId);
      await conferirSessao(signal);
      return autorizada;
    },
    gcTime: 0,
    refetchOnWindowFocus: true,
  });
  const { planos, salvar } = usePlanosManutencao(
    supabasePlanoManutencaoAdapter,
    userId,
    clienteId,
    permissao.data === true && !permissao.isFetching && !permissao.isError,
  );
  if (permissao.isPending || permissao.isFetching)
    return <output>Verificando acesso aos Planos...</output>;
  if (permissao.isError)
    return (
      <div role="alert">
        Não foi possível verificar acesso aos Planos.{" "}
        <button type="button" onClick={() => void permissao.refetch()}>
          Tentar novamente
        </button>
      </div>
    );
  if (!permissao.data)
    return (
      <p className="text-caption text-ink-3">
        Você está sem permissão para gerir Planos deste Cliente.
      </p>
    );
  async function enviar(comando: SalvarPlanoCommand) {
    if (trava.current) return;
    trava.current = true;
    setErro("");
    try {
      await conferirSessao();
      if (sessionStorage.getItem(chave) !== JSON.stringify(comando)) throw new Error("Tentativa divergente.");
      await salvar.mutateAsync(comando);
      await conferirSessao();
      if (sessionStorage.getItem(chave) !== JSON.stringify(comando)) {
        setErro("Plano salvo, mas a tentativa local mudou. Reabra e reconcilie antes de continuar.");
        return;
      }
      sessionStorage.removeItem(chave);
      setPendente(null);
      setAberto(false);
      setEditando(null);
      setNome("");
    } catch (falha) {
      if (
        typeof falha === "object" &&
        falha !== null &&
        "code" in falha &&
        falha.code === "40001"
      ) {
        try {
          await conferirSessao();
          if (sessionStorage.getItem(chave) !== JSON.stringify(comando)) {
            setErro("O pedido local mudou durante o salvamento. Reabra e reconcilie antes de continuar.");
            return;
          }
          sessionStorage.removeItem(chave);
          setPendente(null);
          setAberto(false);
          setEditando(null);
          setErro("O Plano foi alterado. Confira a lista antes de editar novamente.");
          void planos.refetch();
          return;
        } catch {
          /* Conserva pedido quando o armazenamento falha. */
        }
      }
      setErro("Não foi possível confirmar o salvamento. Tente novamente com os mesmos dados.");
    } finally {
      trava.current = false;
    }
  }
  function iniciar() {
    if (trava.current) return;
    if (planos.isFetching || planos.isError) {
      setErro("Confira a lista atualizada de Planos antes de salvar.");
      return;
    }
    const comando = {
      requestId: crypto.randomUUID(),
      expectedRevision: editando?.revisao ?? 0,
      planoId: editando?.id ?? crypto.randomUUID(),
      clienteId,
      nome: nome.trim(),
    };
    try {
      if (sessionStorage.getItem(chave) !== null) {
        setErro(
          "Existe uma operação pendente para este Cliente. Confira o pedido anterior antes de salvar.",
        );
        return;
      }
      validarPlanoRascunho(comando);
      sessionStorage.setItem(chave, JSON.stringify(comando));
    } catch {
      setErro("Confira o nome e o armazenamento do navegador antes de salvar.");
      return;
    }
    setPendente(comando);
    void enviar(comando);
  }
  const itens = planos.data?.pages.flat() ?? [];
  const consultaBloqueada = planos.isFetching || planos.isError;
  return (
    <section
      aria-label="Planos de Manutenção"
      className="rounded-lg border border-line bg-surface p-4"
    >
      <h2 className="text-body font-semibold text-ink">Planos de Manutenção</h2>
      <p className="text-caption text-ink-3">
        Planos de {clienteNome}. Salvar rascunho não cria ocorrências nem tarefas.
      </p>
      {recuperacao.falhou && (
        <p role="alert">
          Não foi possível recuperar uma operação anterior. Consulte o suporte antes de criar outro
          Plano.
        </p>
      )}
      {erro && <p role="alert">{erro}</p>}
      {!aberto && !pendente && !recuperacao.falhou && (
        <Button
          variant="secondary"
          disabled={Boolean(edicaoRotinaId) || consultaBloqueada}
          onClick={() => {
            setEditando(null);
            setNome("");
            setErro("");
            setAberto(true);
          }}
        >
          Novo Plano de Manutenção
        </Button>
      )}
      {pendente && (
        <div>
          <p>Há um salvamento aguardando confirmação.</p>
          <Button
            variant="secondary"
            disabled={salvar.isPending || consultaBloqueada}
            onClick={() => void enviar(pendente)}
          >
            {salvar.isPending ? "Salvando..." : "Tentar salvar novamente"}
          </Button>
        </div>
      )}
      {aberto && !pendente && !recuperacao.falhou && (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            iniciar();
          }}
        >
          <label>
            Nome do Plano
            <input
              className="input"
              required
              maxLength={200}
              value={nome}
              onChange={(e) => setNome(e.target.value)}
            />
          </label>
          <Button type="submit" disabled={salvar.isPending || consultaBloqueada}>
            Salvar rascunho
          </Button>
          <Button type="button" variant="secondary" onClick={() => setAberto(false)}>
            Cancelar
          </Button>
        </form>
      )}
      {planos.isPending && <output>Carregando Planos...</output>}
      {planos.isError && (
        <div role="alert">
          Não foi possível carregar Planos.{" "}
          <button type="button" onClick={() => void planos.refetch()}>
            Tentar novamente
          </button>
        </div>
      )}
      {!planos.isPending && !planos.isError && itens.length === 0 && (
        <p>Nenhum Plano de Manutenção para este Cliente.</p>
      )}
      <ul hidden={consultaBloqueada}>
        {itens.map((plano) => (
          <li key={plano.id}>
            {plano.nome} — {plano.estado === "rascunho" ? "Rascunho" : plano.estado}
            <AcoesRevisaoPlano
              userId={userId}
              clienteId={clienteId}
              plano={plano}
              bloqueado={aberto || Boolean(pendente) || edicaoRotinaId === plano.id || consultaBloqueada}
            />
            {import.meta.env.VITE_SSO_TRANSICAO_PLANO_ENABLED === "true" && (
              <TransicaoPlano userId={userId} clienteId={clienteId} plano={plano}
                onAbrirRotinas={() => { setEdicaoRotinaId(null); setPlanoAbertoId(plano.id); }}
                bloqueado={aberto || Boolean(pendente) || Boolean(edicaoRotinaId) || consultaBloqueada} />
            )}
            <Button
              variant="ghost"
              aria-label={`Ver Rotinas de ${plano.nome}`}
              disabled={Boolean(edicaoRotinaId) || consultaBloqueada}
              onClick={() => {
                setEdicaoRotinaId(null);
                setPlanoAbertoId((id) => (id === plano.id ? null : plano.id));
              }}
            >
              Ver Rotinas
            </Button>
            {planoAbertoId === plano.id && (
              <DetalhePlano
                userId={userId}
                clienteId={clienteId}
                plano={plano}
                onAtualizar={() => void planos.refetch()}
                onEdicaoAtiva={(ativa) => setEdicaoRotinaId(ativa ? plano.id : null)}
              />
            )}
            {plano.estado === "rascunho" && !aberto && !pendente && !recuperacao.falhou && (
              <Button
                variant="ghost"
                aria-label={`Editar ${plano.nome}`}
                disabled={Boolean(edicaoRotinaId) || consultaBloqueada}
                onClick={() => {
                  setEditando(plano);
                  setNome(plano.nome);
                  setErro("");
                  setAberto(true);
                }}
              >
                Editar
              </Button>
            )}
          </li>
        ))}
      </ul>
      {!consultaBloqueada && planos.hasNextPage && (
        <Button
          variant="secondary"
          disabled={planos.isFetchingNextPage}
          onClick={() => void planos.fetchNextPage()}
        >
          Carregar mais Planos
        </Button>
      )}
    </section>
  );
}

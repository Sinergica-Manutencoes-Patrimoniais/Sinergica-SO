import { useInfiniteQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useRef, useState } from "react";
import { z } from "zod";
import { supabase } from "../../../../lib/supabase-client";
const itemSchema = z
  .object({
    pendencia_id: z.string().guid(),
    pergunta: z.string(),
    estado: z.string(),
    revisao_atual: z.number().int().positive(),
    revisao_origem: z.number().int().positive(),
    situacao: z.string(),
  })
  .strict();
const pedidoSchema = z
  .object({
    requestId: z.string().guid(),
    clienteId: z.string().guid(),
    origemId: z.string().guid(),
    revisao: z.number().int().positive(),
    destinoId: z.string().guid(),
    itens: z.array(z.string().guid()).min(1).max(99),
    motivo: z.string().min(1).max(2000),
  })
  .strict();
type Pedido = z.infer<typeof pedidoSchema>;
export function DividirComposicao({
  userId,
  clienteId,
  composicaoId,
  revisao,
  total,
  onDividida,
}: {
  userId: string;
  clienteId: string;
  composicaoId: string;
  revisao: number;
  total: number;
  onDividida: (id: string) => void;
}) {
  const cache = useQueryClient();
  const storage = `divisao-backlog:${JSON.stringify([userId, clienteId, composicaoId])}`;
  const trava = useRef(false);
  const [selecionadas, setSelecionadas] = useState<string[]>([]);
  const [motivo, setMotivo] = useState("");
  const [confirmacao, setConfirmacao] = useState<string | null>(null);
  const [aviso, setAviso] = useState("");
  const [pendente, setPendente] = useState<Pedido | "invalido" | null>(() => {
    try {
      const raw = sessionStorage.getItem(storage);
      if (!raw) return null;
      const p = pedidoSchema.parse(JSON.parse(raw));
      return p.clienteId === clienteId && p.origemId === composicaoId ? p : "invalido";
    } catch {
      return "invalido";
    }
  });
  async function conferirSessao(signal?: AbortSignal) {
    const r = await supabase.auth.getUser();
    if (r.error || r.data.user?.id !== userId || signal?.aborted) throw new Error("Sessão alterada.");
  }
  const lista = useInfiniteQuery({
    queryKey: ["backlog-divisao-itens", userId, clienteId, composicaoId],
    initialPageParam: null as string | null,
    gcTime: 0,
    queryFn: async ({ pageParam, signal }) => {
      await conferirSessao(signal);
      const { data, error } = await supabase
        .schema("pcm")
        .rpc("sso_listar_pendencias_sem_parcela", {
          p_composicao_id: composicaoId,
          p_apos: pageParam,
          p_limite: 20,
        })
        .abortSignal(signal);
      if (error) throw error;
      const pagina = z.array(itemSchema).max(20).parse(data);
      let anterior = pageParam?.toLowerCase() ?? "";
      for (const item of pagina) { const atual = item.pendencia_id.toLowerCase(); if (atual <= anterior) throw new Error("Página divergente."); anterior = atual; }
      await conferirSessao(signal);
      return pagina;
    },
    getNextPageParam: (p) => (p.length === 20 ? p.at(-1)?.pendencia_id : undefined),
  });
  const linhas = lista.data?.pages.flat() ?? [];
  const divergentes = linhas.some((item, i) => i > 0 && item.pendencia_id.toLowerCase() <= linhas[i - 1]!.pendencia_id.toLowerCase());
  const fotografia = JSON.stringify([userId, clienteId, composicaoId, revisao, total, [...selecionadas].sort(), motivo.trim(),
    linhas.filter(item => selecionadas.includes(item.pendencia_id))]);
  const confirmado = confirmacao === fotografia;
  const envio = useMutation({
    mutationFn: async (p: Pedido) => {
      await conferirSessao();
      if (sessionStorage.getItem(storage) !== JSON.stringify(p)) throw new Error("Tentativa divergente.");
      const { data, error } = await supabase
        .schema("pcm")
        .rpc("sso_dividir_composicao_backlog", {
          p_request_id: p.requestId,
          p_cliente_id: p.clienteId,
          p_origem_id: p.origemId,
          p_expected_revision: p.revisao,
          p_destino_id: p.destinoId,
          p_itens: p.itens,
          p_motivo: p.motivo,
        });
      if (error) throw error;
      const r = z
        .object({
          requestId: z.string().guid(),
          origemId: z.string().guid(),
          origemRevision: z.number().int().positive(),
          destinoId: z.string().guid(),
          destinoRevision: z.literal(1),
          itens: z.array(z.string().guid()),
          chamadoCriado: z.literal(false),
          osCriada: z.literal(false),
        })
        .strict()
        .parse(data);
      if (
        r.requestId !== p.requestId ||
        r.origemId !== p.origemId ||
        r.destinoId !== p.destinoId ||
        r.origemRevision !== p.revisao + 1 ||
        JSON.stringify([...r.itens].sort()) !== JSON.stringify([...p.itens].sort())
      )
        throw new Error("Resposta divergente.");
      await conferirSessao();
      return r;
    },
    onSuccess: async (r, p) => {
      try {
        await conferirSessao();
        if (sessionStorage.getItem(storage) !== JSON.stringify(p)) throw new Error();
        sessionStorage.removeItem(storage);
      } catch {
        setAviso("Divisão confirmada, mas tentativa local não foi removida. Procure suporte.");
        return;
      }
      setPendente(null);
      setSelecionadas([]);
      setConfirmacao(null);
      setAviso(
        `Nova composição ${r.destinoId} criada. Avalie GUTD antes de priorizá-la; nenhum Chamado ou OS foi criado.`,
      );
      onDividida(r.destinoId);
      await Promise.all([
        cache.invalidateQueries({ queryKey: ["backlog-composicoes", userId, clienteId] }),
        cache.invalidateQueries({
          queryKey: ["backlog-divisao-itens", userId, clienteId, composicaoId],
        }),
      ]);
    },
    onError: () =>
      setAviso(
        "Resultado não confirmado, seleção ou revisão alterada. Repita a mesma tentativa ou procure suporte.",
      ),
    onSettled: () => {
      trava.current = false;
    },
  });
  const enviar = (p: Pedido) => {
    if (trava.current) return;
    trava.current = true;
    envio.mutate(p);
  };
  const iniciar = () => {
    if (
      pendente ||
      trava.current ||
      !confirmado ||
      !lista.data ||
      lista.isFetching ||
      lista.isError ||
      divergentes
    )
      return;
    try {
      const itens = [...selecionadas].sort();
      if (
        itens.length >= total ||
        itens.some(
          (id) =>
            !lista.data.pages
              .flat()
              .some(
                (p) =>
                  p.pendencia_id === id &&
                  p.situacao === "sem_parcela" &&
                  p.revisao_atual === p.revisao_origem,
              ),
        )
      )
        throw new Error();
      const p = pedidoSchema.parse({
        requestId: crypto.randomUUID(),
        clienteId,
        origemId: composicaoId,
        revisao,
        destinoId: crypto.randomUUID(),
        itens,
        motivo: motivo.trim(),
      });
      if (sessionStorage.getItem(storage) !== null) throw new Error();
      sessionStorage.setItem(storage, JSON.stringify(p));
      setPendente(p);
      enviar(p);
    } catch {
      setAviso("Confira seleção, revisão e sessão. Nada foi enviado.");
    }
  };
  return (
    <section aria-label="Dividir composição">
      <h4>Separar escopo selecionado</h4>
      <p>
        A seleção cria outra composição; ao menos uma Pendência deve permanecer nesta. Ambas
        precisam de nova avaliação GUTD e nenhuma é promovida automaticamente.
      </p>
      {(lista.isError || divergentes) && (
        <p role="alert">
          Itens indisponíveis.{" "}
          <button type="button" onClick={() => void lista.refetch()}>
            Tentar novamente
          </button>
        </p>
      )}
      {lista.isPending && <output>Consultando itens…</output>}
      <fieldset disabled={!!pendente || envio.isPending || lista.isFetching || lista.isError || divergentes}>
        <ul>
          {!lista.isFetching && !lista.isError && !divergentes && linhas.map((p) => (
            <li key={p.pendencia_id}>
              <label>
                <input
                  type="checkbox"
                  checked={selecionadas.includes(p.pendencia_id)}
                  disabled={p.situacao !== "sem_parcela" || p.revisao_atual !== p.revisao_origem}
                  onChange={(e) => {
                    setConfirmacao(null);
                    setSelecionadas((atual) =>
                      e.target.checked
                        ? [...atual, p.pendencia_id]
                        : atual.filter((id) => id !== p.pendencia_id),
                    );
                  }}
                />{" "}
                Chave da pergunta {p.pergunta} · Pendência {p.pendencia_id} · {p.situacao}
              </label>
            </li>
          ))}
        </ul>
        <label>
          Motivo{" "}
          <textarea value={motivo} maxLength={2000} onChange={(e) => { setMotivo(e.target.value); setConfirmacao(null); }} />
        </label>
        <p>
          Selecionadas: {selecionadas.length} de {total} · revisão da composição {revisao}.
        </p>
        <label>
          <input
            type="checkbox"
            checked={confirmado}
            onChange={(e) => setConfirmacao(e.target.checked ? fotografia : null)}
          />{" "}
          Confirmo a divisão do escopo selecionado
        </label>
        <button
          type="button"
          disabled={
            !confirmado ||
            !motivo.trim() ||
            selecionadas.length < 1 ||
            selecionadas.length >= total ||
            selecionadas.length > 99
          }
          onClick={iniciar}
        >
          Separar seleção
        </button>
      </fieldset>
      {lista.hasNextPage && (
        <button
          type="button"
          disabled={lista.isFetchingNextPage}
          onClick={() => void lista.fetchNextPage()}
        >
          Mais Pendências
        </button>
      )}
      {pendente === "invalido" && <p role="alert">Tentativa local ilegível. Procure suporte.</p>}
      {pendente && pendente !== "invalido" && (
        <button type="button" disabled={envio.isPending} onClick={() => enviar(pendente)}>
          Repetir tentativa de divisão
        </button>
      )}
      {aviso && <p role="status">{aviso}</p>}
    </section>
  );
}

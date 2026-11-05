import { useInfiniteQuery } from "@tanstack/react-query";
import { useState } from "react";
import { z } from "zod";
import { supabase } from "../../../../lib/supabase-client";
import { obterPaginaSnapshotExportacao } from "../../infrastructure/supabase-snapshot-exportacao";

type Tipo = "sistema" | "componente" | "grupo";
type Cursor = { posicao: number; assinatura: string | null; total: number | null };
const rotina = z.object({
  id: z.string().uuid(),
  planoId: z.string().uuid(),
  versaoId: z.string().uuid(),
  alvoTipo: z.enum(["sistema", "componente", "grupo"]),
  alvoId: z.string().uuid(),
  alvoNome: z.string().min(1),
});
const pagina = z.object({
  clienteId: z.string().uuid(),
  planoId: z.string().uuid(),
  versaoId: z.string().uuid(),
  snapshotHash: z.string().regex(/^[a-f0-9]{32}$/),
  total: z.number().int().nonnegative().max(1_048_575),
  posicao: z.number().int().nonnegative(),
  proximaPosicao: z.number().int().nonnegative().nullable(),
  rotinas: z.array(rotina).max(100),
});

/** Navegação por páginas; exportação ainda reconfere a fotografia integral no servidor. */
export function SelecionarAlvoCronograma({
  userId,
  clienteId,
  planoId,
  versaoId,
  onSelecionar,
}: {
  userId: string;
  clienteId: string;
  planoId: string;
  versaoId: string;
  onSelecionar: (tipo: Tipo, id: string, fotografia: string) => void;
}) {
  const [busca, setBusca] = useState("");
  const identidade = { clienteId, planoId, versaoId };
  const consulta = useInfiniteQuery({
    queryKey: ["cronograma-alvos-fotografia", userId, clienteId, planoId, versaoId],
    gcTime: 0,
    staleTime: 0,
    retry: false,
    initialPageParam: { posicao: 0, assinatura: null, total: null } as Cursor,
    queryFn: async ({ pageParam, signal }) => {
      const antes = await supabase.auth.getUser();
      if (antes.error || antes.data.user?.id !== userId || signal.aborted)
        throw new Error("Sessão alterada.");
      const resposta = pagina.parse(
        await obterPaginaSnapshotExportacao(identidade, pageParam.posicao, signal),
      );
      if (
        resposta.clienteId !== clienteId ||
        resposta.planoId !== planoId ||
        resposta.versaoId !== versaoId ||
        resposta.posicao !== pageParam.posicao ||
        (pageParam.assinatura !== null &&
          (resposta.snapshotHash !== pageParam.assinatura || resposta.total !== pageParam.total))
      )
        throw new Error("Fotografia alterada.");
      const quantidade = Math.min(100, resposta.total - resposta.posicao);
      if (
        quantidade < 0 ||
        resposta.rotinas.length !== quantidade ||
        resposta.proximaPosicao !==
          (resposta.posicao + quantidade < resposta.total ? resposta.posicao + quantidade : null) ||
        resposta.rotinas.some((r) => r.planoId !== planoId || r.versaoId !== versaoId)
      )
        throw new Error("Página inválida.");
      const depois = await supabase.auth.getUser();
      if (depois.error || depois.data.user?.id !== userId || signal.aborted)
        throw new Error("Sessão alterada.");
      return resposta;
    },
    getNextPageParam: (p): Cursor | undefined =>
      p.proximaPosicao === null
        ? undefined
        : { posicao: p.proximaPosicao, assinatura: p.snapshotHash, total: p.total },
  });
  const alvos = new Map<string, { tipo: Tipo; id: string; nome: string }>();
  for (const p of consulta.data?.pages ?? [])
    for (const r of p.rotinas) {
      const chave = `${r.alvoTipo}:${r.alvoId.toLowerCase()}`;
      const anterior = alvos.get(chave);
      if (!anterior) alvos.set(chave, { tipo: r.alvoTipo, id: r.alvoId, nome: r.alvoNome });
      else if (anterior.nome !== r.alvoNome)
        alvos.set(chave, { ...anterior, nome: `${anterior.nome} / ${r.alvoNome}` });
    }
  const removerMarcas = (valor: string) =>
    Array.from(valor.normalize("NFD"))
      .filter((caractere) => {
        const codigo = caractere.codePointAt(0);
        return codigo === undefined || codigo < 0x300 || codigo > 0x36f;
      })
      .join("");
  const termo = removerMarcas(busca.trim()).toLocaleLowerCase("pt-BR");
  const alvosExibidos = [...alvos.values()].filter((alvo) =>
    removerMarcas(alvo.nome).toLocaleLowerCase("pt-BR").includes(termo),
  );
  return (
    <section aria-label="Selecionar alvo da fotografia aprovada">
      <p>
        Alvos das páginas carregadas da fotografia aprovada. Carregue mais páginas para localizar
        outros; seleção não comprova situação atual do cadastro.
      </p>
      <label>
        Buscar nome nas páginas carregadas{" "}
        <input
          type="search"
          value={busca}
          maxLength={120}
          onChange={(e) => setBusca(e.target.value)}
        />
      </label>
      {consulta.isFetching && <output>Consultando alvos…</output>}
      {consulta.isError && (
        <p role="alert">
          Fotografia indisponível ou alterada.{" "}
          <button type="button" onClick={() => void consulta.refetch()}>
            Tentar novamente
          </button>
        </p>
      )}
      {!consulta.isFetching && !consulta.isError && consulta.data && (
        <>
          {alvosExibidos.length === 0 ? (
            <p>
              Nenhum alvo encontrado nas páginas carregadas
              {consulta.hasNextPage ? "; carregue mais páginas para ampliar a busca" : ""}.
            </p>
          ) : (
            <ul>
              {alvosExibidos.map((a) => (
                <li key={`${a.tipo}:${a.id}`}>
                  {a.tipo} · {a.nome} · {a.id}{" "}
                  <button
                    type="button"
                    onClick={() => {
                      const hash = consulta.data?.pages[0]?.snapshotHash;
                      if (hash) onSelecionar(a.tipo, a.id, hash);
                    }}
                  >
                    Selecionar
                  </button>
                </li>
              ))}
            </ul>
          )}
          {consulta.hasNextPage && (
            <button type="button" onClick={() => void consulta.fetchNextPage()}>
              Mais alvos
            </button>
          )}
        </>
      )}
    </section>
  );
}

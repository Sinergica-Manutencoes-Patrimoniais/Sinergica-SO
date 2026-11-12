import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { z } from "zod";
import { supabaseListasMateriaisAdapter } from "../../infrastructure/supabase-listas-materiais-adapter";

const dadosSchema = z.discriminatedUnion("tipo", [
  z
    .object({
      tipo: z.literal("disponibilidade"),
      dados: z
        .object({ situacao: z.enum(["informada_disponivel", "parcial", "indisponivel"]) })
        .strict(),
    })
    .strict(),
  z
    .object({
      tipo: z.literal("excecao"),
      dados: z
        .object({
          motivo: z.enum(["faltante", "parcial", "errado", "novo_levantamento"]),
          descricao: z.string(),
          revisaoLinhas: z.number().int().positive().optional(),
          posicao: z.number().int().nonnegative().optional(),
        })
        .strict(),
    })
    .strict(),
  // Eventos dos 3 estados que a migration 1843 trouxe (§8.2 do Caderno).
  z
    .object({
      tipo: z.literal("aquisicao"),
      dados: z.object({ observacao: z.string().optional() }).strict(),
    })
    .strict(),
  z
    .object({ tipo: z.literal("dispensa"), dados: z.object({ motivo: z.string() }).strict() })
    .strict(),
  z
    .object({
      tipo: z.literal("conclusao"),
      dados: z.object({ observacao: z.string().optional() }).strict(),
    })
    .strict(),
]);
const motivos = {
  faltante: "Material faltante",
  parcial: "Material parcial",
  errado: "Material incorreto",
  novo_levantamento: "Novo levantamento",
} as const;
const situacoes = {
  informada_disponivel: "Informada disponível",
  parcial: "Informada parcial",
  indisponivel: "Informada indisponível",
} as const;
export function DetalheEvento({
  usuario,
  cliente,
  ordemServico,
  listaId,
  tipo,
  dados,
}: {
  usuario: string;
  cliente: string;
  ordemServico: string;
  listaId: string;
  tipo: "disponibilidade" | "excecao" | "aquisicao" | "dispensa" | "conclusao";
  dados: unknown;
}) {
  const [aberto, setAberto] = useState(false);
  const p = dadosSchema.safeParse({ tipo, dados });
  const revisao = p.success && p.data.tipo === "excecao" ? p.data.dados.revisaoLinhas : undefined;
  const posicao = p.success && p.data.tipo === "excecao" ? p.data.dados.posicao : undefined;
  const linhas = useQuery({
    queryKey: [
      "listas-materiais",
      usuario,
      cliente,
      ordemServico,
      "evento-linhas",
      listaId,
      revisao,
    ],
    enabled: aberto && revisao !== undefined && posicao !== undefined,
    gcTime: 0,
    queryFn: ({ signal }) =>
      supabaseListasMateriaisAdapter.obterLinhasExatas(listaId, revisao ?? 2, signal),
  });
  if (!p.success) return <p role="alert">Detalhe do evento inválido; consulte suporte.</p>;
  if (p.data.tipo === "disponibilidade")
    return <p>{situacoes[p.data.dados.situacao]} — informação não comprova conferência física.</p>;
  if (p.data.tipo === "aquisicao")
    return (
      <p>
        Aquisição pela Sinérgica{p.data.dados.observacao ? `: ${p.data.dados.observacao}` : ""} —
        lista aguardando a compra.
      </p>
    );
  if (p.data.tipo === "dispensa") return <p>Lista dispensada: {p.data.dados.motivo}</p>;
  if (p.data.tipo === "conclusao")
    return (
      <p>
        Lista concluída{p.data.dados.observacao ? `: ${p.data.dados.observacao}` : ""} — nenhum
        evento novo é aceito.
      </p>
    );
  return (
    <div>
      <p>
        {motivos[p.data.dados.motivo]}: {p.data.dados.descricao}
      </p>
      {revisao !== undefined && posicao !== undefined && (
        <>
          <button type="button" onClick={() => setAberto((v) => !v)}>
            {aberto ? "Ocultar linha original" : "Ver linha da versão registrada"}
          </button>
          {aberto && linhas.isPending && <output>Carregando linha registrada…</output>}
          {aberto && linhas.isError && (
            <p role="alert">
              Não foi possível consultar a linha.{" "}
              <button type="button" onClick={() => void linhas.refetch()}>
                Tentar novamente
              </button>
            </p>
          )}
          {aberto &&
            !linhas.isFetching &&
            !linhas.isError &&
            (linhas.data?.[posicao] ? (
              <p>
                Versão {revisao}: {linhas.data[posicao].descricao} ·{" "}
                {linhas.data[posicao].quantidade ?? "quantidade não informada"} ·{" "}
                {linhas.data[posicao].unidade ?? "unidade não informada"}. Fonte:{" "}
                {linhas.data[posicao].trechosOriginais.join(" / ")}
              </p>
            ) : (
              <p role="alert">Linha histórica indisponível. Consulte suporte.</p>
            ))}
        </>
      )}
    </div>
  );
}

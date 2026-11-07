import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { z } from "zod";
import { supabase } from "../../../../lib/supabase-client";

const pedidoSchema = z
  .object({
    requestId: z.string().guid(),
    clienteId: z.string().min(1),
    disponibilidadeId: z.string().min(1),
    intervaloId: z.string().min(1),
    revisaoDisponibilidade: z.number().int().positive(),
    revisaoVinculo: z.number().int().nonnegative(),
    incluido: z.boolean(),
    justificativa: z.string().min(1).max(500),
  })
  .strict();
type Pedido = z.infer<typeof pedidoSchema>;
const respostaSchema = z.object({
  clienteId: z.string(),
  disponibilidadeId: z.string(),
  intervaloId: z.string(),
  revisaoDisponibilidade: z.number().int().positive(),
  revisaoVinculo: z.number().int().nonnegative(),
  coberturaComprovada: z.literal(false),
  limiteAtingido: z.boolean(),
  historico: z
    .array(
      z.object({
        request_id: z.string(),
        revisao_disponibilidade: z.number().int().positive(),
        revisao_vinculo: z.number().int().positive(),
        incluido: z.boolean(),
        justificativa: z.string(),
        ator_id: z.string(),
        criado_em: z.string(),
      }),
    )
    .max(100),
});

export function VinculoIntervalo({
  userId,
  clienteId,
  disponibilidadeId,
  intervaloId,
  revision,
}: {
  userId: string;
  clienteId: string;
  disponibilidadeId: string;
  intervaloId: string;
  revision: number;
}) {
  const chave = `sso-vinculo-intervalo:${JSON.stringify([userId, clienteId, disponibilidadeId, intervaloId])}`;
  const key = ["capacidade-vinculo-intervalo", userId, clienteId, disponibilidadeId, intervaloId];
  const cache = useQueryClient();
  const [pendente, setPendente] = useState<Pedido | "invalida" | null>(() => {
    try {
      const v = sessionStorage.getItem(chave);
      if (v === null) return null;
      const p = pedidoSchema.safeParse(JSON.parse(v));
      return p.success &&
        p.data.clienteId === clienteId &&
        p.data.disponibilidadeId === disponibilidadeId &&
        p.data.intervaloId === intervaloId
        ? p.data
        : "invalida";
    } catch {
      return "invalida";
    }
  });
  const [justificativa, setJustificativa] = useState("");
  const [mensagem, setMensagem] = useState("");
  const [salvando, setSalvando] = useState(false);
  const q = useQuery({
    queryKey: key,
    gcTime: 0,
    queryFn: async ({ signal }) => {
      const { data, error } = await supabase
        .schema("pcm")
        .rpc("sso_consultar_vinculo_intervalo", {
          p_cliente_id: clienteId,
          p_disponibilidade_id: disponibilidadeId,
          p_intervalo_id: intervaloId,
        })
        .abortSignal(signal);
      if (error) throw error;
      const v = respostaSchema.parse(data);
      if (
        v.clienteId !== clienteId ||
        v.disponibilidadeId !== disponibilidadeId ||
        v.intervaloId !== intervaloId ||
        v.revisaoDisponibilidade !== revision ||
        (v.historico.length === 100) !== v.limiteAtingido
      )
        throw new Error("Resposta divergente");
      return v;
    },
  });
  async function salvar(incluido: boolean) {
    if (!q.data || salvando || pendente === "invalida") return;
    let p: Pedido;
    try {
      const atual = sessionStorage.getItem(chave);
      if (pendente) {
        p = pendente;
        if (atual !== JSON.stringify(p)) throw new Error("divergente");
      } else {
        if (atual !== null || !justificativa.trim()) throw new Error("inválido");
        p = pedidoSchema.parse({
          requestId: crypto.randomUUID(),
          clienteId,
          disponibilidadeId,
          intervaloId,
          revisaoDisponibilidade: revision,
          revisaoVinculo: q.data.revisaoVinculo,
          incluido,
          justificativa: justificativa.trim(),
        });
        sessionStorage.setItem(chave, JSON.stringify(p));
        if (sessionStorage.getItem(chave) !== JSON.stringify(p)) throw new Error("persistência");
        setPendente(p);
      }
    } catch {
      setMensagem("Tentativa inválida ou divergente; nenhum envio realizado.");
      return;
    }
    setSalvando(true);
    setMensagem("");
    try {
      const { data, error } = await supabase.schema("pcm").rpc("sso_mediar_vinculo_intervalo", {
        p_request_id: p.requestId,
        p_cliente_id: p.clienteId,
        p_disponibilidade_id: p.disponibilidadeId,
        p_intervalo_id: p.intervaloId,
        p_revisao_disponibilidade: p.revisaoDisponibilidade,
        p_revisao_vinculo: p.revisaoVinculo,
        p_incluido: p.incluido,
        p_justificativa: p.justificativa,
      });
      if (
        error ||
        !data ||
        data.requestId !== p.requestId ||
        data.revision !== p.revisaoVinculo + 1 ||
        data.coberturaComprovada !== false
      )
        throw new Error("Resposta inválida");
      if (sessionStorage.getItem(chave) !== JSON.stringify(p)) throw new Error("divergente");
      sessionStorage.removeItem(chave);
      setPendente(null);
      setMensagem("Vínculo registrado.");
      await cache.invalidateQueries({ queryKey: key });
      await cache.invalidateQueries({ queryKey: ["capacidade-snapshot", userId, clienteId] });
    } catch {
      setMensagem(
        "Resultado incerto ou revisão/acesso inválido. Preserve e repita a mesma tentativa.",
      );
    } finally {
      setSalvando(false);
    }
  }
  if (q.isPending) return <output>Carregando vínculo…</output>;
  if (q.isError)
    return (
      <p role="alert">
        Vínculo indisponível.{" "}
        <button type="button" onClick={() => void q.refetch()}>
          Tentar novamente
        </button>
      </p>
    );
  return (
    <section aria-label="Vínculo do intervalo">
      <p>Declaração humana não comprova cobertura, sobreposição nem saldo; não altera totais.</p>
      <p>Revisão atual do vínculo: {q.data.revisaoVinculo}.</p>
      {q.data.limiteAtingido && <p>Histórico limitado aos 100 eventos mais recentes.</p>}
      <ul>
        {q.data.historico.map((h) => (
          <li key={h.request_id}>
            Disponibilidade revisão {h.revisao_disponibilidade}, vínculo revisão {h.revisao_vinculo}
            : {h.incluido ? "inclusão declarada" : "inclusão retirada"} · {h.justificativa} ·{" "}
            {h.ator_id} · {h.criado_em}
          </li>
        ))}
      </ul>
      {pendente && <output>Há tentativa pendente; preserve e repita antes de editar.</output>}
      <label>
        Justificativa do vínculo{" "}
        <input
          maxLength={500}
          value={justificativa}
          disabled={Boolean(pendente) || salvando}
          onChange={(e) => setJustificativa(e.target.value)}
        />
      </label>
      {mensagem && <output>{mensagem}</output>}
      {pendente ? (
        <button
          type="button"
          disabled={salvando || pendente === "invalida"}
          onClick={() => void salvar(false)}
        >
          Repetir tentativa pendente
        </button>
      ) : (
        <>
          <button type="button" disabled={salvando} onClick={() => void salvar(true)}>
            Declarar inclusão
          </button>
          <button type="button" disabled={salvando} onClick={() => void salvar(false)}>
            Retirar inclusão
          </button>
        </>
      )}
    </section>
  );
}

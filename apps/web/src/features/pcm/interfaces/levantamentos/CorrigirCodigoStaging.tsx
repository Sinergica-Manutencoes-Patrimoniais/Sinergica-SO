import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRef, useState } from "react";
import { z } from "zod";
import { supabase } from "../../../../lib/supabase-client";
const schema = z
  .object({
    requestId: z.string().uuid(),
    requestEdicao: z.string().uuid(),
    requestCodigo: z.string().uuid(),
    loteId: z.string().uuid(),
    revision: z.number().int().positive(),
    chave: z.string(),
    antes: z.record(z.string(), z.unknown()),
    codigoRevision: z.number().int().nonnegative(),
    codigo: z.string().min(1).max(200),
    motivo: z.string().min(1).max(2000),
  })
  .strict();
type Pedido = z.infer<typeof schema>;
type Props = {
  userId: string;
  clienteId: string;
  loteId: string;
  chave: string;
  revisao: number;
  tipo: string;
  atributos: Record<string, unknown>;
};
export function CorrigirCodigoStaging(props: Props) {
  if (
    import.meta.env.VITE_SSO_CORRIGIR_CODIGO_STAGING_ENABLED !== "true" ||
    (!["sistema", "equipamento", "componente"].includes(props.tipo) &&
      !(
        props.tipo === "grupo_quantitativo" &&
        import.meta.env.VITE_SSO_CORRIGIR_CODIGO_GRUPO_STAGING_ENABLED === "true"
      ))
  )
    return null;
  return (
    <Conteudo
      key={JSON.stringify([props.userId, props.clienteId, props.loteId, props.chave])}
      {...props}
    />
  );
}
function Conteudo({ userId, clienteId, loteId, chave, revisao, atributos }: Props) {
  const storage = `sso-corrigir-codigo-staging:${JSON.stringify([userId, clienteId, loteId, chave])}`;
  const client = useQueryClient();
  const trava = useRef(false);
  const [codigo, setCodigo] = useState("");
  const [motivo, setMotivo] = useState("");
  const [confirmacao, setConfirmacao] = useState<string | null>(null);
  const [aviso, setAviso] = useState("");
  const [pendente, setPendente] = useState<Pedido | "invalido" | null>(() => {
    try {
      const raw = sessionStorage.getItem(storage);
      if (!raw) return null;
      const p = schema.parse(JSON.parse(raw));
      return p.loteId === loteId && p.chave === chave ? p : "invalido";
    } catch {
      return "invalido";
    }
  });
  async function conferirSessao(signal?: AbortSignal) {
    const r = await supabase.auth.getUser();
    if (r.error || r.data.user?.id !== userId || signal?.aborted) throw new Error("Sessão alterada.");
  }
  const q = useQuery({
    queryKey: [
      "levantamentos",
      userId,
      clienteId,
      loteId,
      chave,
      "codigo-staging-correcao",
      revisao,
    ],
    gcTime: 0,
    queryFn: async ({ signal }) => {
      await conferirSessao(signal);
      const { data, error } = await supabase
        .schema("pcm")
        .rpc("sso_codigo_staging_autorizado", { p_lote_id: loteId, p_chave: chave })
        .abortSignal(signal);
      if (error) throw error;
      const resultado = (
        z
          .array(z.object({ codigo: z.string(), revisao: z.number().int().positive() }).strict())
          .max(1)
          .parse(data)[0] ?? null
      );
      await conferirSessao(signal);
      return resultado;
    },
  });
  const fotografia = JSON.stringify([userId, clienteId, loteId, chave, revisao, atributos, q.data, codigo.trim().toUpperCase(), motivo.trim()]);
  const confirmado = confirmacao === fotografia;
  const envio = useMutation({
    mutationFn: async (p: Pedido) => {
      await conferirSessao();
      if (sessionStorage.getItem(storage) !== JSON.stringify(p)) throw new Error("Tentativa divergente.");
      const { data, error } = await supabase
        .schema("pcm")
        .rpc("sso_corrigir_codigo_autorizado", {
          p_request_id: p.requestId,
          p_request_edicao: p.requestEdicao,
          p_request_codigo: p.requestCodigo,
          p_lote_id: p.loteId,
          p_expected_revision: p.revision,
          p_chave: p.chave,
          p_antes: p.antes,
          p_codigo_revision: p.codigoRevision,
          p_codigo: p.codigo,
          p_motivo: p.motivo,
          p_confirmado: true,
        });
      if (error) throw error;
      const r = z
        .object({
          loteId: z.string().uuid(),
          chave: z.string(),
          revision: z.number().int(),
          codigoRevision: z.number().int(),
          requestId: z.string().uuid(),
          codigoOficialAlterado: z.literal(false),
          aliasCriado: z.literal(false),
        })
        .strict()
        .parse(data);
      if (
        r.loteId !== p.loteId ||
        r.chave !== p.chave ||
        r.revision !== p.revision + 2 ||
        r.codigoRevision !== p.codigoRevision + 1 ||
        r.requestId !== p.requestId
      )
        throw new Error("Resposta divergente");
      await conferirSessao();
    },
    onSuccess: async (_r, p) => {
      try {
        await conferirSessao();
        if (sessionStorage.getItem(storage) !== JSON.stringify(p)) throw new Error();
        sessionStorage.removeItem(storage);
      } catch {
        setAviso("Correção registrada; tentativa local não foi limpa. Consulte suporte.");
        return;
      }
      setPendente(null);
      setConfirmacao(null);
      setAviso("Código corrigido em staging; confira novamente a linha e o lote.");
      await client.invalidateQueries({ queryKey: ["levantamentos", userId, clienteId] });
    },
    onError: () =>
      setAviso("Resultado não confirmado. Repita a mesma tentativa ou consulte suporte."),
    onSettled: () => {
      trava.current = false;
    },
  });
  function enviar(p: Pedido) {
    if (trava.current) return;
    trava.current = true;
    envio.mutate(p);
  }
  function iniciar() {
    if (
      pendente ||
      trava.current ||
      !confirmado ||
      !motivo.trim() ||
      q.isPending ||
      q.isFetching ||
      q.isError
    )
      return;
    try {
      const c = codigo.trim().toUpperCase();
      if (!/^\S+$/.test(c)) throw new Error();
      const p = schema.parse({
        requestId: crypto.randomUUID(),
        requestEdicao: crypto.randomUUID(),
        requestCodigo: crypto.randomUUID(),
        loteId,
        revision: revisao,
        chave,
        antes: atributos,
        codigoRevision: q.data?.revisao ?? 0,
        codigo: c,
        motivo: motivo.trim(),
      });
      if (sessionStorage.getItem(storage) !== null) throw new Error();
      sessionStorage.setItem(storage, JSON.stringify(p));
      setPendente(p);
      enviar(p);
    } catch {
      setAviso("Confira código, motivo e sessão. Nada enviado.");
    }
  }
  return (
    <section>
      <h5>Corrigir código no levantamento</h5>
      <p>
        Altera juntos o código informado e o candidato somente no staging. O anterior permanece no
        histórico da linha; nenhum código oficial ou alias é alterado. A revisão reabre a
        conferência e não reserva o novo código.
      </p>
      <p>
        Informado:{" "}
        {typeof atributos.codigoInformado === "string"
          ? atributos.codigoInformado
          : "não informado"}{" "}
        · candidato: {q.isFetching || q.isError ? "em conferência" : q.data?.codigo ?? "não informado"} · revisão do lote: {revisao}.
      </p>
      {q.isError && (
        <p role="alert">
          Candidato indisponível.{" "}
          <button type="button" onClick={() => void q.refetch()}>
            Tentar novamente
          </button>
        </p>
      )}
      {pendente === "invalido" && <p role="alert">Tentativa local ilegível. Consulte suporte.</p>}
      {pendente && pendente !== "invalido" ? (
        <button type="button" disabled={envio.isPending} onClick={() => enviar(pendente)}>
          Repetir mesma tentativa
        </button>
      ) : (
        !pendente && (
          <>
            <label>
              Novo código{" "}
              <input maxLength={200} value={codigo} onChange={(e) => { setCodigo(e.target.value); setConfirmacao(null); }} />
            </label>
            <label>
              Motivo{" "}
              <textarea
                maxLength={2000}
                value={motivo}
                onChange={(e) => { setMotivo(e.target.value); setConfirmacao(null); }}
              />
            </label>
            <label>
              <input
                type="checkbox"
                checked={confirmado}
                disabled={q.isPending || q.isFetching || q.isError || envio.isPending}
                onChange={(e) => setConfirmacao(e.target.checked ? fotografia : null)}
              />{" "}
              Conferi o código e autorizo reabrir a conferência.
            </label>
            <button
              type="button"
              disabled={
                !confirmado ||
                !codigo.trim() ||
                !motivo.trim() ||
                q.isPending ||
                q.isFetching ||
                q.isError ||
                envio.isPending
              }
              onClick={iniciar}
            >
              Corrigir em staging
            </button>
          </>
        )
      )}
      {aviso && <p role="status">{aviso}</p>}
    </section>
  );
}

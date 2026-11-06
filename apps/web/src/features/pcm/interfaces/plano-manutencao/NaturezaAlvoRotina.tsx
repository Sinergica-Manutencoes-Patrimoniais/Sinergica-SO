import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { z } from "zod";
import { supabase } from "../../../../lib/supabase-client";

const uuid = z.string().uuid();
const pedidoSchema = z.object({ requestId: uuid, ator: uuid, cliente: uuid, plano: uuid, rotina: uuid,
  alvo: uuid, versao: uuid, revisao: z.number().int().safe().positive(),
  natureza: z.enum(["equipamento", "componente"]) }).strict();
type Pedido = z.infer<typeof pedidoSchema>;
type Props = { userId: string; clienteId: string; planoId: string; versaoId: string; rotinaId: string;
  alvoId: string; revisao: number; onAtualizar: () => void };

export function NaturezaAlvoRotina(props: Props) {
  if (import.meta.env.VITE_SSO_NATUREZA_ALVO_ROTINA_ENABLED !== "true") return null;
  return <Conteudo key={JSON.stringify([props.userId, props.clienteId, props.planoId, props.versaoId, props.rotinaId, props.alvoId])} {...props} />;
}
function Conteudo({ userId, clienteId, planoId, versaoId, rotinaId, alvoId, revisao, onAtualizar }: Props) {
  const montado = useRef(false);
  useEffect(() => { montado.current = true; return () => { montado.current = false; }; }, []);
  const cache = useQueryClient(); const trava = useRef(false);
  const chave = `sso-natureza-alvo:${JSON.stringify([userId, clienteId, planoId, rotinaId])}`;
  const [pendente, setPendente] = useState<Pedido | "invalido" | null>(() => {
    try {
      const valor = sessionStorage.getItem(chave); if (!valor) return null;
      const p = pedidoSchema.parse(JSON.parse(valor));
      return p.ator === userId && p.cliente === clienteId && p.plano === planoId && p.rotina === rotinaId &&
        p.versao === versaoId && p.alvo === alvoId ? p : "invalido";
    } catch { return "invalido"; }
  });
  const [natureza, setNatureza] = useState<"" | Pedido["natureza"]>("");
  const [confirmado, setConfirmado] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState(false); const [aviso, setAviso] = useState("");
  async function conferirSessao(signal?: AbortSignal) {
    const { data, error } = await supabase.auth.getUser();
    if (error || data.user?.id !== userId || signal?.aborted) throw new Error("Sessão alterada.");
  }
  const consulta = useQuery({
    queryKey: ["natureza-alvo-rotina", userId, clienteId, planoId, versaoId, rotinaId, alvoId, revisao],
    gcTime: 0, retry: false,
    queryFn: async ({ signal }) => {
      await conferirSessao(signal);
      const { data, error } = await supabase.schema("pcm").from("rotinas_manutencao")
        .select("id,plano_id,versao_id,alvo_tipo,equipamento_id,natureza_tecnica")
        .eq("id", rotinaId).eq("plano_id", planoId).eq("versao_id", versaoId).abortSignal(signal).maybeSingle();
      if (error) throw error;
      const r = z.object({ id: uuid, plano_id: uuid, versao_id: uuid, alvo_tipo: z.literal("componente"),
        equipamento_id: uuid, natureza_tecnica: z.enum(["equipamento", "componente"]).nullable() }).strict().parse(data);
      if (r.id !== rotinaId || r.plano_id !== planoId || r.versao_id !== versaoId || r.equipamento_id !== alvoId)
        throw new Error("Rotina divergente.");
      await conferirSessao(signal); return r;
    },
  });
  const fotografia = consulta.data && !consulta.isFetching && !consulta.isError
    ? JSON.stringify([userId, clienteId, planoId, versaoId, rotinaId, alvoId, revisao, consulta.data.natureza_tecnica, natureza]) : null;
  async function enviar(p: Pedido) {
    if (trava.current) return;
    trava.current = true; setOcupado(true); setAviso("");
    try {
      await conferirSessao(); if (!montado.current) throw new Error("Tela desmontada.");
      if (sessionStorage.getItem(chave) !== JSON.stringify(p)) throw new Error("Tentativa divergente.");
      const { data, error } = await supabase.schema("pcm").rpc("sso_declarar_natureza_alvo_rotina", {
        p_ator_id: p.ator, p_request_id: p.requestId, p_cliente_id: p.cliente, p_plano_id: p.plano,
        p_rotina_id: p.rotina, p_expected_revision: p.revisao, p_natureza: p.natureza,
      });
      if (error) throw error;
      const r = z.object({ requestId: uuid, planoId: uuid, rotinaId: uuid, versaoId: uuid, alvoId: uuid,
        natureza: z.enum(["equipamento", "componente"]), revision: z.number().int().safe().positive() }).strict().parse(data);
      if (r.requestId !== p.requestId || r.planoId !== p.plano || r.rotinaId !== p.rotina ||
        r.versaoId !== p.versao || r.alvoId !== p.alvo || r.natureza !== p.natureza || r.revision !== p.revisao + 1)
        throw new Error("Recibo divergente.");
      await conferirSessao(); if (!montado.current) throw new Error("Tela desmontada.");
      if (sessionStorage.getItem(chave) !== JSON.stringify(p)) throw new Error("Tentativa divergente.");
      sessionStorage.removeItem(chave); setPendente(null); setConfirmado(null);
      setAviso("Natureza declarada para esta Rotina. O cadastro e o código não foram alterados.");
      try {
        await cache.invalidateQueries({ queryKey: ["natureza-alvo-rotina", userId, clienteId, planoId, versaoId, rotinaId] });
        if (montado.current) onAtualizar();
      } catch { setAviso("Natureza confirmada, mas atualização da tela falhou. Recarregue para conferir."); }
    } catch { setAviso("Resultado não confirmado. Preserve e repita a mesma tentativa ou procure suporte."); }
    finally { trava.current = false; setOcupado(false); }
  }
  return <section aria-label="Natureza do alvo da Rotina">
    <p>Esta declaração distingue Equipamento de Componente no alvo da Rotina; não altera o cadastro compartilhado.</p>
    {consulta.isFetching && <output>Consultando natureza…</output>}
    {consulta.isError && <p role="alert">Natureza indisponível. <button type="button" onClick={() => void consulta.refetch()}>Tentar novamente</button></p>}
    {!consulta.isFetching && !consulta.isError && consulta.data && <p>Natureza atual: {consulta.data.natureza_tecnica ?? "não declarada"}.</p>}
    {pendente === "invalido" && <p role="alert">Tentativa local incompatível; consulte suporte.</p>}
    {pendente && pendente !== "invalido" ? <button type="button" disabled={ocupado} onClick={() => void enviar(pendente)}>Repetir mesma tentativa</button>
      : !pendente && <form onSubmit={(e) => {
        e.preventDefault(); if (!fotografia || confirmado !== fotografia || !natureza || ocupado) return;
        try {
          const p = pedidoSchema.parse({ requestId: crypto.randomUUID(), ator: userId, cliente: clienteId,
            plano: planoId, rotina: rotinaId, alvo: alvoId, versao: versaoId, revisao, natureza });
          if (sessionStorage.getItem(chave) !== null) throw new Error("Tentativa existente.");
          sessionStorage.setItem(chave, JSON.stringify(p)); setPendente(p); void enviar(p);
        } catch { setAviso("Não foi possível guardar a tentativa; nada foi enviado."); }
      }}>
        <label>Natureza <select value={natureza} onChange={(e) => { setNatureza(e.target.value as typeof natureza); setConfirmado(null); }}>
          <option value="">Selecione</option><option value="equipamento">Equipamento</option><option value="componente">Componente</option>
        </select></label>
        <label><input type="checkbox" disabled={!fotografia || !natureza} checked={!!fotografia && confirmado === fotografia}
          onChange={(e) => setConfirmado(e.target.checked ? fotografia : null)} /> Conferi o alvo e a natureza declarada.</label>
        <button type="submit" disabled={!fotografia || confirmado !== fotografia || !natureza || ocupado}>Declarar natureza</button>
      </form>}
    {aviso && <p role="status">{aviso}</p>}
  </section>;
}

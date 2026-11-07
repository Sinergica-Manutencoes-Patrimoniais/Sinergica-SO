import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { z } from "zod";
import {
  type Escopo,
  type PedidoEscopo,
  consultarEscopo,
  declararEscopo,
} from "../../infrastructure/supabase-escopo-origem-adapter";

const pedidoSchema = z
  .object({
    requestId: z.string().guid(),
    clienteId: z.string().min(1),
    osId: z.string().min(1),
    revision: z.number().int().nonnegative(),
    executado: z.string().min(1).max(4000).nullable(),
    restante: z.string().min(1).max(4000).nullable(),
    justificativa: z.string().min(1).max(2000),
  })
  .strict();
export function EscopoDeclarado({
  userId,
  clienteId,
  osId,
}: { userId: string; clienteId: string; osId: string }) {
  const key = ["escopo-origem", userId, clienteId, osId];
  const q = useQuery({
    queryKey: key,
    queryFn: ({ signal }) => consultarEscopo(clienteId, osId, signal),
    gcTime: 0,
  });
  const client = useQueryClient();
  if (q.isPending) return <output>Carregando escopo…</output>;
  if (q.isError)
    return (
      <p role="alert">
        Escopo indisponível.{" "}
        <button type="button" onClick={() => void q.refetch()}>
          Tentar novamente
        </button>
      </p>
    );
  return (
    <Formulario
      key={`${userId}:${clienteId}:${osId}:${q.data.revision}`}
      userId={userId}
      clienteId={clienteId}
      escopo={q.data}
      atualizar={() => client.invalidateQueries({ queryKey: key })}
    />
  );
}
function Formulario({
  userId,
  clienteId,
  escopo,
  atualizar,
}: { userId: string; clienteId: string; escopo: Escopo; atualizar: () => Promise<unknown> }) {
  const chave = `sso-escopo:${JSON.stringify([userId, clienteId, escopo.osId])}`;
  const [pendente, setPendente] = useState<PedidoEscopo | "invalida" | null>(() => {
    try {
      const bruto = sessionStorage.getItem(chave);
      if (bruto === null) return null;
      const v = pedidoSchema.safeParse(JSON.parse(bruto));
      return v.success && v.data.clienteId === clienteId && v.data.osId === escopo.osId
        ? v.data
        : "invalida";
    } catch {
      return "invalida";
    }
  });
  const p = pendente && pendente !== "invalida" ? pendente : null;
  const [executado, setExecutado] = useState(
    p ? (p.executado ?? "") : (escopo.executadoDeclarado ?? ""),
  );
  const [restante, setRestante] = useState(
    p ? (p.restante ?? "") : (escopo.restanteDeclarado ?? ""),
  );
  const [justificativa, setJustificativa] = useState(p?.justificativa ?? "");
  const [erro, setErro] = useState("");
  const [salvando, setSalvando] = useState(false);
  async function salvar(e: React.FormEvent) {
    e.preventDefault();
    if (pendente === "invalida") return;
    let pedido: PedidoEscopo;
    try {
      const bruto = sessionStorage.getItem(chave);
      if (p) {
        pedido = p;
        if (bruto !== JSON.stringify(pedido)) throw new Error("divergente");
      } else {
        if (bruto !== null || (!executado.trim() && !restante.trim()) || !justificativa.trim())
          throw new Error("inválido");
        pedido = pedidoSchema.parse({
          requestId: crypto.randomUUID(),
          clienteId,
          osId: escopo.osId,
          revision: escopo.revision,
          executado: executado.trim() || null,
          restante: restante.trim() || null,
          justificativa: justificativa.trim(),
        });
        sessionStorage.setItem(chave, JSON.stringify(pedido));
        if (sessionStorage.getItem(chave) !== JSON.stringify(pedido))
          throw new Error("persistência");
        setPendente(pedido);
      }
    } catch {
      setErro("Dados inválidos ou tentativa divergente/inacessível; nenhum envio foi feito.");
      return;
    }
    setSalvando(true);
    setErro("");
    try {
      await declararEscopo(pedido);
      if (sessionStorage.getItem(chave) !== JSON.stringify(pedido)) throw new Error("divergente");
      sessionStorage.removeItem(chave);
      setPendente(null);
      await atualizar();
    } catch {
      setErro("Resultado incerto ou acesso/revisão inválidos. Repita a mesma tentativa.");
    } finally {
      setSalvando(false);
    }
  }
  return (
    <form onSubmit={(e) => void salvar(e)}>
      <p>
        Declaração humana não comprova execução e não atualiza a OS. Origem preparada:{" "}
        {escopo.origem.preparadaId}.
      </p>
      {pendente && <output>Tentativa pendente: repita o mesmo pedido antes de editar.</output>}
      <fieldset disabled={Boolean(pendente) || salvando}>
        <label>
          Executado declarado
          <textarea
            maxLength={4000}
            value={executado}
            onChange={(e) => setExecutado(e.target.value)}
          />
        </label>
        <label>
          Restante declarado
          <textarea
            maxLength={4000}
            value={restante}
            onChange={(e) => setRestante(e.target.value)}
          />
        </label>
        <label>
          Justificativa
          <input
            maxLength={2000}
            required
            value={justificativa}
            onChange={(e) => setJustificativa(e.target.value)}
          />
        </label>
      </fieldset>
      {erro && <p role="alert">{erro}</p>}
      <button type="submit" disabled={salvando || pendente === "invalida"}>
        {salvando
          ? "Salvando…"
          : pendente
            ? "Repetir tentativa pendente"
            : "Salvar escopo declarado"}
      </button>
    </form>
  );
}

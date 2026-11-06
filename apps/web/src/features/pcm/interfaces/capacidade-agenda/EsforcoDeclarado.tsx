import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useRef, useState } from "react";
import { z } from "zod";
import { supabase } from "../../../../lib/supabase-client";
import {
  type Esforco,
  type PedidoEsforco,
  consultarEsforcoDeclarado,
  declararEsforco,
} from "../../infrastructure/supabase-esforco-declarado-adapter";

export function EsforcoDeclarado({
  userId,
  clienteId,
  osId,
  origemTipo = "os",
}: { userId: string; clienteId: string; osId: string; origemTipo?: Esforco["origemTipo"] }) {
  const key = ["capacidade-esforco", userId, clienteId, origemTipo, osId];
  const consulta = useQuery({
    queryKey: key,
    queryFn: async ({ signal }) => { const antes = await supabase.auth.getUser(); if (antes.error || antes.data.user?.id !== userId || signal.aborted) throw new Error("Sessão alterada."); const resultado = await consultarEsforcoDeclarado(clienteId, osId, signal, origemTipo); const depois = await supabase.auth.getUser(); if (depois.error || depois.data.user?.id !== userId || signal.aborted) throw new Error("Sessão alterada."); return resultado; },
    gcTime: 0,
  });
  const client = useQueryClient();
  if (consulta.isPending) return <output>Carregando declaração…</output>;
  if (consulta.isError)
    return (
      <p role="alert">
        Declaração indisponível.{" "}
        <button type="button" onClick={() => void consulta.refetch()}>
          Tentar novamente
        </button>
      </p>
    );
  return (
    <Formulario
      key={`${userId}:${clienteId}:${origemTipo}:${osId}:${consulta.data.revision}`}
      userId={userId}
      clienteId={clienteId}
      esforco={consulta.data}
      recarregar={() =>
        Promise.all([
          client.invalidateQueries({ queryKey: key }),
          client.invalidateQueries({ queryKey: ["capacidade-fontes-demanda", userId, clienteId] }),
          client.invalidateQueries({ queryKey: ["capacidade-snapshot", userId, clienteId] }),
          client.invalidateQueries({ queryKey: ["capacidade-ocorrencias-sem-os", userId, clienteId] }),
        ])
      }
    />
  );
}

function Formulario({
  userId,
  clienteId,
  esforco,
  recarregar,
}: { userId: string; clienteId: string; esforco: Esforco; recarregar: () => Promise<unknown> }) {
  const [erro, setErro] = useState("");
  const [salvando, setSalvando] = useState(false);
  const trava = useRef(false);
  const chave = esforco.origemTipo === "os"
    ? `sso-esforco:${JSON.stringify([userId, clienteId, esforco.origemId])}`
    : `sso-esforco-${esforco.origemTipo}:${JSON.stringify([userId, clienteId, esforco.origemId])}`;
  const [pendente, setPendente] = useState<PedidoEsforco | "invalida" | null>(() => {
    try {
      const bruto = sessionStorage.getItem(chave);
      if (bruto === null) return null;
      const validado = tentativaSchema.safeParse(JSON.parse(bruto));
      if (
        !validado.success ||
        validado.data.clienteId !== clienteId ||
        validado.data.origemId !== esforco.origemId ||
        validado.data.origemTipo !== esforco.origemTipo
      )
        return "invalida";
      return validado.data;
    } catch {
      return "invalida";
    }
  });
  const inicial = pendente && pendente !== "invalida" ? pendente : esforco;
  const [internos, setInternos] = useState(inicial.internosMinutos?.toString() ?? "");
  const [terceiros, setTerceiros] = useState(inicial.terceirosMinutos?.toString() ?? "");
  const [acompanhamento, setAcompanhamento] = useState(
    inicial.acompanhamentoMinutos?.toString() ?? "",
  );
  const [justificativa, setJustificativa] = useState(
    pendente && pendente !== "invalida" ? pendente.justificativa : "",
  );
  const parse = (valor: string) => (valor === "" ? null : Number(valor));
  async function salvar(e: React.FormEvent) {
    e.preventDefault();
    if (trava.current) return;
    if (pendente === "invalida") {
      setErro("Tentativa armazenada inválida ou inacessível; não foi substituída.");
      return;
    }
    const valores = [internos, terceiros, acompanhamento].map(parse);
    if (
      !pendente &&
      (valores.some((n) => n !== null && (!Number.isSafeInteger(n) || n < 0 || n > 2147483647)) ||
        !justificativa.trim())
    ) {
      setErro("Informe minutos inteiros não negativos e justificativa.");
      return;
    }
    let pedido: PedidoEsforco;
    try {
      const armazenado = sessionStorage.getItem(chave);
      if (pendente) {
        pedido = pendente;
        if (armazenado !== JSON.stringify(pedido)) throw new Error("tentativa divergente");
      } else {
        if (armazenado !== null) throw new Error("tentativa divergente");
        pedido = tentativaSchema.parse({
          ...esforco,
          clienteId,
          requestId: crypto.randomUUID(),
          justificativa: justificativa.trim(),
          internosMinutos: valores[0] ?? null,
          terceirosMinutos: valores[1] ?? null,
          acompanhamentoMinutos: valores[2] ?? null,
        });
        sessionStorage.setItem(chave, JSON.stringify(pedido));
        if (sessionStorage.getItem(chave) !== JSON.stringify(pedido))
          throw new Error("persistência indisponível");
        setPendente(pedido);
      }
    } catch {
      setErro("Tentativa armazenada divergente ou inacessível; nenhum envio foi feito.");
      return;
    }
    trava.current = true; setSalvando(true);
    setErro("");
    try {
      const antes = await supabase.auth.getUser(); if (antes.error || antes.data.user?.id !== userId || sessionStorage.getItem(chave) !== JSON.stringify(pedido)) throw new Error("Sessão ou tentativa alterada.");
      await declararEsforco(pedido);
      const depois = await supabase.auth.getUser(); if (depois.error || depois.data.user?.id !== userId) throw new Error("Sessão alterada.");
      if (sessionStorage.getItem(chave) !== JSON.stringify(pedido))
        throw new Error("tentativa divergente");
      sessionStorage.removeItem(chave);
      setPendente(null);
      await recarregar();
    } catch {
      setErro("Resultado não confirmado. Preserve e repita a mesma tentativa ou consulte suporte.");
    } finally {
      trava.current = false; setSalvando(false);
    }
  }
  return (
    <form onSubmit={(e) => void salvar(e)}>
      <p>
        Esforço declarado para esta {esforco.origemTipo === "os" ? "OS" : "ocorrência"}. Campos vazios ou zero mantêm demanda incompleta;
        nenhuma soma ou deduplicação é feita.
      </p>
      {pendente && (
        <output>
          Há uma tentativa pendente. Repita a mesma solicitação antes de editar; o resultado
          anterior pode ser incerto.
        </output>
      )}
      <fieldset disabled={Boolean(pendente) || salvando}>
        <label>
          Interno próprio (minutos-homem)
          <input
            type="number"
            min="0"
            step="1"
            value={internos}
            onChange={(e) => setInternos(e.target.value)}
          />
        </label>
        <label>
          Terceiros (minutos-homem)
          <input
            type="number"
            min="0"
            step="1"
            value={terceiros}
            onChange={(e) => setTerceiros(e.target.value)}
          />
        </label>
        <label>
          Acompanhamento interno (minutos-homem)
          <input
            type="number"
            min="0"
            step="1"
            value={acompanhamento}
            onChange={(e) => setAcompanhamento(e.target.value)}
          />
        </label>
        <label>
          Justificativa
          <input
            value={justificativa}
            maxLength={2000}
            onChange={(e) => setJustificativa(e.target.value)}
            required
          />
        </label>
      </fieldset>
      {erro && <p role="alert">{erro}</p>}
      <button type="submit" disabled={salvando || pendente === "invalida"}>
        {salvando ? "Salvando…" : pendente ? "Repetir tentativa pendente" : "Salvar declaração"}
      </button>
    </form>
  );
}

const tentativaSchema = z
  .object({
    origemTipo: z.enum(["os", "ocorrencia", "ocorrencia_visita"]),
    origemId: z.string().min(1),
    clienteId: z.string().min(1),
    requestId: z.string().uuid(),
    revision: z.number().int().nonnegative(),
    internosMinutos: z.number().int().nonnegative().nullable(),
    terceirosMinutos: z.number().int().nonnegative().nullable(),
    acompanhamentoMinutos: z.number().int().nonnegative().nullable(),
    justificativa: z.string().trim().min(1).max(2000),
  })
  .strict();

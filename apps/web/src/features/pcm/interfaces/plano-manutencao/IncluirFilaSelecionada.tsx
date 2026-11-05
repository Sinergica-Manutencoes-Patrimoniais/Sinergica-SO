import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { z } from "zod";
import { supabase } from "../../../../lib/supabase-client";

const uuid = z.string().uuid();
const itemSchema = z
  .object({
    preparadaId: uuid,
    requestId: uuid,
    vencimento: z.string().date(),
    rotinaId: uuid,
    alvoId: uuid,
  })
  .strict();
const resultadoSchema = z
  .object({ preparadaId: uuid, cicloId: uuid, estado: z.enum(["aguardando", "verificacao"]) })
  .strict();
const pedidoSchema = z
  .object({
    clienteId: uuid,
    planoId: uuid,
    motivo: z.string().trim().min(1).max(2000),
    itens: z.array(itemSchema).min(1).max(25),
    proximo: z.number().int().nonnegative(),
    resultados: z.array(resultadoSchema).max(25).optional(),
  })
  .strict()
  .superRefine((p, ctx) => {
    if (
      p.proximo > p.itens.length ||
      new Set(p.itens.map((i) => i.preparadaId.toLowerCase())).size !== p.itens.length ||
      new Set(p.itens.map((i) => i.requestId.toLowerCase())).size !== p.itens.length
    )
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Tentativa divergente." });
    if (
      p.resultados &&
      (p.resultados.length !== p.proximo ||
        p.resultados.some((r, i) => r.preparadaId !== p.itens[i]?.preparadaId))
    )
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Recibos divergentes." });
  });
type Pedido = z.infer<typeof pedidoSchema>;
type Item = {
  preparada_id: string;
  vencimento_original: string;
  rotina_id: string;
  alvo_id: string;
};
type Props = {
  userId: string;
  clienteId: string;
  planoId: string;
  itens: Item[];
  carregando: boolean;
  tipo?: "calendario" | "visita";
};
export function IncluirFilaSelecionada(props: Props) {
  return (
    <Conteudo
      key={JSON.stringify([
        props.userId,
        props.clienteId,
        props.planoId,
        props.tipo ?? "calendario",
      ])}
      {...props}
    />
  );
}
function Conteudo({ userId, clienteId, planoId, itens, carregando, tipo = "calendario" }: Props) {
  const chave = `${tipo === "visita" ? "sso-fila-visitas-selecionadas" : "sso-fila-selecionada"}:${JSON.stringify([userId, clienteId, planoId])}`;
  const cache = useQueryClient();
  const trava = useRef(false);
  const montado = useRef(false);
  useEffect(() => {
    montado.current = true;
    return () => {
      montado.current = false;
    };
  }, []);
  const [selecionadas, setSelecionadas] = useState<string[]>([]);
  const [motivo, setMotivo] = useState("");
  const [confirmacao, setConfirmacao] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState(false);
  const [aviso, setAviso] = useState("");
  const [resultados, setResultados] = useState<z.infer<typeof resultadoSchema>[]>([]);
  const [pendente, setPendente] = useState<Pedido | "invalido" | null>(() => {
    try {
      const raw = sessionStorage.getItem(chave);
      if (!raw) return null;
      const p = pedidoSchema.parse(JSON.parse(raw));
      return p.clienteId === clienteId && p.planoId === planoId ? p : "invalido";
    } catch {
      return "invalido";
    }
  });
  async function sessao() {
    const r = await supabase.auth.getUser();
    if (!montado.current || r.error || r.data.user?.id !== userId)
      throw new Error("Sessão ou contexto alterado.");
  }
  const escolhidas = itens.filter((i) => selecionadas.includes(i.preparada_id));
  const fotografia = JSON.stringify([userId, clienteId, planoId, escolhidas, motivo.trim()]);
  async function executar(inicial: Pedido) {
    if (trava.current) return;
    trava.current = true;
    setOcupado(true);
    setAviso("");
    let atual = inicial;
    try {
      while (atual.proximo < atual.itens.length) {
        await sessao();
        if (sessionStorage.getItem(chave) !== JSON.stringify(atual))
          throw new Error("Tentativa alterada.");
        const item = atual.itens[atual.proximo];
        if (!item) throw new Error("Item da tentativa indisponível.");
        const { data, error } = await supabase
          .schema("pcm")
          .rpc(tipo === "visita" ? "sso_alterar_fila_visita" : "sso_alterar_fila_preventiva_pcm", {
            p_request_id: item.requestId,
            p_cliente_id: clienteId,
            p_plano_id: planoId,
            p_preparada_id: item.preparadaId,
            p_acao: "incluir",
            p_expected_revision: 0,
            p_motivo: atual.motivo,
          });
        if (error) throw error;
        const r = z
          .object({
            requestId: uuid,
            clienteId: uuid,
            planoId: uuid,
            preparadaId: uuid,
            cicloId: uuid,
            estado: z.enum(["aguardando", "verificacao"]),
            revision: z.literal(1),
            osCriada: z.literal(false),
            tarefaAuvoCriada: z.literal(false),
          })
          .strict()
          .parse(data);
        if (
          r.requestId !== item.requestId ||
          r.clienteId !== clienteId ||
          r.planoId !== planoId ||
          r.preparadaId !== item.preparadaId
        )
          throw new Error("Recibo divergente.");
        await sessao();
        if (sessionStorage.getItem(chave) !== JSON.stringify(atual))
          throw new Error("Tentativa alterada.");
        const recibos = atual.resultados
          ? [
              ...atual.resultados,
              { preparadaId: r.preparadaId, cicloId: r.cicloId, estado: r.estado },
            ]
          : undefined;
        const proximo = pedidoSchema.parse({
          ...atual,
          proximo: atual.proximo + 1,
          ...(recibos ? { resultados: recibos } : {}),
        });
        sessionStorage.setItem(chave, JSON.stringify(proximo));
        atual = proximo;
        setPendente(proximo);
      }
      await sessao();
      if (sessionStorage.getItem(chave) !== JSON.stringify(atual))
        throw new Error("Tentativa alterada.");
      sessionStorage.removeItem(chave);
      setPendente(null);
      setSelecionadas([]);
      setConfirmacao(null);
      setResultados(atual.resultados ?? []);
      setAviso(
        "Entradas registradas. Confira cada estado: verificação não comprova execução nem ausência de OS.",
      );
    } catch {
      if (montado.current)
        setAviso(
          `Sequência interrompida após ${atual.proximo} de ${atual.itens.length} confirmações. Repita a mesma tentativa; em conflito consulte suporte.`,
        );
    } finally {
      trava.current = false;
      if (montado.current) setOcupado(false);
      void cache.invalidateQueries({
        queryKey: ["fila-preventiva-pcm", userId, clienteId, planoId],
      });
    }
  }
  function iniciar() {
    if (
      trava.current ||
      pendente ||
      carregando ||
      !motivo.trim() ||
      confirmacao !== fotografia ||
      !escolhidas.length ||
      escolhidas.length !== selecionadas.length
    )
      return;
    try {
      const p = pedidoSchema.parse({
        clienteId,
        planoId,
        motivo,
        itens: escolhidas.map((i) => ({
          preparadaId: i.preparada_id,
          requestId: crypto.randomUUID(),
          vencimento: i.vencimento_original,
          rotinaId: i.rotina_id,
          alvoId: i.alvo_id,
        })),
        proximo: 0,
        resultados: [],
      });
      if (sessionStorage.getItem(chave) !== null) throw new Error("Tentativa existente.");
      sessionStorage.setItem(chave, JSON.stringify(p));
      setPendente(p);
      setResultados([]);
      void executar(p);
    } catch {
      setAviso("Seleção ou armazenamento inválido; nada enviado.");
    }
  }
  return (
    <section
      aria-label={
        tipo === "visita"
          ? "Incluir Visitas selecionadas na fila"
          : "Incluir ciclos selecionados na fila"
      }
    >
      <h5>{tipo === "visita" ? "Incluir Visitas selecionadas" : "Incluir ciclos selecionados"}</h5>
      <p>
        Selecione até 25 {tipo === "visita" ? "ocorrências de Visita" : "ciclos"} já preparados. O
        processamento é sequencial, um por vez; não é um lote atômico. Se um item falhar ou a
        conexão cair, os anteriores permanecem incluídos. Retome a mesma sequência para continuar
        pelo item pendente e confira o resultado de cada um. O servidor decide elegibilidade. Não
        prepara ciclos retroativos, OS ou tarefas Auvo.
      </p>
      {pendente === "invalido" && <p role="alert">Tentativa local ilegível; procure suporte.</p>}
      {pendente && pendente !== "invalido" ? (
        <>
          <output className="block">
            Confirmações: {pendente.proximo} de {pendente.itens.length}.{" "}
            {ocupado
              ? "Processando a próxima inclusão…"
              : "A sequência pode ser retomada pelo próximo item; os já confirmados permanecem incluídos."}
          </output>
          {pendente.resultados && (
            <ul>
              {pendente.resultados.map((r) => (
                <li key={r.preparadaId}>
                  Ocorrência {r.preparadaId} ·{" "}
                  {r.estado === "aguardando" ? "aguardando" : "verificação necessária"}
                </li>
              ))}
            </ul>
          )}
          <button type="button" disabled={ocupado} onClick={() => void executar(pendente)}>
            Retomar mesma sequência
          </button>
        </>
      ) : (
        !pendente && (
          <>
            <ul>
              {itens.map((i) => (
                <li key={i.preparada_id}>
                  <label>
                    <input
                      type="checkbox"
                      checked={selecionadas.includes(i.preparada_id)}
                      disabled={
                        carregando ||
                        ocupado ||
                        (!selecionadas.includes(i.preparada_id) && selecionadas.length >= 25)
                      }
                      onChange={(e) => {
                        const marcada = e.target.checked;
                        setConfirmacao(null);
                        setSelecionadas((atuais) =>
                          marcada
                            ? [...atuais, i.preparada_id]
                            : atuais.filter((id) => id !== i.preparada_id),
                        );
                      }}
                    />{" "}
                    {i.vencimento_original} · rotina {i.rotina_id} · alvo {i.alvo_id} · ocorrência{" "}
                    {i.preparada_id}
                  </label>
                </li>
              ))}
            </ul>
            <label>
              Motivo{" "}
              <textarea
                maxLength={2000}
                value={motivo}
                onChange={(e) => {
                  setMotivo(e.target.value);
                  setConfirmacao(null);
                }}
              />
            </label>
            <label>
              <input
                type="checkbox"
                checked={confirmacao === fotografia}
                disabled={
                  carregando ||
                  ocupado ||
                  !escolhidas.length ||
                  escolhidas.length !== selecionadas.length
                }
                onChange={(e) => setConfirmacao(e.target.checked ? fotografia : null)}
              />{" "}
              Conferi {tipo === "visita" ? "as Visitas" : "os ciclos"} e o motivo para este Cliente.
            </label>
            <button
              type="button"
              disabled={
                carregando ||
                ocupado ||
                !motivo.trim() ||
                !escolhidas.length ||
                escolhidas.length !== selecionadas.length ||
                confirmacao !== fotografia
              }
              onClick={iniciar}
            >
              Incluir selecionadas
            </button>
          </>
        )
      )}
      {resultados.length > 0 && (
        <ul aria-label="Resultado da inclusão">
          {resultados.map((r) => (
            <li key={r.preparadaId}>
              Ocorrência {r.preparadaId} ·{" "}
              {r.estado === "aguardando" ? "aguardando" : "verificação necessária"}
            </li>
          ))}
        </ul>
      )}
      {aviso && <output className="block">{aviso}</output>}
    </section>
  );
}

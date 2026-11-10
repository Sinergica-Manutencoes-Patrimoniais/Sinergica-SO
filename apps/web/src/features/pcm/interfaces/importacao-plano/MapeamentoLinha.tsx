import { useState } from "react";
import { useInfiniteQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { listarAlvosCronograma, listarMapeamentosCronograma, mapearLinhaCronograma, type PedidoMapeamento } from "../../infrastructure/supabase-importacao-plano-adapter";
import { ToleranciaLinha } from "./ToleranciaLinha";

export function MapeamentoLinha({ userId, clienteId, loteId, revisao }: {
  userId: string; clienteId: string; loteId: string; revisao: number;
}) {
  const cache = useQueryClient();
  const [linha, setLinha] = useState("");
  const [disciplina, setDisciplina] = useState("");
  const [nome, setNome] = useState("");
  const [tipo, setTipo] = useState<PedidoMapeamento["alvoTipo"]>("sistema");
  const [alvo, setAlvo] = useState("");
  const [busca, setBusca] = useState("");
  const [modo, setModo] = useState<PedidoMapeamento["modo"]>("calendario");
  const [intervalo, setIntervalo] = useState("1");
  const [unidade, setUnidade] = useState<PedidoMapeamento["unidade"]>("meses");
  const [base, setBase] = useState("");
  const [tempo, setTempo] = useState("");
  const [premissa, setPremissa] = useState<PedidoMapeamento["premissaMensal"] | "">("");
  const storageKey = `sso-cronograma-mapeamento:${JSON.stringify([userId, clienteId, loteId])}`;
  const [pedido, setPedido] = useState<PedidoMapeamento | "invalido" | null>(() => {
    try {
      const salvo = sessionStorage.getItem(storageKey);
      if (!salvo) return null;
      const valor = JSON.parse(salvo) as PedidoMapeamento;
      if (valor && valor.loteId === loteId && typeof valor.requestId === "string" &&
        Number.isSafeInteger(valor.expectedRevision) && Number.isSafeInteger(valor.numeroLinha) &&
        typeof valor.alvoId === "string" && typeof valor.nomeRotina === "string" &&
        typeof valor.disciplina === "string" && Number.isSafeInteger(valor.intervalo) &&
        ["sistema", "componente", "grupo"].includes(valor.alvoTipo) &&
        ["calendario", "visita"].includes(valor.modo) &&
        ["dias", "semanas", "meses", "anos"].includes(valor.unidade) &&
        ["nao_aplicavel", "calendario_real", "quatro_semanas"].includes(valor.premissaMensal)) return valor;
      return "invalido";
    } catch { return "invalido"; }
  });
  const [mensagem, setMensagem] = useState("");
  const alvos = useInfiniteQuery({
    queryKey: ["importacao-plano", userId, clienteId, "alvos", tipo, busca],
    initialPageParam: null as string | null,
    queryFn: ({ pageParam, signal }) => listarAlvosCronograma(clienteId, tipo, busca, pageParam, signal),
    getNextPageParam: (pagina) => pagina.length === 50 ? pagina.at(-1)?.id : undefined,
    gcTime: 0,
  });
  const mapeamentos = useInfiniteQuery({
    queryKey: ["importacao-plano", userId, clienteId, "mapeamentos", loteId],
    initialPageParam: null as string | null,
    queryFn: ({ pageParam, signal }) => listarMapeamentosCronograma(clienteId, loteId, pageParam, signal),
    getNextPageParam: (pagina) => pagina.length === 50 ? pagina.at(-1)?.chave : undefined,
    gcTime: 0,
  });
  const operacao = useMutation({
    mutationFn: mapearLinhaCronograma,
    onSuccess: async () => {
      await Promise.all([cache.invalidateQueries({ queryKey: ["conferencia-integrada-cronograma", userId, clienteId, loteId] }), cache.invalidateQueries({ queryKey: ["diagnostico-cronograma", userId, clienteId, loteId] }), cache.invalidateQueries({ queryKey: ["importacao-plano", userId, clienteId] })]);
      try { sessionStorage.removeItem(storageKey); }
      catch { setMensagem("Pedido concluído, mas não foi possível limpar a tentativa local. Procure suporte."); return; }
      setPedido(null);
      setMensagem("Mapeamento registrado para conferência; nenhuma Rotina foi criada.");
    },
    onError: () => setMensagem("Resultado não confirmado. Repita o mesmo pedido ou procure suporte; não crie outro mapeamento até conferir."),
  });
  return <div><form onSubmit={(event) => {
    event.preventDefault();
    if (pedido) return;
    const numeroLinha = Number(linha), n = Number(intervalo), minutos = tempo === "" ? null : Number(tempo);
    if (!premissa || !Number.isSafeInteger(numeroLinha) || numeroLinha < 1 || !Number.isSafeInteger(n) || n < 1 ||
      (minutos !== null && (!Number.isSafeInteger(minutos) || minutos < 1))) {
      setMensagem("Confira linha, intervalo e duração em minutos."); return;
    }
    if (premissa === "quatro_semanas" && (n !== 4 || unidade !== "semanas")) {
      setMensagem("Quatro semanas exige intervalo 4 e unidade semanas."); return;
    }
    if (premissa === "calendario_real" && unidade !== "meses") {
      setMensagem("Calendário real exige unidade meses."); return;
    }
    const proximo: PedidoMapeamento = { requestId: crypto.randomUUID(), loteId, expectedRevision: revisao,
      numeroLinha, disciplina: disciplina.trim(), nomeRotina: nome.trim(), alvoTipo: tipo, alvoId: alvo.trim(),
      modo, intervalo: n, unidade, dataBase: base || null, tempoMinutos: minutos, premissaMensal: premissa };
    try {
      if (sessionStorage.getItem(storageKey) !== null) {
        setMensagem("Há tentativa anterior nesta sessão. Reabra a conferência para recuperá-la."); return;
      }
      sessionStorage.setItem(storageKey, JSON.stringify(proximo));
    }
    catch { setMensagem("Não foi possível preservar a tentativa; nada foi enviado."); return; }
    setPedido(proximo); setMensagem(""); operacao.mutate(proximo);
  }}>
    <fieldset disabled={!!pedido || operacao.isPending}>
      <legend>Mapear linha para futura revisão</legend>
      <label>Linha <input required type="number" min="1" value={linha} onChange={(e) => setLinha(e.target.value)} /></label>
      <label>Disciplina <input required maxLength={200} value={disciplina} onChange={(e) => setDisciplina(e.target.value)} /></label>
      <label>Nome da Rotina <input required maxLength={200} value={nome} onChange={(e) => setNome(e.target.value)} /></label>
      <label>Tipo de alvo <select value={tipo} onChange={(e) => { setTipo(e.target.value as PedidoMapeamento["alvoTipo"]); setAlvo(""); }}>
        <option value="sistema">Sistema</option><option value="componente">Componente</option><option value="grupo">Grupo Quantitativo</option>
      </select></label>
      <label>Buscar alvo <input maxLength={120} value={busca} onChange={(e) => { setBusca(e.target.value); setAlvo(""); }} /></label>
      {alvos.isPending && <p>Carregando alvos…</p>}
      {alvos.isError && <p role="alert">Não foi possível carregar alvos. <button type="button" onClick={() => void alvos.refetch()}>Tentar novamente</button></p>}
      <label>Alvo existente <select required value={alvo} onChange={(e) => setAlvo(e.target.value)}>
        <option value="">Selecione</option>{alvos.data?.pages.flat().map((item) => <option key={item.id} value={item.id}>{item.nome}</option>)}
      </select></label>
      {alvos.hasNextPage && <button type="button" onClick={() => void alvos.fetchNextPage()}>Mais alvos</button>}
      <label>Modo <select value={modo} onChange={(e) => setModo(e.target.value as PedidoMapeamento["modo"])}>
        <option value="calendario">Por calendário</option><option value="visita">Por Visita</option>
      </select></label>
      <label>Intervalo <input required type="number" min="1" max="1000" value={intervalo} onChange={(e) => setIntervalo(e.target.value)} /></label>
      <label>Unidade <select value={unidade} onChange={(e) => setUnidade(e.target.value as PedidoMapeamento["unidade"])}>
        <option value="dias">Dias</option><option value="semanas">Semanas</option><option value="meses">Meses</option><option value="anos">Anos</option>
      </select></label>
      <label>Data-base <input type="date" required={modo === "calendario"} value={base} onChange={(e) => setBase(e.target.value)} /></label>
      <label>Duração em minutos (vazio: tempo a validar) <input type="number" min="1" value={tempo} onChange={(e) => setTempo(e.target.value)} /></label>
      <label>Premissa mensal da fonte <select required value={premissa} onChange={(e) => setPremissa(e.target.value as PedidoMapeamento["premissaMensal"] | "")}>
        <option value="">Selecione após conferir a fonte</option>
        <option value="nao_aplicavel">Não aplicável</option><option value="calendario_real">Calendário real</option><option value="quatro_semanas">Quatro semanas</option>
      </select></label>
      <button type="submit">Guardar mapeamento</button>
    </fieldset>
    {pedido === "invalido" && <p role="alert">Tentativa local ilegível. Procure suporte antes de continuar.</p>}
    {pedido && pedido !== "invalido" && <p>Há tentativa pendente nesta sessão. <button type="button" disabled={operacao.isPending} onClick={() => operacao.mutate(pedido)}>Repetir mesmo pedido</button></p>}
    {mensagem && <p role="status">{mensagem}</p>}
  </form>
  {mapeamentos.isPending && <p>Carregando mapeamentos…</p>}
  {mapeamentos.isError && <p role="alert">Não foi possível carregar mapeamentos. <button type="button" onClick={() => void mapeamentos.refetch()}>Tentar novamente</button></p>}
  {mapeamentos.data && <ul>{mapeamentos.data.pages.flat().map((m) => <li key={m.chave}>
    Linha {m.chave}: {m.disciplina} · {m.nome} · {m.alvoTipo} {m.alvoId} · {m.modo} · revisão {m.revisao}
    {import.meta.env.VITE_SSO_TOLERANCIA_CRONOGRAMA_ENABLED === "true" && <ToleranciaLinha userId={userId} clienteId={clienteId} loteId={loteId} revisao={revisao} chave={m.chave} mapeamentoId={m.id} />}
  </li>)}</ul>}
  {mapeamentos.hasNextPage && <button type="button" onClick={() => void mapeamentos.fetchNextPage()}>Mais mapeamentos</button>}
  </div>;
}

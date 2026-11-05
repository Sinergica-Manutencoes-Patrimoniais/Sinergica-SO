import { Button } from "@sinergica/ui";
import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRef, useState } from "react";
import {
  criarRegraContratual,
  validarCriacaoRegraContratual,
} from "../../application/calendario-contratual";
import type { CriarRegraContratualCommand } from "../../application/calendario-contratual-gateway";
import { supabaseCalendarioContratualAdapter } from "../../infrastructure/supabase-calendario-contratual-adapter";
import { supabaseCapacidadesSsoAdapter } from "../../infrastructure/supabase-capacidades-sso-adapter";
import { SimulacaoRegra } from "./SimulacaoRegra";
import { AlterarDiaContratual } from "./AlterarDiaContratual";
import { FeriadosDeclarados } from "./FeriadosDeclarados";

const dias = ["Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado", "Domingo"];
const limite = 20;
const proximo = <T extends { id: string }>(pagina: T[]) =>
  pagina.length === limite ? pagina.at(-1)?.id : undefined;

type Props = { userId: string; clienteId: string; clienteNome: string };
export function CalendarioContratualWorkspace(props: Props) {
  return <ConteudoCalendario key={JSON.stringify([props.userId, props.clienteId])} {...props} />;
}

function ConteudoCalendario({ userId, clienteId, clienteNome }: Props) {
  const chave = `sso-calendario-pendente:${userId}:${clienteId}`;
  const [recuperacao] = useState(() => {
    try {
      const valor = sessionStorage.getItem(chave);
      const comando = valor ? validarCriacaoRegraContratual(JSON.parse(valor)) : null;
      if (comando && comando.clienteId !== clienteId) throw new Error("Cliente divergente");
      return { comando, falhou: false };
    } catch {
      return { comando: null, falhou: true };
    }
  });
  const [pendente, setPendente] = useState(recuperacao.comando);
  const [aberto, setAberto] = useState(false);
  const [contrato, setContrato] = useState("");
  const [inicio, setInicio] = useState("");
  const [fim, setFim] = useState("");
  const [ancora, setAncora] = useState("");
  const [dia, setDia] = useState("");
  const [intervalo, setIntervalo] = useState("1");
  const [hora, setHora] = useState("");
  const [duracao, setDuracao] = useState("");
  const [deslocamento, setDeslocamento] = useState("0");
  const [fuso, setFuso] = useState("America/Sao_Paulo");
  const [erro, setErro] = useState("");
  const [sucesso, setSucesso] = useState("");
  const [simulacaoId, setSimulacaoId] = useState<string | null>(null);
  const [feriadosSimulados, setFeriadosSimulados] = useState<{
    contratoId: string | null;
    datas: string[];
    periodo: { inicio: string; fim: string };
  } | null>(null);
  const emEnvio = useRef(false);
  const queryClient = useQueryClient();
  const raiz = ["calendario-contratual", userId, clienteId] as const;
  const permissao = useQuery({
    queryKey: [...raiz, "permissao"],
    queryFn: () => supabaseCapacidadesSsoAdapter.autorizarAcao("plano.gerir", clienteId),
    gcTime: 0,
    refetchOnWindowFocus: true,
  });
  const permitido = permissao.data === true && !permissao.isFetching && !permissao.isError;
  const contratos = useInfiniteQuery({
    queryKey: [...raiz, "contratos"],
    initialPageParam: null as string | null,
    queryFn: ({ pageParam, signal }) =>
      supabaseCalendarioContratualAdapter.listarContratos(clienteId, limite, pageParam, signal),
    getNextPageParam: proximo,
    enabled: permitido,
    gcTime: 0,
  });
  const regras = useInfiniteQuery({
    queryKey: [...raiz, "regras"],
    initialPageParam: null as string | null,
    queryFn: ({ pageParam, signal }) =>
      supabaseCalendarioContratualAdapter.listarRegras(clienteId, limite, pageParam, signal),
    getNextPageParam: proximo,
    enabled: permitido,
    gcTime: 0,
  });
  const salvar = useMutation({
    mutationFn: (c: CriarRegraContratualCommand) => {
      if (c.clienteId !== clienteId) throw new Error("Cliente divergente.");
      return criarRegraContratual(supabaseCalendarioContratualAdapter, c);
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: [...raiz, "regras"] }),
  });
  if (permissao.isPending || permissao.isFetching)
    return <output>Verificando acesso ao calendário…</output>;
  if (permissao.isError)
    return (
      <p role="alert">
        Não foi possível verificar acesso.{" "}
        <button type="button" onClick={() => void permissao.refetch()}>
          Tentar novamente
        </button>
      </p>
    );
  if (!permissao.data) return <p>Você está sem permissão para gerir o calendário deste Cliente.</p>;
  async function enviar(c: CriarRegraContratualCommand) {
    if (emEnvio.current) return;
    try {
      if (sessionStorage.getItem(chave) !== JSON.stringify(c))
        throw new Error("Tentativa alterada.");
    } catch {
      setErro("Tentativa guardada indisponível ou alterada. Consulte o suporte.");
      return;
    }
    emEnvio.current = true;
    setErro("");
    try {
      await salvar.mutateAsync(c);
      if (sessionStorage.getItem(chave) !== JSON.stringify(c))
        throw new Error("Tentativa alterada após confirmação.");
      sessionStorage.removeItem(chave);
      setPendente(null);
      setAberto(false);
      setContrato("");
      setInicio("");
      setFim("");
      setAncora("");
      setDia("");
      setIntervalo("1");
      setHora("");
      setDuracao("");
      setDeslocamento("0");
      setFuso("America/Sao_Paulo");
      setSucesso("Regra contratual cadastrada. Nenhuma Visita foi criada.");
    } catch (falha) {
      const codigo =
        typeof falha === "object" && falha !== null && "code" in falha ? String(falha.code) : "";
      if (["22023", "23514", "23P01", "40001", "42501"].includes(codigo)) {
        try {
          if (sessionStorage.getItem(chave) !== JSON.stringify(c))
            throw new Error("Tentativa alterada.");
          sessionStorage.removeItem(chave);
          setPendente(null);
          setContrato(c.contratoId);
          setInicio(c.vigenciaInicio);
          setFim(c.vigenciaFim ?? "");
          setAncora(c.ancoraSemana);
          setDia(String(c.diaSemana));
          setIntervalo(String(c.intervaloSemanas));
          setHora(c.horaInicio);
          setDuracao(String(c.duracaoMinutos));
          setDeslocamento(String(c.deslocamentoMinutos));
          setFuso(c.fuso);
          setAberto(true);
          setErro(
            codigo === "42501"
              ? "Sem acesso ao contrato. Confira o Cliente e sua permissão."
              : "A regra foi recusada. Confira datas, fuso e parâmetros antes de salvar novamente.",
          );
          return;
        } catch {
          /* Preserva operação incerta se não puder limpar armazenamento. */
        }
      }
      setErro("Não foi possível confirmar o salvamento. Tente novamente com os mesmos dados.");
    } finally {
      emEnvio.current = false;
    }
  }
  function iniciar() {
    if (emEnvio.current || pendente) return;
    setErro("");
    setSucesso("");
    try {
      if (contratos.isFetching || contratos.isError || !opcoes.some((c) => c.id === contrato))
        throw new Error("Contrato indisponível para seleção.");
      const comando = validarCriacaoRegraContratual({
        requestId: crypto.randomUUID(),
        expectedRevision: 0,
        clienteId,
        serieId: crypto.randomUUID(),
        regraId: crypto.randomUUID(),
        contratoId: contrato,
        ancoraSemana: ancora,
        diaSemana: Number(dia),
        intervaloSemanas: Number(intervalo),
        horaInicio: hora,
        duracaoMinutos: Number(duracao),
        deslocamentoMinutos: Number(deslocamento),
        fuso,
        vigenciaInicio: inicio,
        vigenciaFim: fim || null,
      });
      if (sessionStorage.getItem(chave) !== null) throw new Error("Tentativa existente.");
      sessionStorage.setItem(chave, JSON.stringify(comando));
      setPendente(comando);
      void enviar(comando);
    } catch {
      setErro("Confira contrato, datas, dia, horário, duração e armazenamento antes de salvar.");
    }
  }
  const itens = regras.isFetching || regras.isError ? [] : (regras.data?.pages.flat() ?? []);
  const opcoes =
    contratos.isFetching || contratos.isError ? [] : (contratos.data?.pages.flat() ?? []);
  return (
    <section
      aria-label="Calendário contratual"
      className="rounded-lg border border-line bg-surface p-4"
    >
      <h2 className="text-body font-semibold text-ink">Calendário contratual</h2>
      <p>Regras de {clienteNome}. Cadastrar uma regra não cria Visitas nem tarefas.</p>
      {import.meta.env.VITE_SSO_FERIADOS_DECLARADOS_ENABLED === "true" && (
        <FeriadosDeclarados
          userId={userId}
          clienteId={clienteId}
          contratos={opcoes}
          regras={itens}
          onUsar={(contratoId, datas, periodo) =>
            setFeriadosSimulados(periodo ? { contratoId, datas, periodo } : null)
          }
        />
      )}
      {recuperacao.falhou && (
        <p role="alert">
          Não foi possível recuperar operação anterior. Consulte o suporte antes de cadastrar outra
          regra.
        </p>
      )}
      {erro && <p role="alert">{erro}</p>}
      {sucesso && <output>{sucesso}</output>}
      {pendente && (
        <Button
          variant="secondary"
          disabled={salvar.isPending}
          onClick={() => void enviar(pendente)}
        >
          Tentar salvar regra novamente
        </Button>
      )}
      {!aberto && !pendente && !recuperacao.falhou && (
        <Button
          variant="secondary"
          onClick={() => {
            setAberto(true);
            setErro("");
            setSucesso("");
          }}
        >
          Nova regra contratual
        </Button>
      )}
      {aberto && !pendente && !recuperacao.falhou && (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            iniciar();
          }}
        >
          {contratos.isPending && <output>Carregando contratos…</output>}
          {contratos.isFetching && !contratos.isPending && <output>Atualizando contratos…</output>}
          {contratos.isError && (
            <p role="alert">
              Não foi possível carregar contratos.{" "}
              <button type="button" onClick={() => void contratos.refetch()}>
                Tentar novamente
              </button>
            </p>
          )}
          {!contratos.isFetching &&
            !contratos.isPending &&
            !contratos.isError &&
            opcoes.length === 0 && <p>Nenhum contrato cadastrado para este Cliente.</p>}
          <label>
            Contrato
            <select
              className="input"
              required
              disabled={contratos.isFetching || contratos.isError}
              value={contrato}
              onChange={(e) => setContrato(e.target.value)}
            >
              <option value="">Selecione</option>
              {contrato &&
                !contratos.isFetching &&
                !contratos.isError &&
                !opcoes.some((c) => c.id === contrato) && (
                  <option value={contrato}>Contrato selecionado fora da lista</option>
                )}
              {opcoes.map((c) => (
                <option key={c.id} value={c.id}>
                  Contrato {c.id} — {c.tipo} — {c.status} — início {c.vigenciaInicio}
                </option>
              ))}
            </select>
          </label>
          {contratos.hasNextPage && (
            <Button
              type="button"
              variant="secondary"
              disabled={contratos.isFetchingNextPage}
              onClick={() => void contratos.fetchNextPage()}
            >
              Mais contratos
            </Button>
          )}
          <label>
            Início da vigência
            <input
              className="input"
              required
              type="date"
              value={inicio}
              onChange={(e) => setInicio(e.target.value)}
            />
          </label>
          <label>
            Fim da vigência (opcional)
            <input
              className="input"
              type="date"
              value={fim}
              onChange={(e) => setFim(e.target.value)}
            />
          </label>
          <label>
            Segunda-feira de referência
            <input
              className="input"
              required
              type="date"
              value={ancora}
              onChange={(e) => setAncora(e.target.value)}
            />
          </label>
          <label>
            Dia contratual
            <select className="input" required value={dia} onChange={(e) => setDia(e.target.value)}>
              <option value="">Selecione</option>
              {dias.map((nome, i) => (
                <option key={nome} value={i + 1}>
                  {nome}
                </option>
              ))}
            </select>
          </label>
          <label>
            Intervalo em semanas
            <input
              className="input"
              required
              type="number"
              min="1"
              step="1"
              value={intervalo}
              onChange={(e) => setIntervalo(e.target.value)}
            />
          </label>
          <label>
            Horário de início
            <input
              className="input"
              required
              type="time"
              value={hora}
              onChange={(e) => setHora(e.target.value)}
            />
          </label>
          <label>
            Duração em minutos
            <input
              className="input"
              required
              type="number"
              min="1"
              step="1"
              value={duracao}
              onChange={(e) => setDuracao(e.target.value)}
            />
          </label>
          <label>
            Deslocamento em minutos
            <input
              className="input"
              required
              type="number"
              min="0"
              step="1"
              value={deslocamento}
              onChange={(e) => setDeslocamento(e.target.value)}
            />
          </label>
          <label>
            Fuso horário
            <input
              className="input"
              required
              value={fuso}
              onChange={(e) => setFuso(e.target.value)}
            />
          </label>
          <Button
            type="submit"
            disabled={
              salvar.isPending ||
              contratos.isFetching ||
              contratos.isPending ||
              contratos.isError ||
              !opcoes.some((c) => c.id === contrato)
            }
          >
            Salvar regra
          </Button>
          <Button type="button" variant="secondary" onClick={() => setAberto(false)}>
            Cancelar
          </Button>
        </form>
      )}
      {regras.isPending && <output>Carregando regras…</output>}
      {regras.isFetching && !regras.isPending && <output>Atualizando regras…</output>}
      {regras.isError && (
        <p role="alert">
          Não foi possível carregar regras.{" "}
          <button type="button" onClick={() => void regras.refetch()}>
            Tentar novamente
          </button>
        </p>
      )}
      {!regras.isFetching && !regras.isPending && !regras.isError && itens.length === 0 && (
        <p>Nenhuma regra contratual cadastrada.</p>
      )}
      <ul>
        {itens.map((r) => (
          <li key={r.id}>
            Contrato {r.contratoId}: {dias[r.diaSemana - 1]} às {r.horaInicio.slice(0, 5)} · a cada{" "}
            {r.intervaloSemanas} semana(s) · {r.duracaoMinutos} min · vigência {r.vigenciaInicio}
            {r.vigenciaFim ? ` a ${r.vigenciaFim}` : " em diante"} · versão {r.numero}
            <p>Segunda-feira de referência {r.ancoraSemana}</p>
            <p>Fuso {r.fuso}</p>
            <p>Deslocamento {r.deslocamentoMinutos} min</p>
            {import.meta.env.VITE_SSO_ALTERAR_DIA_CONTRATUAL_ENABLED === "true" && (
              <AlterarDiaContratual userId={userId} clienteId={clienteId} regra={r} />
            )}
            <Button
              type="button"
              variant="secondary"
              aria-expanded={simulacaoId === r.id}
              onClick={() => setSimulacaoId(simulacaoId === r.id ? null : r.id)}
            >
              {simulacaoId === r.id ? "Fechar simulação" : "Simular regra"}
            </Button>
            {simulacaoId === r.id && (
              <SimulacaoRegra
                key={r.id}
                regra={r}
                feriadosDeclarados={
                  feriadosSimulados &&
                  (feriadosSimulados.contratoId === null ||
                    feriadosSimulados.contratoId === r.contratoId)
                    ? feriadosSimulados.datas
                    : []
                }
                periodoDeclaracoes={
                  feriadosSimulados &&
                  (feriadosSimulados.contratoId === null ||
                    feriadosSimulados.contratoId === r.contratoId)
                    ? feriadosSimulados.periodo
                    : null
                }
              />
            )}
          </li>
        ))}
      </ul>
      {regras.hasNextPage && (
        <Button
          variant="secondary"
          disabled={regras.isFetchingNextPage}
          onClick={() => void regras.fetchNextPage()}
        >
          Mais regras
        </Button>
      )}
    </section>
  );
}

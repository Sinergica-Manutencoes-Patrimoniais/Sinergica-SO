import { Button } from "@sinergica/ui";
import { useInfiniteQuery } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { supabase } from "../../../../lib/supabase-client";
import { validarRotinaCompleta } from "../../application/plano-manutencao";
import type {
  EditarRotinaCommand,
  PlanoResumo,
  RotinaDetalhe,
} from "../../application/plano-manutencao-gateway";
import {
  useAdicionarRotinaCompleta,
  useEditarRotina,
} from "../../application/plano-manutencao-queries";
import { supabasePlanoManutencaoAdapter } from "../../infrastructure/supabase-plano-manutencao-adapter";

type OpcaoTipo = "sistema" | "componente" | "grupo" | "questionario";
function Seletor({
  userId,
  clienteId,
  planoId,
  tipo,
  rotulo,
  value,
  onChange,
  obrigatorio = false,
}: {
  userId: string;
  clienteId: string;
  planoId: string;
  tipo: OpcaoTipo;
  rotulo: string;
  value: string;
  onChange: (id: string) => void;
  obrigatorio?: boolean;
}) {
  const [busca, setBusca] = useState("");
  const opcoes = useInfiniteQuery({
    queryKey: ["plano-manutencao-alvos", userId, clienteId, planoId, tipo, busca],
    initialPageParam: null as string | null,
    queryFn: async ({ pageParam, signal }) => {
      const antes = await supabase.auth.getUser();
      if (antes.error || antes.data.user?.id !== userId || signal.aborted)
        throw new Error("Sessão alterada.");
      const pagina = await supabasePlanoManutencaoAdapter.listarAlvos(
        planoId,
        tipo,
        20,
        pageParam,
        busca || null,
        signal,
      );
      const depois = await supabase.auth.getUser();
      if (depois.error || depois.data.user?.id !== userId || signal.aborted)
        throw new Error("Sessão alterada.");
      return pagina;
    },
    getNextPageParam: (ultima) => (ultima.length === 20 ? ultima.at(-1)?.id : undefined),
    placeholderData: (dados, anterior) =>
      anterior?.queryKey[1] === userId &&
      anterior.queryKey[2] === clienteId &&
      anterior.queryKey[3] === planoId &&
      anterior.queryKey[4] === tipo
        ? dados
        : undefined,
    gcTime: 0,
  });
  const disponiveis =
    !opcoes.isError && !opcoes.isPlaceholderData && !opcoes.isPending && !opcoes.isFetching;
  const itens = disponiveis ? (opcoes.data?.pages.flat() ?? []) : [];
  return (
    <div>
      <label>
        Buscar {rotulo}
        <input
          className="input"
          maxLength={120}
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
        />
      </label>
      <label>
        {rotulo}
        <select
          className="input"
          required={obrigatorio}
          disabled={!disponiveis}
          value={value}
          onChange={(e) => onChange(e.target.value)}
        >
          <option value="">{obrigatorio ? "Selecione" : "Nenhum"}</option>
          {value && !itens.some((i) => i.id === value) && (
            <option value={value}>Seleção atual fora da lista</option>
          )}
          {itens.map((i) => (
            <option key={i.id} value={i.id}>
              {i.nome}
            </option>
          ))}
        </select>
      </label>
      {opcoes.isPending && <output>Carregando opções…</output>}
      {opcoes.isError && (
        <div role="alert">
          Não foi possível carregar opções.{" "}
          <button type="button" onClick={() => void opcoes.refetch()}>
            Tentar novamente
          </button>
        </div>
      )}
      {opcoes.hasNextPage && (
        <Button
          type="button"
          variant="secondary"
          disabled={opcoes.isFetching || opcoes.isPlaceholderData}
          onClick={() => void opcoes.fetchNextPage()}
        >
          Mais opções de {rotulo}
        </Button>
      )}
    </div>
  );
}

export function FormularioRotina({
  userId,
  clienteId,
  plano,
  rotina = null,
  consultaDisponivel,
  onCancelar,
  onAtualizar,
}: {
  userId: string;
  clienteId: string;
  plano: PlanoResumo;
  rotina?: RotinaDetalhe | null;
  consultaDisponivel: boolean;
  onCancelar: () => void;
  onAtualizar: () => void;
}) {
  const chave = `sso-rotina-${rotina ? `editar:${rotina.id}` : "nova"}:${userId}:${clienteId}:${plano.id}`;
  const [recuperacao] = useState(() => {
    try {
      const valor = sessionStorage.getItem(chave);
      const comando = valor ? validarRotinaCompleta(JSON.parse(valor)) : null;
      if (comando && comando.planoId !== plano.id) throw new Error("Plano divergente");
      if (comando && rotina && comando.rotinaId !== rotina.id) throw new Error("Rotina divergente");
      return { comando, falhou: false };
    } catch {
      return { comando: null, falhou: true };
    }
  });
  const [pendente, setPendente] = useState(recuperacao.comando);
  const [revisaoInicial] = useState(plano.revisao);
  const revisaoMudou = plano.revisao !== revisaoInicial;
  const [nome, setNome] = useState(rotina?.nome ?? "");
  const [tipo, setTipo] = useState<"sistema" | "componente" | "grupo">(
    rotina?.alvoTipo ?? "sistema",
  );
  const [alvo, setAlvo] = useState(rotina?.alvoId ?? "");
  const [modo, setModo] = useState<"calendario" | "visita">(rotina?.modo ?? "calendario");
  const [intervalo, setIntervalo] = useState(
    rotina?.intervalo == null ? "" : String(rotina.intervalo),
  );
  const [unidade, setUnidade] = useState<"dias" | "semanas" | "meses" | "anos">(
    rotina?.unidade ?? "meses",
  );
  const [dataBase, setDataBase] = useState(rotina?.dataBase ?? "");
  const [tempo, setTempo] = useState(
    rotina?.tempoMinutos == null ? "" : String(rotina.tempoMinutos),
  );
  const [tipoTempo, setTipoTempo] = useState<"" | "total" | "por_unidade">(rotina?.tipoTempo ?? "");
  const [antes, setAntes] = useState(String(rotina?.toleranciaAntes ?? 0));
  const [depois, setDepois] = useState(String(rotina?.toleranciaDepois ?? 0));
  const [instrucao, setInstrucao] = useState(rotina?.instrucao ?? "");
  const [questionario, setQuestionario] = useState(rotina?.questionarioId ?? "");
  const [erro, setErro] = useState("");
  const enviando = useRef(false);
  const montado = useRef(false);
  useEffect(() => { montado.current = true; return () => { montado.current = false; }; }, []);
  const adicionar = useAdicionarRotinaCompleta(supabasePlanoManutencaoAdapter, userId, clienteId);
  const editar = useEditarRotina(supabasePlanoManutencaoAdapter, userId, clienteId);
  const salvar = rotina ? editar : adicionar;
  async function conferirSessao() {
    const atual = await supabase.auth.getUser();
    if (atual.error || atual.data.user?.id !== userId || !montado.current) throw new Error("Sessão alterada.");
  }
  async function enviar(comando: EditarRotinaCommand, primeiraTentativa = false) {
    if (!consultaDisponivel || enviando.current) return;
    enviando.current = true;
    setErro("");
    try {
      await conferirSessao();
      if (sessionStorage.getItem(chave) !== JSON.stringify(comando)) {
        setErro("Tentativa local alterada ou indisponível. Procure suporte antes de reenviar.");
        return;
      }
      const recibo = await salvar.mutateAsync(comando);
      if (
        recibo.requestId !== comando.requestId || recibo.aggregateId !== comando.planoId ||
        recibo.revision !== comando.expectedRevision + 1 || recibo.created !== (rotina === null) ||
        recibo.linkedIds.clienteId !== clienteId || recibo.linkedIds.rotinaId !== comando.rotinaId
      ) throw new Error("Recibo de Rotina divergente.");
      await conferirSessao();
      if (sessionStorage.getItem(chave) !== JSON.stringify(comando)) {
        setErro(
          "Rotina salva, mas a tentativa local mudou. Procure suporte; o registro foi preservado.",
        );
        onAtualizar();
        return;
      }
      sessionStorage.removeItem(chave);
      setPendente(null);
      onCancelar();
    } catch (falha) {
      if (
        primeiraTentativa &&
        typeof falha === "object" &&
        falha !== null &&
        "code" in falha &&
        (["22023", "23514"].includes(String(falha.code)) ||
          (falha.code === "P0011" && "message" in falha && falha.message === "revisao_obsoleta"))
      ) {
        try {
          await conferirSessao();
          if (sessionStorage.getItem(chave) !== JSON.stringify(comando)) {
            setErro("Tentativa local alterada. Procure suporte antes de criar outra operação.");
            return;
          }
          sessionStorage.removeItem(chave);
          setPendente(null);
          if (falha.code === "P0011") {
            setErro("O Plano mudou. Feche o formulário e confira os dados atualizados.");
            onAtualizar();
            return;
          }
          setNome(comando.nome);
          setTipo(comando.alvoTipo);
          setAlvo(comando.alvoId);
          setModo(comando.modo);
          setIntervalo(comando.intervalo === null ? "" : String(comando.intervalo));
          setUnidade(comando.unidade ?? "meses");
          setDataBase(comando.dataBase ?? "");
          setTempo(comando.tempoMinutos === null ? "" : String(comando.tempoMinutos));
          setTipoTempo(comando.tipoTempo ?? "");
          setAntes(String(comando.toleranciaAntes));
          setDepois(String(comando.toleranciaDepois));
          setInstrucao(comando.instrucao ?? "");
          setQuestionario(comando.questionarioId ?? "");
          setErro(
            "O servidor rejeitou os dados. Confira e corrija a Rotina antes de salvar novamente.",
          );
          return;
        } catch {
          /* Mantém o pedido se o armazenamento falhar. */
        }
      }
      const codigo =
        typeof falha === "object" && falha !== null && "code" in falha ? String(falha.code) : "";
      const mensagem =
        typeof falha === "object" && falha !== null && "message" in falha ? falha.message : "";
      setErro(
        codigo === "42501"
          ? "Permissão indisponível. O pedido permanece pendente para conferência."
          : codigo === "55P03" && mensagem === "autorizacao_em_alteracao"
            ? "As permissões estão sendo atualizadas. Aguarde e repita o mesmo pedido."
            : "Não foi possível confirmar o salvamento. Tente novamente com os mesmos dados.",
      );
    } finally {
      enviando.current = false;
    }
  }
  function iniciar() {
    if (!consultaDisponivel || revisaoMudou || enviando.current || pendente) return;
    const comando: EditarRotinaCommand = {
      requestId: crypto.randomUUID(),
      expectedRevision: revisaoInicial,
      planoId: plano.id,
      rotinaId: rotina?.id ?? crypto.randomUUID(),
      nome,
      alvoTipo: tipo,
      alvoId: alvo,
      modo,
      intervalo: intervalo === "" ? null : Number(intervalo),
      unidade: intervalo === "" ? null : unidade,
      dataBase: dataBase || null,
      tempoMinutos: tempo === "" ? null : Number(tempo),
      tipoTempo: tipoTempo || null,
      toleranciaAntes: Number(antes),
      toleranciaDepois: Number(depois),
      instrucao: instrucao || null,
      questionarioId: questionario || null,
    };
    try {
      const sufixo = `:${userId}:${clienteId}:${plano.id}`;
      for (let i = 0; i < sessionStorage.length; i++) {
        const item = sessionStorage.key(i);
        if (
          item &&
          item.endsWith(sufixo) &&
          (item.startsWith("sso-rotina-") || item === `sso-plano-revisao${sufixo}`)
        ) {
          setErro(
            "Existe uma operação pendente neste Plano. Confira e resolva o pedido anterior antes de salvar.",
          );
          return;
        }
      }
      const validado = validarRotinaCompleta(comando);
      sessionStorage.setItem(chave, JSON.stringify(validado));
      setPendente(validado);
      void enviar(validado, true);
    } catch {
      setErro("Confira nome, alvo, recorrência, tempo e tolerâncias antes de salvar.");
    }
  }
  return (
    <section
      aria-label={rotina ? "Editar Rotina" : "Nova Rotina"}
      className="my-3 rounded-md border border-line p-3"
    >
      {recuperacao.falhou && (
        <p role="alert">
          Não foi possível recuperar uma operação anterior. Consulte o suporte antes de criar outra
          Rotina.
        </p>
      )}
      {erro && <p role="alert">{erro}</p>}
      {!consultaDisponivel && (
        <p role="alert">Consulta indisponível. Aguarde ou tente novamente antes de salvar.</p>
      )}
      {revisaoMudou && !pendente && (
        <p role="alert">
          O Plano mudou. Cancele e confira os dados atualizados antes de editar novamente.
        </p>
      )}
      {pendente && (
        <div>
          <p>Há uma Rotina aguardando confirmação.</p>
          <Button
            type="button"
            disabled={salvar.isPending || !consultaDisponivel}
            onClick={() => void enviar(pendente)}
          >
            Tentar salvar Rotina novamente
          </Button>
        </div>
      )}
      {!recuperacao.falhou && !pendente && (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            iniciar();
          }}
          className="grid gap-3"
        >
          <label>
            Nome da Rotina
            <input
              className="input"
              required
              maxLength={200}
              value={nome}
              onChange={(e) => setNome(e.target.value)}
            />
          </label>
          <label>
            Tipo de alvo
            <select
              className="input"
              value={tipo}
              onChange={(e) => {
                setTipo(e.target.value as typeof tipo);
                setAlvo("");
              }}
            >
              <option value="sistema">Sistema</option>
              <option value="componente">Componentes / Equipamentos</option>
              <option value="grupo">Grupo Quantitativo</option>
            </select>
          </label>
          {tipo === "componente" && (
            <p>
              Equipamentos e Componentes usam o cadastro existente. A seleção identifica o registro
              pelo seu ID; a classificação técnica deve ser conferida no cadastro.
            </p>
          )}
          <Seletor
            userId={userId}
            clienteId={clienteId}
            planoId={plano.id}
            tipo={tipo}
            rotulo="Alvo da Rotina"
            value={alvo}
            onChange={setAlvo}
            obrigatorio
          />
          <label>
            Modo
            <select
              className="input"
              value={modo}
              onChange={(e) => setModo(e.target.value as typeof modo)}
            >
              <option value="calendario">Por calendário</option>
              <option value="visita">Por Visita</option>
            </select>
          </label>
          <label>
            Intervalo
            <input
              className="input"
              type="number"
              min="1"
              step="1"
              value={intervalo}
              onChange={(e) => setIntervalo(e.target.value)}
            />
          </label>
          <label>
            Unidade da recorrência
            <select
              className="input"
              value={unidade}
              onChange={(e) => setUnidade(e.target.value as typeof unidade)}
            >
              <option value="dias">Dias</option>
              <option value="semanas">Semanas</option>
              <option value="meses">Meses</option>
              <option value="anos">Anos</option>
            </select>
          </label>
          <label>
            Data-base
            <input
              className="input"
              type="date"
              value={dataBase}
              onChange={(e) => setDataBase(e.target.value)}
            />
          </label>
          <label>
            Tempo estimado em minutos
            <input
              className="input"
              type="number"
              min="0"
              step="1"
              value={tempo}
              onChange={(e) => setTempo(e.target.value)}
            />
          </label>
          <label>
            Referência do tempo
            <select
              className="input"
              value={tipoTempo}
              onChange={(e) => setTipoTempo(e.target.value as typeof tipoTempo)}
            >
              <option value="">A validar</option>
              <option value="total">Total</option>
              <option value="por_unidade">Por unidade</option>
            </select>
          </label>
          <label>
            Dias permitidos antes
            <input
              className="input"
              type="number"
              min="0"
              step="1"
              required
              value={antes}
              onChange={(e) => setAntes(e.target.value)}
            />
          </label>
          <label>
            Dias permitidos depois
            <input
              className="input"
              type="number"
              min="0"
              step="1"
              required
              value={depois}
              onChange={(e) => setDepois(e.target.value)}
            />
          </label>
          <label>
            Instrução
            <textarea
              className="input"
              maxLength={10000}
              value={instrucao}
              onChange={(e) => setInstrucao(e.target.value)}
            />
          </label>
          <Seletor
            userId={userId}
            clienteId={clienteId}
            planoId={plano.id}
            tipo="questionario"
            rotulo="Questionário"
            value={questionario}
            onChange={setQuestionario}
          />
          <div>
            <Button
              type="submit"
              disabled={salvar.isPending || !consultaDisponivel || revisaoMudou}
            >
              Salvar Rotina
            </Button>{" "}
            <Button type="button" variant="secondary" onClick={onCancelar}>
              Cancelar
            </Button>
          </div>
        </form>
      )}
    </section>
  );
}

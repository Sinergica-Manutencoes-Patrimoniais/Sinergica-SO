import { useQuery } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { supabase } from "../../../../lib/supabase-client";
import { validarComandoGrupo } from "../../application/estrutura-tecnica";
import type {
  GrupoQuantitativo,
  SalvarGrupoCommand,
} from "../../application/estrutura-tecnica-gateway";
import { useGruposQuantitativos } from "../../application/estrutura-tecnica-queries";
import { supabaseCapacidadesSsoAdapter } from "../../infrastructure/supabase-capacidades-sso-adapter";
import { supabaseEstruturaTecnicaAdapter } from "../../infrastructure/supabase-estrutura-tecnica-adapter";
import { HistoricoCadastroLevantamento } from "../levantamentos/HistoricoCadastroLevantamento";
import { PendenciasDoAlvo } from "../pendencias-tecnicas/PendenciasDoAlvo";
import { ResultadosDoAlvo } from "../pendencias-tecnicas/ResultadosAtivo";
import { AtribuirCodigoGrupo } from "./AtribuirCodigoGrupo";
import { CodigoAtualGrupo } from "./CodigoAtualGrupo";
import { DiagnosticoAncestraisGrupos } from "./DiagnosticoAncestraisGrupos";
import { DiagnosticoVinculosGrupos } from "./DiagnosticoVinculosGrupos";
import { DocumentosStagingAtivo } from "./DocumentosStagingAtivo";
import { EstadoGrupo, GruposInativos } from "./EstadoGrupo";
import { FotosGrupo } from "./FotosGrupo";
import { FotosStagingGrupo } from "./FotosStagingGrupo";
import { FotosVerificadasGrupo } from "./FotosVerificadasGrupo";
import { HierarquiaGrupos } from "./HierarquiaGrupos";
import { HistoricoGrupo } from "./HistoricoGrupo";
import { MoverGrupo } from "./MoverGrupo";
import { PlanosDoAlvo } from "./PlanosDoAlvo";
import { QuantidadeMotivadaGrupo } from "./QuantidadeMotivadaGrupo";
import { ReclassificarGrupo } from "./ReclassificarGrupo";
import { RemoverCaracteristicaGrupo } from "./RemoverCaracteristicaGrupo";

type GruposQuantitativosProps = {
  userId: string;
  clienteId: string;
  locais: { id: string; nome: string }[];
  categorias?: { id: string; nome: string }[];
  sistemas?: { id: string; nome: string }[];
};

export function GruposQuantitativos(props: GruposQuantitativosProps) {
  return (
    <GruposQuantitativosContexto key={JSON.stringify([props.userId, props.clienteId])} {...props} />
  );
}

function GruposQuantitativosContexto({
  userId,
  clienteId,
  locais,
  categorias = [],
  sistemas = [],
}: GruposQuantitativosProps) {
  const chavePendente = `sso-grupo-pendente:${userId}:${clienteId}`;
  const [aberto, setAberto] = useState(false);
  const [historicoId, setHistoricoId] = useState<string | null>(null);
  const [editando, setEditando] = useState<GrupoQuantitativo | null>(null);
  const [nome, setNome] = useState("");
  const [quantidade, setQuantidade] = useState("");
  const [localId, setLocalId] = useState("");
  const [categoriaId, setCategoriaId] = useState("");
  const [sistemaId, setSistemaId] = useState("");
  const [filtroLocal, setFiltroLocal] = useState("");
  const [filtroSistema, setFiltroSistema] = useState("");
  const [filtroCategoria, setFiltroCategoria] = useState("");
  const [atributos, setAtributos] = useState<{ id: string; nome: string; valor: string }[]>([]);
  const [erroSalvar, setErroSalvar] = useState("");
  const emEnvio = useRef(false);
  const montado = useRef(false);
  useEffect(() => {
    montado.current = true;
    return () => {
      montado.current = false;
    };
  }, []);
  async function conferirSessao() {
    const { data, error } = await supabase.auth.getUser();
    if (error || data.user?.id !== userId || !montado.current) throw new Error("Sessão alterada.");
  }
  const [recuperacao] = useState(() => {
    try {
      const valor = sessionStorage.getItem(chavePendente);
      return { comando: valor ? validarComandoGrupo(JSON.parse(valor)) : null, falhou: false };
    } catch {
      return { comando: null, falhou: true };
    }
  });
  const [pendente, setPendente] = useState<SalvarGrupoCommand | null>(recuperacao.comando);
  const permissao = useQuery({
    queryKey: ["estrutura-tecnica", userId, clienteId, "permissao-leitura"],
    queryFn: async () => {
      const [leitura, gestao] = await Promise.all([
        supabaseCapacidadesSsoAdapter.autorizarAcao("cadastro.ler", clienteId),
        supabaseCapacidadesSsoAdapter.autorizarAcao("cadastro.gerir", clienteId),
      ]);
      return { leitura: leitura || gestao, gestao };
    },
    enabled: Boolean(userId && clienteId),
    gcTime: 0,
    refetchOnWindowFocus: true,
  });
  const { grupos, salvar } = useGruposQuantitativos(
    supabaseEstruturaTecnicaAdapter,
    userId,
    clienteId,
    permissao.data?.leitura === true && !permissao.isFetching && !permissao.isError,
  );
  if (permissao.isPending || permissao.isFetching)
    return <output>Verificando acesso aos grupos…</output>;
  if (permissao.isError)
    return (
      <section>
        <p role="alert">Não foi possível verificar acesso aos grupos.</p>
        <button type="button" onClick={() => void permissao.refetch()}>
          Tentar novamente
        </button>
      </section>
    );
  if (!permissao.data?.leitura) return null;
  const itens = grupos.data?.pages.flat() ?? [];
  const correspondeFiltro = (grupo: GrupoQuantitativo) =>
    (!filtroLocal || grupo.localId === filtroLocal) &&
    (!filtroSistema ||
      (filtroSistema === "sem-sistema"
        ? grupo.sistemaId === null
        : grupo.sistemaId === filtroSistema)) &&
    (!filtroCategoria || grupo.categoriaId === filtroCategoria);
  const edicaoDesatualizada = Boolean(
    editando &&
      !itens.some((grupo) => grupo.id === editando.id && grupo.revisao === editando.revisao),
  );
  const edicaoIndisponivel = Boolean(
    editando && (grupos.isFetching || grupos.isError || edicaoDesatualizada),
  );
  const grupoAtual =
    editando && !grupos.isFetching && !grupos.isError
      ? itens.find((grupo) => grupo.id === editando.id)
      : undefined;
  function removerPendenteCorrespondente(comando: SalvarGrupoCommand) {
    if (sessionStorage.getItem(chavePendente) !== JSON.stringify(comando)) {
      throw new Error("A operação guardada foi alterada.");
    }
    sessionStorage.removeItem(chavePendente);
  }
  function restaurarEdicao(comando: SalvarGrupoCommand) {
    setNome(comando.nome);
    setQuantidade(String(comando.quantidade));
    setLocalId(comando.localId);
    setCategoriaId(comando.categoriaId);
    setSistemaId(comando.sistemaId ?? "");
    setAtributos(
      Object.entries(comando.caracteristicas).map(([nome, valor]) => ({
        id: crypto.randomUUID(),
        nome,
        valor,
      })),
    );
    setEditando(
      comando.expectedRevision > 0
        ? {
            id: comando.grupoId,
            clienteId,
            localId: comando.localId,
            categoriaId: comando.categoriaId,
            sistemaId: comando.sistemaId,
            nome: comando.nome,
            quantidade: comando.quantidade,
            caracteristicas: comando.caracteristicas,
            revisao: comando.expectedRevision,
          }
        : null,
    );
    setAberto(true);
  }
  async function enviar(comando: SalvarGrupoCommand, primeiraTentativa = false) {
    if (emEnvio.current) return;
    emEnvio.current = true;
    setErroSalvar("");
    try {
      if (sessionStorage.getItem(chavePendente) !== JSON.stringify(comando)) {
        setErroSalvar(
          "Operação local alterada ou indisponível. Consulte suporte antes de repetir.",
        );
        return;
      }
      await conferirSessao();
      if (sessionStorage.getItem(chavePendente) !== JSON.stringify(comando))
        throw new Error("Operação local alterada.");
      const recibo = await salvar.mutateAsync(comando);
      if (
        recibo.requestId !== comando.requestId ||
        recibo.aggregateId !== comando.grupoId ||
        recibo.revision !== comando.expectedRevision + 1 ||
        recibo.created !== (comando.expectedRevision === 0) ||
        recibo.linkedIds.clienteId !== clienteId ||
        recibo.linkedIds.localId !== comando.localId ||
        (recibo.linkedIds.sistemaId ?? null) !== comando.sistemaId
      )
        throw new Error("Recibo divergente.");
      await conferirSessao();
      removerPendenteCorrespondente(comando);
      setPendente(null);
      setAberto(false);
      setEditando(null);
      setNome("");
      setQuantidade("");
      setLocalId("");
      setCategoriaId("");
      setSistemaId("");
      setAtributos([]);
    } catch (erro) {
      if (
        primeiraTentativa &&
        typeof erro === "object" &&
        erro !== null &&
        "code" in erro &&
        (erro.code === "22023" || erro.code === "23514")
      ) {
        try {
          await conferirSessao();
          removerPendenteCorrespondente(comando);
          setPendente(null);
          restaurarEdicao(comando);
          setErroSalvar(
            "O servidor rejeitou os dados. Confira Local, categoria, Sistema e quantidade; corrija e salve novamente.",
          );
          return;
        } catch {
          /* Conserva a operação quando não for possível removê-la da sessão. */
        }
      }
      setErroSalvar(
        "Não foi possível confirmar o salvamento. Tente novamente com os mesmos dados.",
      );
    } finally {
      emEnvio.current = false;
    }
  }
  function iniciarSalvamento() {
    if (edicaoIndisponivel || emEnvio.current) return;
    const nomes = atributos.map((a) => a.nome);
    if (nomes.some((nome) => !nome.trim()) || new Set(nomes).size !== nomes.length) {
      setErroSalvar("Informe nomes diferentes para todas as características.");
      return;
    }
    const comando: SalvarGrupoCommand = {
      requestId: crypto.randomUUID(),
      expectedRevision: editando?.revisao ?? 0,
      grupoId: editando?.id ?? crypto.randomUUID(),
      localId,
      categoriaId,
      sistemaId: sistemaId || null,
      nome: nome.trim(),
      quantidade: Number(quantidade),
      caracteristicas: Object.fromEntries(atributos.map((a) => [a.nome, a.valor])),
    };
    try {
      validarComandoGrupo(comando);
    } catch {
      setErroSalvar("Confira nome, Local, categoria e quantidade antes de salvar.");
      return;
    }
    try {
      if (sessionStorage.getItem(chavePendente) !== null) {
        setErroSalvar(
          "Existe uma operação pendente. Reabra esta tela para recuperá-la antes de salvar.",
        );
        return;
      }
      sessionStorage.setItem(chavePendente, JSON.stringify(comando));
    } catch {
      setErroSalvar(
        "Não foi possível guardar a operação para recuperação. Verifique o armazenamento do navegador.",
      );
      return;
    }
    setPendente(comando);
    void enviar(comando, true);
  }
  return (
    <section
      className="rounded-lg border border-line bg-card p-4"
      aria-label="Grupos Quantitativos"
    >
      <h2 className="font-semibold text-ink">Grupos Quantitativos</h2>
      <HierarquiaGrupos userId={userId} clienteId={clienteId} />
      <DiagnosticoVinculosGrupos userId={userId} clienteId={clienteId} />
      <DiagnosticoAncestraisGrupos userId={userId} clienteId={clienteId} />
      <p className="text-caption text-ink-3">
        Unidades homogêneas agrupadas por Local, sem cadastro individual.
      </p>
      {recuperacao.falhou && (
        <p role="alert">
          Não foi possível recuperar uma operação anterior. Não inicie outro cadastro até verificar
          a situação com o suporte.
        </p>
      )}
      {!aberto && !pendente && erroSalvar && <p role="alert">{erroSalvar}</p>}
      {permissao.data.gestao && !aberto && !pendente && !recuperacao.falhou && (
        <button
          type="button"
          onClick={() => {
            setEditando(null);
            setNome("");
            setQuantidade("");
            setLocalId("");
            setCategoriaId("");
            setSistemaId("");
            setAtributos([]);
            setErroSalvar("");
            setAberto(true);
          }}
        >
          Novo grupo
        </button>
      )}
      {permissao.data.gestao && pendente && (
        <div>
          <p>
            {erroSalvar || "Há um salvamento aguardando confirmação. Retome com os mesmos dados."}
          </p>
          {erroSalvar && <p role="alert">{erroSalvar}</p>}
          <button type="button" disabled={salvar.isPending} onClick={() => void enviar(pendente)}>
            {salvar.isPending ? "Salvando…" : "Tentar salvar novamente"}
          </button>
        </div>
      )}
      {permissao.data.gestao && aberto && !pendente && (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            iniciarSalvamento();
          }}
        >
          <label>
            Nome do grupo
            <input
              className="input"
              required
              maxLength={200}
              value={nome}
              onChange={(e) => setNome(e.target.value)}
            />
          </label>
          <label>
            Quantidade
            <input
              className="input"
              type="number"
              min="1"
              max="9007199254740991"
              step="1"
              required
              value={quantidade}
              onChange={(e) => setQuantidade(e.target.value)}
            />
          </label>
          <label>
            Local
            <select
              className="input"
              required
              value={localId}
              onChange={(e) => setLocalId(e.target.value)}
            >
              <option value="">Selecione</option>
              {locais.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.nome}
                </option>
              ))}
            </select>
          </label>
          <label>
            Sistema
            <select
              className="input"
              value={sistemaId}
              onChange={(e) => setSistemaId(e.target.value)}
            >
              <option value="">Sem Sistema vinculado</option>
              {sistemas.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.nome}
                </option>
              ))}
              {sistemaId && !sistemas.some((s) => s.id === sistemaId) && (
                <option value={sistemaId}>Sistema indisponível</option>
              )}
            </select>
          </label>
          <fieldset>
            <legend>Características técnicas</legend>
            {atributos.map((a, i) => (
              <div key={a.id}>
                <label>
                  Nome da característica {i + 1}
                  <input
                    className="input"
                    value={a.nome}
                    onChange={(e) =>
                      setAtributos((atual) =>
                        atual.map((item) =>
                          item.id === a.id ? { ...item, nome: e.target.value } : item,
                        ),
                      )
                    }
                  />
                </label>
                <label>
                  Valor da característica {i + 1}
                  <input
                    className="input"
                    value={a.valor}
                    onChange={(e) =>
                      setAtributos((atual) =>
                        atual.map((item) =>
                          item.id === a.id ? { ...item, valor: e.target.value } : item,
                        ),
                      )
                    }
                  />
                </label>
                <button
                  type="button"
                  aria-label={`Remover característica ${i + 1}`}
                  onClick={() => setAtributos((atual) => atual.filter((item) => item.id !== a.id))}
                >
                  Remover
                </button>
              </div>
            ))}
            <button
              type="button"
              onClick={() =>
                setAtributos((atual) => [
                  ...atual,
                  { id: crypto.randomUUID(), nome: "", valor: "" },
                ])
              }
            >
              Adicionar característica
            </button>
          </fieldset>
          <label>
            Categoria
            <select
              className="input"
              required
              value={categoriaId}
              onChange={(e) => setCategoriaId(e.target.value)}
            >
              <option value="">Selecione</option>
              {categorias.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.nome}
                </option>
              ))}
            </select>
          </label>
          {erroSalvar && <p role="alert">{erroSalvar}</p>}
          {editando && grupos.isError && (
            <p role="alert">
              Não foi possível conferir a revisão. Atualize a lista antes de salvar.
            </p>
          )}
          {editando && !grupos.isFetching && !grupos.isError && edicaoDesatualizada && (
            <div role="alert">
              <p>
                A revisão mudou ou o grupo não está mais disponível. Seus dados digitados foram
                preservados.
              </p>
              {grupoAtual && (
                <>
                  <p>
                    Revisão atual {grupoAtual.revisao}: {grupoAtual.nome} · {grupoAtual.quantidade}{" "}
                    unidades ·{" "}
                    {locais.find((local) => local.id === grupoAtual.localId)?.nome ??
                      "Local indisponível"}{" "}
                    ·{" "}
                    {categorias.find((categoria) => categoria.id === grupoAtual.categoriaId)
                      ?.nome ?? "Categoria indisponível"}{" "}
                    ·{" "}
                    {grupoAtual.sistemaId
                      ? (sistemas.find((sistema) => sistema.id === grupoAtual.sistemaId)?.nome ??
                        "Sistema indisponível")
                      : "sem Sistema"}
                    .
                  </p>
                  <p>Características atuais:</p>
                  {Object.keys(grupoAtual.caracteristicas).length ? (
                    <ul>
                      {Object.entries(grupoAtual.caracteristicas).map(([chave, valor]) => (
                        <li key={chave}>
                          {chave}: {valor}
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p>Nenhuma característica informada.</p>
                  )}
                  <p>
                    Compare com os campos acima. Adotar esta revisão mantém seus campos digitados;
                    salvar ainda será uma ação separada.
                  </p>
                  <button
                    type="button"
                    onClick={() => {
                      setEditando(grupoAtual);
                      setErroSalvar("");
                    }}
                  >
                    Adotar revisão atual e manter edição
                  </button>
                </>
              )}
              {!grupoAtual && (
                <p>
                  Atualize a lista ou cancele a edição; não é possível adotar uma revisão
                  indisponível.
                </p>
              )}
            </div>
          )}
          <button
            type="submit"
            disabled={edicaoIndisponivel || grupos.isFetching || grupos.isError}
          >
            Salvar grupo
          </button>{" "}
          <button type="button" onClick={() => setAberto(false)}>
            Cancelar
          </button>
        </form>
      )}
      {grupos.isPending && <output>Carregando grupos…</output>}
      {grupos.isFetching && !grupos.isPending && <output>Atualizando grupos…</output>}
      {grupos.isError && (
        <div role="alert">
          Não foi possível carregar os grupos.{" "}
          <button type="button" onClick={() => void grupos.refetch()}>
            Tentar novamente
          </button>
        </div>
      )}
      {!grupos.isPending && !grupos.isFetching && !grupos.isError && itens.length === 0 && (
        <p>Nenhum grupo cadastrado neste Cliente.</p>
      )}
      {!grupos.isPending && !grupos.isFetching && !grupos.isError && itens.length > 0 && (
        <fieldset>
          <legend>Filtrar grupos nas páginas carregadas</legend>
          <label>
            Local{" "}
            <select value={filtroLocal} onChange={(e) => setFiltroLocal(e.target.value)}>
              <option value="">Todos</option>
              {locais.map((local) => (
                <option key={local.id} value={local.id}>
                  {local.nome}
                </option>
              ))}
            </select>
          </label>
          <label>
            Sistema{" "}
            <select value={filtroSistema} onChange={(e) => setFiltroSistema(e.target.value)}>
              <option value="">Todos</option>
              <option value="sem-sistema">Sem Sistema</option>
              {sistemas.map((sistema) => (
                <option key={sistema.id} value={sistema.id}>
                  {sistema.nome}
                </option>
              ))}
            </select>
          </label>
          <label>
            Categoria{" "}
            <select value={filtroCategoria} onChange={(e) => setFiltroCategoria(e.target.value)}>
              <option value="">Todas</option>
              {categorias.map((categoria) => (
                <option key={categoria.id} value={categoria.id}>
                  {categoria.nome}
                </option>
              ))}
            </select>
          </label>
          <p>
            {itens.filter(correspondeFiltro).length} grupo(s) nas páginas carregadas
            {grupos.hasNextPage ? "; carregue mais para ampliar a busca" : ""}. Quantidades não
            incluem outras páginas.
          </p>
        </fieldset>
      )}
      {!grupos.isFetching && !grupos.isError && itens.length > 0 && (
        <ul>
          {itens.map((grupo) => (
            <li key={grupo.id} hidden={!correspondeFiltro(grupo)}>
              {grupo.nome} — {grupo.quantidade} unidades ·{" "}
              {locais.find((local) => local.id === grupo.localId)?.nome ?? "Local indisponível"}
              <p>
                Categoria:{" "}
                {categorias.find((categoria) => categoria.id === grupo.categoriaId)?.nome ??
                  "indisponível"}
              </p>
              <p>
                Sistema:{" "}
                {grupo.sistemaId
                  ? (sistemas.find((sistema) => sistema.id === grupo.sistemaId)?.nome ??
                    "indisponível")
                  : "não vinculado"}
              </p>
              {Object.entries(grupo.caracteristicas ?? {}).length > 0 ? (
                <ul aria-label={`Características de ${grupo.nome}`}>
                  {Object.entries(grupo.caracteristicas).map(([nome, valor]) => (
                    <li key={nome}>
                      {nome}: {valor}
                    </li>
                  ))}
                </ul>
              ) : (
                <p>Sem características informadas.</p>
              )}
              <button
                type="button"
                aria-label={`Histórico de ${grupo.nome}`}
                onClick={() => setHistoricoId((id) => (id === grupo.id ? null : grupo.id))}
              >
                Histórico
              </button>
              {historicoId === grupo.id && (
                <HistoricoGrupo userId={userId} clienteId={clienteId} grupoId={grupo.id} />
              )}
              {correspondeFiltro(grupo) && !grupos.isFetching && (
                <ResultadosDoAlvo
                  userId={userId}
                  clienteId={clienteId}
                  tipo="grupo"
                  id={grupo.id}
                  nome={grupo.nome}
                />
              )}
              {correspondeFiltro(grupo) && !grupos.isFetching && (
                <PendenciasDoAlvo
                  userId={userId}
                  clienteId={clienteId}
                  tipo="grupo"
                  id={grupo.id}
                />
              )}
              {correspondeFiltro(grupo) && !grupos.isFetching && (
                <PlanosDoAlvo userId={userId} clienteId={clienteId} tipo="grupo" id={grupo.id} />
              )}
              <FotosGrupo
                userId={userId}
                clienteId={clienteId}
                grupoId={grupo.id}
                podeEditar={permissao.data.gestao}
              />
              <FotosStagingGrupo userId={userId} clienteId={clienteId} grupoId={grupo.id} />
              <FotosVerificadasGrupo userId={userId} clienteId={clienteId} grupoId={grupo.id} />
              <DocumentosStagingAtivo
                userId={userId}
                clienteId={clienteId}
                tipo="grupo_quantitativo"
                entidadeId={grupo.id}
              />
              <HistoricoCadastroLevantamento
                userId={userId}
                clienteId={clienteId}
                tipo="grupo_quantitativo"
                entidadeId={grupo.id}
              />
              {permissao.data.gestao && (
                <AtribuirCodigoGrupo userId={userId} clienteId={clienteId} grupoId={grupo.id} />
              )}
              <CodigoAtualGrupo userId={userId} clienteId={clienteId} grupoId={grupo.id} />
              {permissao.data.gestao && (
                <RemoverCaracteristicaGrupo
                  userId={userId}
                  clienteId={clienteId}
                  grupo={grupo}
                  disponivel={
                    !grupos.isFetching &&
                    !grupos.isError &&
                    !aberto &&
                    !pendente &&
                    !recuperacao.falhou
                  }
                />
              )}
              {permissao.data.gestao && (
                <ReclassificarGrupo
                  userId={userId}
                  clienteId={clienteId}
                  grupo={grupo}
                  categorias={categorias}
                  sistemas={sistemas}
                  disponivel={
                    !grupos.isFetching &&
                    !grupos.isError &&
                    !aberto &&
                    !pendente &&
                    !recuperacao.falhou
                  }
                />
              )}
              {permissao.data.gestao && (
                <MoverGrupo
                  userId={userId}
                  clienteId={clienteId}
                  grupo={grupo}
                  locais={locais}
                  disponivel={
                    !grupos.isFetching &&
                    !grupos.isError &&
                    !aberto &&
                    !pendente &&
                    !recuperacao.falhou
                  }
                />
              )}
              {permissao.data.gestao && (
                <QuantidadeMotivadaGrupo
                  userId={userId}
                  clienteId={clienteId}
                  grupo={grupo}
                  disponivel={
                    !grupos.isFetching &&
                    !grupos.isError &&
                    !aberto &&
                    !pendente &&
                    !recuperacao.falhou
                  }
                />
              )}
              {permissao.data.gestao && (
                <EstadoGrupo
                  userId={userId}
                  clienteId={clienteId}
                  grupoId={grupo.id}
                  nome={grupo.nome}
                  revisao={grupo.revisao}
                  ativo
                  disponivel={
                    !grupos.isFetching &&
                    !grupos.isError &&
                    !aberto &&
                    !pendente &&
                    !recuperacao.falhou
                  }
                />
              )}
              {permissao.data.gestao &&
                !grupos.isFetching &&
                !aberto &&
                !pendente &&
                !recuperacao.falhou && (
                  <button
                    type="button"
                    aria-label={`Editar ${grupo.nome}`}
                    onClick={() => {
                      setEditando(grupo);
                      setNome(grupo.nome);
                      setQuantidade(String(grupo.quantidade));
                      setLocalId(grupo.localId);
                      setCategoriaId(grupo.categoriaId);
                      setSistemaId(grupo.sistemaId ?? "");
                      setAtributos(
                        Object.entries(grupo.caracteristicas).map(([nome, valor]) => ({
                          id: crypto.randomUUID(),
                          nome,
                          valor,
                        })),
                      );
                      setErroSalvar("");
                      setAberto(true);
                    }}
                  >
                    Editar
                  </button>
                )}
            </li>
          ))}
        </ul>
      )}
      {!grupos.isFetching && !grupos.isError && grupos.hasNextPage && (
        <button
          type="button"
          disabled={grupos.isFetchingNextPage}
          onClick={() => void grupos.fetchNextPage()}
        >
          {grupos.isFetchingNextPage ? "Carregando…" : "Carregar mais"}
        </button>
      )}
      {permissao.data.gestao && (
        <GruposInativos userId={userId} clienteId={clienteId} locais={locais} />
      )}
    </section>
  );
}

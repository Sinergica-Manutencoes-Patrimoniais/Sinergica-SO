import { useInfiniteQuery, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { supabase } from "../../../../lib/supabase-client";
import {
  type InformarMaterial,
  supabaseListasMateriaisAdapter,
  validarInformarMaterial,
} from "../../infrastructure/supabase-listas-materiais-adapter";
import { DetalheEvento } from "./DetalheEvento";
import { EvidenciasExcecao } from "./EvidenciasExcecao";
import { ImpedimentoMaterialOs } from "./ImpedimentoMaterialOs";
import { ObservacoesExcecao } from "./ObservacoesExcecao";

// Os 5 tipos de evento que a lista aceita. `aquisicao`, `dispensa` e `conclusao` entraram com a
// migration 1843 e são os que levam a lista aos 3 estados do §8.2 que antes não existiam.
type TipoEvento = "disponibilidade" | "excecao" | "aquisicao" | "dispensa" | "conclusao";
export type RascunhoInformacaoMaterial = {
  tipo: TipoEvento;
  situacao: "informada_disponivel" | "parcial" | "indisponivel";
  motivo: "faltante" | "parcial" | "errado" | "novo_levantamento";
  descricao: string;
  linha: string;
  /** Motivo da dispensa (obrigatório) ou observação de aquisição/conclusão (opcional). */
  justificativa: string;
};
type Props = {
  usuario: string;
  cliente: string;
  ordemServico: string;
  listaId: string;
  revisao: number;
  rascunho?: RascunhoInformacaoMaterial;
  onRascunho?: (rascunho: RascunhoInformacaoMaterial) => void;
  onSalvo?: () => void;
};
export function DisponibilidadeMateriais(props: Props) {
  return (
    <Conteudo
      key={JSON.stringify([props.usuario, props.cliente, props.ordemServico, props.listaId])}
      {...props}
    />
  );
}
function Conteudo({
  usuario,
  cliente,
  ordemServico,
  listaId,
  revisao,
  rascunho,
  onRascunho,
  onSalvo,
}: Props) {
  const chave = `sso-evento-material:${usuario}:${cliente}:${ordemServico}:${listaId}`;
  const [recuperacao] = useState(() => {
    try {
      const valor = sessionStorage.getItem(chave);
      const comando = valor ? validarInformarMaterial(JSON.parse(valor)) : null;
      if (comando && comando.listaId !== listaId) throw new Error("Lista divergente.");
      return { comando, falhou: false };
    } catch {
      return { comando: null, falhou: true };
    }
  });
  const [pendente, setPendente] = useState(recuperacao.comando);
  const [revisaoConferida, setRevisaoConferida] = useState(revisao);
  const revisaoAlterada = revisaoConferida !== revisao;
  const [tipo, setTipo] = useState<TipoEvento>(rascunho?.tipo ?? "disponibilidade");
  const [situacao, setSituacao] = useState<"informada_disponivel" | "parcial" | "indisponivel">(
    rascunho?.situacao ?? "informada_disponivel",
  );
  const [motivo, setMotivo] = useState<"faltante" | "parcial" | "errado" | "novo_levantamento">(
    rascunho?.motivo ?? "faltante",
  );
  const [descricao, setDescricao] = useState(rascunho?.descricao ?? "");
  const [linha, setLinha] = useState(rascunho?.linha ?? "");
  const [justificativa, setJustificativa] = useState(rascunho?.justificativa ?? "");
  const estadoInicial = useRef(
    JSON.stringify({ tipo, situacao, motivo, descricao, linha, justificativa }),
  );
  const relatarRascunho = useRef(onRascunho);
  relatarRascunho.current = onRascunho;
  useEffect(() => {
    const estado = { tipo, situacao, motivo, descricao, linha, justificativa };
    if (JSON.stringify(estado) !== estadoInicial.current) relatarRascunho.current?.(estado);
  }, [tipo, situacao, motivo, descricao, linha, justificativa]);
  const [erro, setErro] = useState("");
  const [confirmacao, setConfirmacao] = useState<string | null>(null);
  const fotografia = JSON.stringify({
    usuario,
    cliente,
    ordemServico,
    listaId,
    revisao: revisaoConferida,
    tipo,
    situacao,
    motivo,
    descricao,
    linha,
    justificativa,
  });
  const [ocupado, setOcupado] = useState(false);
  const emEnvio = useRef(false);
  const client = useQueryClient();
  const raiz = ["listas-materiais", usuario, cliente, ordemServico] as const;
  const snapshot = useQuery({
    queryKey: [...raiz, "snapshot", listaId, revisao],
    queryFn: async ({ signal }) => {
      const antes = await supabase.auth.getUser();
      if (antes.error || antes.data.user?.id !== usuario || signal.aborted)
        throw new Error("Sessão alterada.");
      const dados = await supabaseListasMateriaisAdapter.obterSnapshot(listaId, revisao, signal);
      const depois = await supabase.auth.getUser();
      if (depois.error || depois.data.user?.id !== usuario || signal.aborted)
        throw new Error("Sessão alterada.");
      return dados;
    },
    enabled: tipo === "excecao" && !pendente,
    gcTime: 0,
  });
  const eventos = useInfiniteQuery({
    queryKey: [...raiz, "eventos", listaId],
    initialPageParam: 0,
    queryFn: async ({ pageParam, signal }) => {
      const antes = await supabase.auth.getUser();
      if (antes.error || antes.data.user?.id !== usuario || signal.aborted)
        throw new Error("Sessão alterada.");
      const dados = await supabaseListasMateriaisAdapter.listarEventos(
        listaId,
        20,
        pageParam,
        signal,
      );
      const depois = await supabase.auth.getUser();
      if (depois.error || depois.data.user?.id !== usuario || signal.aborted)
        throw new Error("Sessão alterada.");
      return dados;
    },
    getNextPageParam: (pagina) => (pagina.length === 20 ? pagina.at(-1)?.revisao : undefined),
    gcTime: 0,
  });
  async function enviar(comando: InformarMaterial) {
    if (emEnvio.current) return;
    emEnvio.current = true;
    setOcupado(true);
    setErro("");
    try {
      if (sessionStorage.getItem(chave) !== JSON.stringify(comando))
        throw new Error("Tentativa divergente.");
      const antes = await supabase.auth.getUser();
      if (antes.error || antes.data.user?.id !== usuario) throw new Error("Sessão alterada.");
      await supabaseListasMateriaisAdapter.informar(comando);
      const depois = await supabase.auth.getUser();
      if (depois.error || depois.data.user?.id !== usuario) throw new Error("Sessão alterada.");
      await Promise.all([
        client.invalidateQueries({ queryKey: [...raiz, "listas"] }),
        client.invalidateQueries({ queryKey: [...raiz, "eventos", listaId] }),
        client.invalidateQueries({ queryKey: ["listas-materiais-central", usuario, cliente] }),
      ]);
      const atual = await supabase.auth.getUser();
      if (
        atual.error ||
        atual.data.user?.id !== usuario ||
        sessionStorage.getItem(chave) !== JSON.stringify(comando)
      )
        throw new Error("Operação guardada divergente.");
      sessionStorage.removeItem(chave);
      setPendente(null);
      setConfirmacao(null);
      onSalvo?.();
    } catch {
      setErro(
        "Não foi possível confirmar. Tente novamente com os mesmos dados ou consulte o suporte.",
      );
    } finally {
      emEnvio.current = false;
      setOcupado(false);
    }
  }
  function iniciar() {
    if (
      pendente ||
      emEnvio.current ||
      recuperacao.falhou ||
      revisaoAlterada ||
      confirmacao !== fotografia
    )
      return;
    try {
      // `aquisicao`/`conclusao` levam observação opcional; `dispensa` exige motivo. Campo vazio
      // precisa sair do payload — o banco recusa `observacao` em branco.
      const observacao = justificativa.trim() ? { observacao: justificativa } : {};
      const evento =
        tipo === "disponibilidade"
          ? { tipo, dados: { situacao } }
          : tipo === "aquisicao" || tipo === "conclusao"
            ? { tipo, dados: observacao }
            : tipo === "dispensa"
              ? { tipo, dados: { motivo: justificativa } }
              : {
                  tipo,
                  dados: {
                    motivo,
                    descricao,
                    ...(linha
                      ? (() => {
                          const [rev = Number.NaN, indice = Number.NaN] = linha
                            .split(":")
                            .map(Number);
                          if (
                            snapshot.isFetching ||
                            snapshot.isError ||
                            !snapshot.data ||
                            rev !== snapshot.data.revisao ||
                            !Number.isSafeInteger(indice) ||
                            indice < 0 ||
                            indice >= snapshot.data.linhas.length
                          )
                            throw new Error("Linha indisponível.");
                          return { revisaoLinhas: rev, posicao: indice };
                        })()
                      : {}),
                  },
                };
      const comando = validarInformarMaterial({
        requestId: crypto.randomUUID(),
        listaId,
        expectedRevision: revisaoConferida,
        evento,
      });
      if (sessionStorage.getItem(chave) !== null) throw new Error("Operação pendente.");
      sessionStorage.setItem(chave, JSON.stringify(comando));
      setPendente(comando);
      void enviar(comando);
    } catch {
      setErro("Confira os dados e o armazenamento antes de continuar.");
    }
  }
  return (
    <section aria-label="Disponibilidade e exceções de materiais">
      <p>
        Disponibilidade é informativa e não comprova conferência física. Registrar exceção não
        altera a OS.
      </p>
      {recuperacao.falhou && <p role="alert">Operação guardada inválida. Consulte o suporte.</p>}
      {erro && <p role="alert">{erro}</p>}
      {revisaoAlterada && !pendente && (
        <p role="alert">
          A lista mudou desde o início da informação. Confira a revisão atual; a linha de exceção
          precisará ser escolhida novamente.{" "}
          <button
            type="button"
            disabled={ocupado}
            onClick={() => {
              setRevisaoConferida(revisao);
              setLinha("");
            }}
          >
            Conferi a lista atual
          </button>
        </p>
      )}
      {pendente && (
        <button type="button" disabled={ocupado} onClick={() => void enviar(pendente)}>
          Tentar informar novamente
        </button>
      )}
      {!pendente && !recuperacao.falhou && (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            iniciar();
          }}
        >
          <label>
            Tipo de informação{" "}
            <select value={tipo} onChange={(e) => setTipo(e.target.value as typeof tipo)}>
              <option value="disponibilidade">Disponibilidade</option>
              <option value="excecao">Exceção em campo</option>
              <option value="aquisicao">Aquisição pela Sinérgica</option>
              <option value="dispensa">Dispensar lista</option>
              <option value="conclusao">Concluir lista</option>
            </select>
          </label>
          {tipo === "disponibilidade" ? (
            <label>
              Situação informada{" "}
              <select
                value={situacao}
                onChange={(e) => setSituacao(e.target.value as typeof situacao)}
              >
                <option value="informada_disponivel">Disponível</option>
                <option value="parcial">Parcial</option>
                <option value="indisponivel">Indisponível</option>
              </select>
            </label>
          ) : tipo === "aquisicao" || tipo === "conclusao" ? (
            <>
              <p>
                {tipo === "aquisicao"
                  ? "Aquisição é fornecimento ao Cliente pela Sinérgica; só vale para lista sob responsabilidade da Sinérgica."
                  : "Concluir encerra a lista em definitivo: depois disso nenhum evento é aceito. Só é possível a partir de Disponível ou Parcial."}
              </p>
              <label>
                Observação (opcional){" "}
                <textarea
                  maxLength={4000}
                  value={justificativa}
                  onChange={(e) => setJustificativa(e.target.value)}
                />
              </label>
            </>
          ) : tipo === "dispensa" ? (
            <>
              <p>
                Dispensar a lista interrompe o fluxo de materiais. Só volta atrás por exceção com
                motivo &quot;novo levantamento&quot;.
              </p>
              <label>
                Motivo da dispensa{" "}
                <textarea
                  required
                  maxLength={4000}
                  value={justificativa}
                  onChange={(e) => setJustificativa(e.target.value)}
                />
              </label>
            </>
          ) : (
            <>
              <label>
                Motivo{" "}
                <select value={motivo} onChange={(e) => setMotivo(e.target.value as typeof motivo)}>
                  <option value="faltante">Faltante</option>
                  <option value="parcial">Parcial</option>
                  <option value="errado">Errado</option>
                  <option value="novo_levantamento">Novo levantamento</option>
                </select>
              </label>
              <label>
                Descrição{" "}
                <textarea
                  required
                  maxLength={4000}
                  value={descricao}
                  onChange={(e) => setDescricao(e.target.value)}
                />
              </label>
              {snapshot.isFetching && <output>Consultando linhas organizadas…</output>}
              {snapshot.isError && (
                <p role="alert">
                  Não foi possível consultar linhas.{" "}
                  <button type="button" onClick={() => void snapshot.refetch()}>
                    Tentar novamente
                  </button>
                </p>
              )}
              {!snapshot.isFetching && !snapshot.isError && (
                <label>
                  Escopo da exceção
                  <select value={linha} onChange={(e) => setLinha(e.target.value)}>
                    <option value="">Lista inteira</option>
                    {snapshot.data?.linhas.map((item, indice) => (
                      // biome-ignore lint/suspicious/noArrayIndexKey: a posição É a identidade da linha — é por `posicao` que a exceção a referencia no banco (ver sso_informar_material) e o snapshot é imutável por revisão, então a ordem não muda
                      <option key={indice} value={`${snapshot.data?.revisao}:${indice}`}>
                        Linha {indice + 1}: {item.descricao}
                      </option>
                    ))}
                  </select>
                </label>
              )}
            </>
          )}
          {confirmacao && confirmacao !== fotografia && (
            <p role="alert">Dados alterados; confira novamente antes de registrar.</p>
          )}
          <label>
            <input
              type="checkbox"
              checked={confirmacao === fotografia}
              disabled={ocupado || revisaoAlterada}
              onChange={(e) => setConfirmacao(e.target.checked ? fotografia : null)}
            />{" "}
            Conferi a lista, revisão e informação que será registrada.
          </label>
          <button type="submit" disabled={ocupado || revisaoAlterada || confirmacao !== fotografia}>
            Registrar informação
          </button>
        </form>
      )}
      {eventos.isFetching && <output>Consultando histórico…</output>}
      {eventos.isError && (
        <p role="alert">
          Não foi possível consultar histórico.{" "}
          <button type="button" onClick={() => void eventos.refetch()}>
            Tentar novamente
          </button>
        </p>
      )}
      {!eventos.isFetching && !eventos.isError && eventos.data?.pages.flat().length === 0 && (
        <p>Nenhuma informação registrada.</p>
      )}
      {!eventos.isFetching && !eventos.isError && (
        <ul>
          {eventos.data?.pages.flat().map((evento) => (
            <li key={evento.revisao}>
              {evento.tipo === "excecao" && (
                <EvidenciasExcecao
                  usuario={usuario}
                  cliente={cliente}
                  listaId={listaId}
                  revision={evento.revisao}
                />
              )}
              {evento.tipo === "excecao" && (
                <ObservacoesExcecao
                  usuario={usuario}
                  cliente={cliente}
                  ordemServico={ordemServico}
                  listaId={listaId}
                  revisao={revisao}
                  eventoRevision={evento.revisao}
                />
              )}
              {evento.tipo === "excecao" && (
                <ImpedimentoMaterialOs
                  usuario={usuario}
                  cliente={cliente}
                  os={ordemServico}
                  lista={listaId}
                  eventoRevision={evento.revisao}
                />
              )}
              Revisão {evento.revisao} · {evento.tipo} · responsável {evento.ator_id} ·{" "}
              {evento.criado_em}
              <DetalheEvento
                usuario={usuario}
                cliente={cliente}
                ordemServico={ordemServico}
                listaId={listaId}
                tipo={evento.tipo}
                dados={evento.dados}
              />
            </li>
          ))}
        </ul>
      )}
      {!eventos.isFetching && !eventos.isError && eventos.hasNextPage && (
        <button type="button" onClick={() => void eventos.fetchNextPage()}>
          Carregar mais informações
        </button>
      )}
    </section>
  );
}

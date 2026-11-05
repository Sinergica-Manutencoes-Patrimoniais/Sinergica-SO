import { useInfiniteQuery } from "@tanstack/react-query";
import { useState } from "react";
import { z } from "zod";
import { supabase } from "../../../../lib/supabase-client";
type Alvo = { alvo_tipo: string; alvo_id: string; alvo_nome: string | null };
type Props = { userId: string; clienteId: string; alvos: Alvo[] };
const linha = z
  .object({
    resposta_id: z.string().uuid(),
    retorno_id: z.string().uuid(),
    os_id: z.string().uuid(),
    chave_pergunta: z.string(),
    resultado: z.enum(["corrigido", "nao_ok", "nao_aplicavel"]),
    observacao: z.string().nullable(),
    fotos_registradas: z.number().int().nonnegative(),
    decisao_retorno: z.string().nullable(),
  })
  .strict();
export function ResultadosAtivo(props: Props) {
  if (import.meta.env.VITE_SSO_RESULTADOS_ATIVO_ENABLED !== "true") return null;
  return <Abrir key={JSON.stringify([props.userId, props.clienteId])} {...props} />;
}

/** Abre a mesma consulta para um alvo já identificado, sem buscar automaticamente. */
export function ResultadosDoAlvo({
  userId,
  clienteId,
  tipo,
  id,
  nome,
}: {
  userId: string;
  clienteId: string;
  tipo: "sistema" | "componente" | "grupo";
  id: string;
  nome: string;
}) {
  if (
    import.meta.env.VITE_SSO_RESULTADOS_ATIVO_ENABLED !== "true" ||
    import.meta.env.VITE_SSO_RESULTADOS_ATIVO_MEDIADOS_ENABLED !== "true"
  )
    return null;
  return (
    <AbrirResultadosDoAlvo
      key={JSON.stringify([userId, clienteId, tipo, id])}
      userId={userId}
      clienteId={clienteId}
      tipo={tipo}
      id={id}
      nome={nome}
    />
  );
}

function AbrirResultadosDoAlvo({
  userId,
  clienteId,
  tipo,
  id,
  nome,
}: {
  userId: string;
  clienteId: string;
  tipo: "sistema" | "componente" | "grupo";
  id: string;
  nome: string;
}) {
  const [aberto, setAberto] = useState(false);
  return (
    <section>
      <button
        type="button"
        aria-expanded={aberto}
        aria-label={`${aberto ? "Ocultar" : "Ver"} resultados de ${nome}`}
        onClick={() => setAberto((v) => !v)}
      >
        {aberto ? "Ocultar resultados" : "Ver resultados"}
      </button>
      {aberto && (
        <>
          <p>
            Fonte parcial: somente retornos preparados vinculados à Rotina versionada. Fotos são
            contagens registradas; não comprovam autenticidade nem cobertura.
          </p>
          <Resultados
            userId={userId}
            clienteId={clienteId}
            alvo={{ alvo_tipo: tipo, alvo_id: id, alvo_nome: nome }}
          />
        </>
      )}
    </section>
  );
}
function Abrir(props: Props) {
  const [aberto, setAberto] = useState(false);
  return (
    <section>
      <button type="button" aria-expanded={aberto} onClick={() => setAberto(!aberto)}>
        {aberto ? "Ocultar resultados por ativo" : "Ver resultados por ativo"}
      </button>
      {aberto && <Selecao {...props} />}
    </section>
  );
}
function Selecao({ userId, clienteId, alvos }: Props) {
  const [chave, setChave] = useState("");
  const unicos = Array.from(
    new Map(alvos.map((a) => [JSON.stringify([a.alvo_tipo, a.alvo_id]), a])).entries(),
  );
  const [tipoManual, setTipoManual] = useState<"sistema" | "componente" | "grupo">("sistema");
  const [idManual, setIdManual] = useState("");
  const [alvoManual, setAlvoManual] = useState<Alvo | null>(null);
  const [erro, setErro] = useState("");
  const alvo = alvoManual ?? unicos.find(([k]) => k === chave)?.[1];
  return (
    <section>
      <h3>Resultados por ativo</h3>
      <p>
        Fonte incompleta: somente retornos preparados vinculados à rotina versionada. Fotos são
        contagens registradas, não prova de autenticidade. Corrigido não cria Pendência nesta
        consulta.
      </p>
      <label>
        Ativo{" "}
        <select
          value={!alvoManual && alvo ? chave : ""}
          onChange={(e) => {
            setAlvoManual(null);
            setChave(e.target.value);
            setErro("");
          }}
        >
          <option value="">Selecione um ativo das Pendências carregadas</option>
          {unicos.map(([k, a]) => (
            <option key={k} value={k}>
              {a.alvo_tipo} · {a.alvo_nome ?? a.alvo_id}
            </option>
          ))}
        </select>
      </label>
      {import.meta.env.VITE_SSO_BUSCA_ATIVOS_RESULTADOS_ENABLED === "true" && (
        <BuscarAtivo
          userId={userId}
          clienteId={clienteId}
          aoSelecionar={(selecionado) => {
            setChave("");
            setAlvoManual(selecionado);
            setErro("");
          }}
        />
      )}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          const id = idManual.trim();
          if (!z.string().uuid().safeParse(id).success) {
            setErro("Informe um identificador de ativo válido.");
            return;
          }
          setChave("");
          setAlvoManual({ alvo_tipo: tipoManual, alvo_id: id, alvo_nome: null });
          setErro("");
        }}
      >
        <p>
          Para consultar resultado de ativo sem Pendência carregada, informe o tipo e identificador.
          A consulta continua sujeita à autorização e não comprova existência de resultados fora
          desta fonte.
        </p>
        <label>
          Tipo{" "}
          <select
            value={tipoManual}
            onChange={(e) => {
              setTipoManual(e.target.value as typeof tipoManual);
              setAlvoManual(null);
              setChave("");
            }}
          >
            <option value="sistema">Sistema</option>
            <option value="componente">Componente</option>
            <option value="grupo">Grupo Quantitativo</option>
          </select>
        </label>
        <label>
          Identificador do ativo{" "}
          <input
            required
            maxLength={36}
            value={idManual}
            onChange={(e) => {
              setIdManual(e.target.value);
              setAlvoManual(null);
              setChave("");
            }}
          />
        </label>
        <button type="submit">Consultar ativo informado</button>
      </form>
      {erro && <p role="alert">{erro}</p>}
      {alvo && (
        <Resultados
          key={JSON.stringify([alvo.alvo_tipo, alvo.alvo_id])}
          userId={userId}
          clienteId={clienteId}
          alvo={alvo}
        />
      )}
    </section>
  );
}
function BuscarAtivo({
  userId,
  clienteId,
  aoSelecionar,
}: { userId: string; clienteId: string; aoSelecionar: (alvo: Alvo) => void }) {
  const [tipo, setTipo] = useState<"sistema" | "componente" | "grupo">("sistema");
  const [texto, setTexto] = useState("");
  const [busca, setBusca] = useState<{ tipo: typeof tipo; texto: string } | null>(null);
  const [erro, setErro] = useState("");
  const consulta = useInfiniteQuery({
    queryKey: ["pendencias-busca-ativo", userId, clienteId, busca],
    enabled: !!busca,
    gcTime: 0,
    retry: false,
    initialPageParam: null as string | null,
    queryFn: async ({ pageParam, signal }) => {
      if (!busca) throw new Error("Busca ausente.");
      const antes = await supabase.auth.getUser();
      if (antes.error || antes.data.user?.id !== userId || signal.aborted)
        throw new Error("Sessão alterada.");
      const { data, error } = await supabase
        .schema("pcm")
        .rpc("sso_buscar_ativos_resultados", {
          p_ator_id: userId,
          p_cliente_id: clienteId,
          p_tipo: busca.tipo,
          p_busca: busca.texto,
          p_apos: pageParam,
          p_limite: 20,
        })
        .abortSignal(signal);
      if (error) throw error;
      const pagina = z
        .array(
          z
            .object({
              id: z.string().uuid(),
              nome: z.string().min(1).max(4000),
              ativo: z.boolean(),
            })
            .strict(),
        )
        .max(20)
        .parse(data);
      let anterior = pageParam?.toLowerCase() ?? "";
      for (const item of pagina) {
        const atual = item.id.toLowerCase();
        if (atual <= anterior) throw new Error("Página divergente.");
        anterior = atual;
      }
      const depois = await supabase.auth.getUser();
      if (depois.error || depois.data.user?.id !== userId || signal.aborted)
        throw new Error("Sessão alterada.");
      return pagina;
    },
    getNextPageParam: (pagina) => (pagina.length === 20 ? pagina.at(-1)?.id : undefined),
  });
  const atual = !!busca && busca.tipo === tipo && busca.texto === texto.trim();
  const encontrados = consulta.data?.pages.flat() ?? [];
  const paginasDivergentes = encontrados.some((item, indice) => {
    const anterior = encontrados[indice - 1];
    return indice > 0 && (!anterior || item.id.toLowerCase() <= anterior.id.toLowerCase());
  });
  return (
    <section aria-label="Buscar ativo por nome">
      <h4>Buscar ativo por nome</h4>
      <p>
        Busca no cadastro deste Cliente, inclusive ativos inativos não excluídos. A presença no
        cadastro não comprova resultados.
      </p>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          const termo = texto.trim();
          if (termo.length < 2 || termo.length > 120) {
            setErro("Informe de 2 a 120 caracteres.");
            return;
          }
          setErro("");
          if (atual) void consulta.refetch();
          else setBusca({ tipo, texto: termo });
        }}
      >
        <label>
          Tipo{" "}
          <select value={tipo} onChange={(e) => setTipo(e.target.value as typeof tipo)}>
            <option value="sistema">Sistema</option>
            <option value="componente">Componente</option>
            <option value="grupo">Grupo Quantitativo</option>
          </select>
        </label>
        <label>
          Nome{" "}
          <input
            required
            minLength={2}
            maxLength={120}
            value={texto}
            onChange={(e) => setTexto(e.target.value)}
          />
        </label>
        <button type="submit">Buscar</button>
      </form>
      {erro && <p role="alert">{erro}</p>}
      {busca && !atual && <p>Busca editada; confirme novamente para atualizar.</p>}
      {atual && consulta.isFetching && <output>Buscando ativos…</output>}
      {atual && consulta.isError && (
        <p role="alert">
          Busca indisponível ou sem acesso.{" "}
          <button type="button" onClick={() => void consulta.refetch()}>
            Tentar novamente
          </button>
        </p>
      )}
      {atual && !consulta.isFetching && !consulta.isError && paginasDivergentes && (
        <p role="alert">
          Páginas de ativos divergentes.{" "}
          <button type="button" onClick={() => void consulta.refetch()}>
            Atualizar
          </button>
        </p>
      )}
      {atual &&
        !consulta.isFetching &&
        !consulta.isError &&
        !paginasDivergentes &&
        consulta.data && (
          <>
            <ul>
              {encontrados.map((a) => (
                <li key={a.id}>
                  {a.nome} · {a.ativo ? "ativo" : "inativo"} · {a.id}{" "}
                  <button
                    type="button"
                    onClick={() =>
                      aoSelecionar({ alvo_tipo: tipo, alvo_id: a.id, alvo_nome: a.nome })
                    }
                  >
                    Consultar resultados
                  </button>
                </li>
              ))}
            </ul>
            {encontrados.length === 0 && <p>Nenhum ativo encontrado nesta busca.</p>}
            {consulta.hasNextPage && (
              <button type="button" onClick={() => void consulta.fetchNextPage()}>
                Mais ativos
              </button>
            )}
          </>
        )}
    </section>
  );
}
function Resultados({
  userId,
  clienteId,
  alvo,
}: { userId: string; clienteId: string; alvo: Alvo }) {
  const q = useInfiniteQuery({
    queryKey: ["pendencias-resultados-ativo", userId, clienteId, alvo.alvo_tipo, alvo.alvo_id],
    gcTime: 0,
    initialPageParam: null as string | null,
    queryFn: async ({ pageParam, signal }) => {
      const antes = await supabase.auth.getUser();
      if (antes.error || antes.data.user?.id !== userId || signal.aborted)
        throw new Error("Sessão alterada.");
      const mediada = import.meta.env.VITE_SSO_RESULTADOS_ATIVO_MEDIADOS_ENABLED === "true";
      const parametros = {
        p_cliente_id: clienteId,
        p_alvo_tipo: alvo.alvo_tipo,
        p_alvo_id: alvo.alvo_id,
        p_apos: pageParam,
        p_limite: 20,
      };
      const { data, error } = await (mediada
        ? supabase
            .schema("pcm")
            .rpc("sso_listar_resultados_ativo_mediada", { ...parametros, p_ator_id: userId })
        : supabase.schema("pcm").rpc("sso_listar_resultados_ativo", parametros)
      ).abortSignal(signal);
      if (error) throw error;
      const pagina = z.array(linha).max(20).parse(data);
      let anterior = pageParam?.toLowerCase() ?? null;
      for (const registro of pagina) {
        const id = registro.resposta_id.toLowerCase();
        if (anterior !== null && id <= anterior) throw new Error("Página divergente.");
        anterior = id;
      }
      const depois = await supabase.auth.getUser();
      if (depois.error || depois.data.user?.id !== userId || signal.aborted)
        throw new Error("Sessão alterada.");
      return pagina;
    },
    getNextPageParam: (p) => (p.length === 20 ? p.at(-1)?.resposta_id : undefined),
  });
  const resultados = q.data?.pages.flat() ?? [];
  const paginasDivergentes = resultados.some((r, indice) => {
    const anterior = resultados[indice - 1];
    return (
      indice > 0 && (!anterior || r.resposta_id.toLowerCase() <= anterior.resposta_id.toLowerCase())
    );
  });
  return (
    <section>
      <p>
        Ativo consultado: {alvo.alvo_tipo} · {alvo.alvo_nome ?? alvo.alvo_id} · {alvo.alvo_id}
      </p>
      {q.isFetching && <output>Consultando…</output>}
      {q.isError && (
        <p role="alert">
          Resultados indisponíveis.{" "}
          <button type="button" onClick={() => void q.refetch()}>
            Tentar novamente
          </button>
        </p>
      )}
      {!q.isFetching && !q.isError && paginasDivergentes && (
        <p role="alert">
          Páginas de resultados divergentes.{" "}
          <button type="button" onClick={() => void q.refetch()}>
            Atualizar
          </button>
        </p>
      )}
      {!q.isFetching && !q.isError && !paginasDivergentes && q.data && resultados.length === 0 && (
        <p>Nenhum resultado nesta fonte.</p>
      )}
      {!q.isFetching && !q.isError && !paginasDivergentes && q.data && (
        <ul>
          {resultados.map((r) => (
            <li key={r.resposta_id}>
              {r.chave_pergunta} ·{" "}
              {r.resultado === "corrigido"
                ? "Corrigido"
                : r.resultado === "nao_ok"
                  ? "Não OK"
                  : "Não aplicável"}{" "}
              ·{" "}
              {r.observacao
                ? `observação/justificativa: ${r.observacao}`
                : "observação não informada"}{" "}
              · {r.fotos_registradas} foto(s) registrada(s) ·{" "}
              {r.decisao_retorno
                ? `decisão de retorno: ${r.decisao_retorno}`
                : "decisão de retorno ausente ou indeterminada"}{" "}
              · OS {r.os_id} · retorno {r.retorno_id} · resposta {r.resposta_id}
            </li>
          ))}
        </ul>
      )}
      {!q.isFetching && !q.isError && !paginasDivergentes && q.hasNextPage && (
        <button type="button" onClick={() => void q.fetchNextPage()}>
          Mais resultados
        </button>
      )}
    </section>
  );
}

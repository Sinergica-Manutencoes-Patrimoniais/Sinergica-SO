import { RecursoNaoAtivado } from "@sinergica/ui";
import { useInfiniteQuery } from "@tanstack/react-query";
import { useState } from "react";
import { z } from "zod";
import { flagLigada } from "../../../../config/flags-sso";
import { TEXTO_FALHA_ATIVACAO, mensagemFalhaAtivacao } from "../../../../lib/mensagem-ativacao";
import { supabase } from "../../../../lib/supabase-client";
import { motivosExcecaoMaterial } from "./DetalheEvento";
import { ImpedimentoMaterialOs } from "./ImpedimentoMaterialOs";
const schema = z
  .object({
    lista_id: z.string().guid(),
    revisao: z.number().int().positive(),
    motivo: z.string(),
    descricao: z.string(),
    revisao_linhas: z.number().int().nullable(),
    posicao: z.number().int().nullable(),
    ator_id: z.string().guid(),
    criado_em: z.string().datetime({ offset: true }),
  })
  .strict();
export function ExcecoesOs({
  usuario,
  cliente,
  os,
}: { usuario: string; cliente: string; os: string }) {
  if (!flagLigada("VITE_SSO_EXCECOES_MATERIAIS_OS_ENABLED")) {
    return (
      <RecursoNaoAtivado
        recurso="Excecoes materiais os"
        podeAdministrar={false}
        faltando={["VITE_SSO_EXCECOES_MATERIAIS_OS_ENABLED"]}
      />
    );
  }
  return (
    <Conteudo
      key={JSON.stringify([usuario, cliente, os])}
      usuario={usuario}
      cliente={cliente}
      os={os}
    />
  );
}
function Conteudo({ usuario, cliente, os }: { usuario: string; cliente: string; os: string }) {
  const [referencia, setReferencia] = useState("");
  const consulta = useInfiniteQuery({
    queryKey: ["listas-materiais", usuario, cliente, os, "excecoes-os"],
    gcTime: 0,
    retry: (falhas, erro) => !mensagemFalhaAtivacao(erro) && falhas < 3,
    initialPageParam: null as { lista: string; revisao: number } | null,
    queryFn: async ({ pageParam, signal }) => {
      const antes = await supabase.auth.getUser();
      if (antes.error || antes.data.user?.id !== usuario || signal.aborted)
        throw new Error("Sessão alterada.");
      const { data, error } = await supabase
        .schema("pcm")
        .rpc("sso_listar_excecoes_materiais_os", {
          p_cliente_id: cliente,
          p_os_id: os,
          p_apos_lista: pageParam?.lista ?? null,
          p_apos_revisao: pageParam?.revisao ?? null,
          p_limite: 20,
        })
        .abortSignal(signal);
      if (error) throw error;
      const pagina = z.array(schema).max(20).parse(data);
      let anterior = pageParam;
      for (const item of pagina) {
        const lista = item.lista_id.toLowerCase();
        if (
          anterior &&
          (lista < anterior.lista.toLowerCase() ||
            (lista === anterior.lista.toLowerCase() && item.revisao <= anterior.revisao))
        )
          throw new Error("Página divergente.");
        anterior = { lista, revisao: item.revisao };
      }
      const depois = await supabase.auth.getUser();
      if (depois.error || depois.data.user?.id !== usuario || signal.aborted)
        throw new Error("Sessão alterada.");
      return pagina;
    },
    getNextPageParam: (p) => {
      const ultimo = p.at(-1);
      return p.length === 20 && ultimo
        ? { lista: ultimo.lista_id, revisao: ultimo.revisao }
        : undefined;
    },
  });
  const falhaAtivacao = mensagemFalhaAtivacao(consulta.error);
  const excecoes =
    !consulta.isFetching && !consulta.isError ? (consulta.data?.pages.flat() ?? []) : [];
  const selecionada = excecoes.find((e) => `${e.lista_id}:${e.revisao}` === referencia);

  return (
    <>
      <section aria-label="Histórico de exceções da OS">
        <h3>Histórico de exceções da OS</h3>
        <p>Eventos registrados, não uma confirmação de que a exceção permanece aberta.</p>
        {consulta.isPending && <output>Consultando exceções…</output>}
        {consulta.isError && (
          <p role="alert">
            {falhaAtivacao ? (
              TEXTO_FALHA_ATIVACAO[falhaAtivacao]
            ) : (
              <>
                Não foi possível consultar exceções.{" "}
                <button type="button" onClick={() => void consulta.refetch()}>
                  Tentar novamente
                </button>
              </>
            )}
          </p>
        )}
        {!consulta.isFetching && !consulta.isError && consulta.data?.pages.flat().length === 0 && (
          <p>Nenhuma exceção registrada nesta OS.</p>
        )}
        {!consulta.isFetching && !consulta.isError && (
          <ul>
            {consulta.data?.pages.flat().map((e) => (
              <li key={`${e.lista_id}:${e.revisao}`}>
                Lista de materiais · revisão {e.revisao} ·{" "}
                {Object.entries(motivosExcecaoMaterial).find(
                  ([codigo]) => codigo === e.motivo,
                )?.[1] ?? "Motivo indisponível"}
                : {e.descricao} · {new Date(e.criado_em).toLocaleString("pt-BR")} ·{" "}
                {e.ator_id === usuario ? "Registrado por você" : "Nome do responsável indisponível"}
              </li>
            ))}
          </ul>
        )}
        {!consulta.isError && consulta.hasNextPage && (
          <button
            type="button"
            disabled={consulta.isFetchingNextPage}
            onClick={() => void consulta.fetchNextPage()}
          >
            Mais exceções
          </button>
        )}
      </section>
      {flagLigada("VITE_SSO_IMPEDIMENTO_MATERIAL_OS_ENABLED") && excecoes.length > 0 && (
        <section aria-label="Ação da OS: intenção de impedimento">
          <h3>Intenção de impedimento da OS</h3>
          <p>
            Use uma exceção registrada como referência para a intenção da OS. A lista de materiais
            permanece inalterada.
          </p>
          <label>
            Exceção de referência
            <select
              value={selecionada ? referencia : ""}
              onChange={(e) => setReferencia(e.target.value)}
            >
              <option value="">Selecione uma exceção</option>
              {excecoes.map((e) => (
                <option key={`${e.lista_id}:${e.revisao}`} value={`${e.lista_id}:${e.revisao}`}>
                  Revisão {e.revisao} · {e.descricao} ·{" "}
                  {new Date(e.criado_em).toLocaleString("pt-BR")}
                </option>
              ))}
            </select>
          </label>
          {selecionada && (
            <ImpedimentoMaterialOs
              usuario={usuario}
              cliente={cliente}
              os={os}
              lista={selecionada.lista_id}
              eventoRevision={selecionada.revisao}
            />
          )}
        </section>
      )}
    </>
  );
}

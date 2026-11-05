import { useInfiniteQuery } from "@tanstack/react-query";
import { useState } from "react";
import { z } from "zod";
import { supabase } from "../../../../lib/supabase-client";
import { RegistrarOcorrenciaGrupo } from "./RegistrarOcorrenciaGrupo";
import { VincularOsGrupo } from "./VincularOsGrupo";
import { IntencaoOsGrupo } from "./IntencaoOsGrupo";
import { AtestadoGrupo } from "./AtestadoGrupo";
import { FotosAtestadoGrupo } from "./FotosAtestadoGrupo";
import { RegistrarFotoGrupo } from "./RegistrarFotoGrupo";
import { DecisaoFotoGrupo } from "./DecisaoFotoGrupo";
import { QuantidadeGrupo } from "./QuantidadeGrupo";
import { ComparacaoQuantidadeGrupo } from "./ComparacaoQuantidadeGrupo";
import { EsforcoGrupo } from "./EsforcoGrupo";
import { NaturezaAlvoAprovada } from "./NaturezaAlvoAprovada";
import { EstadoOcorrenciaVinculada } from "./EstadoOcorrenciaVinculada";
import { FilaPreventivaPcm } from "./FilaPreventivaPcm";
import { IncluirFilaSelecionada } from "./IncluirFilaSelecionada";
import { ChamadoCicloPreventivo } from "./ChamadoCicloPreventivo";

type Obrigacao = {
  tipo: "calendario" | "visita";
  preparada_id: string;
  versao_id: string;
  rotina_id: string;
  alvo_tipo: string;
  alvo_id: string;
  vencimento_original: string;
  ocorrencia_grupo_id: string | null;
  estado: string;
  fila_executavel: boolean;
};
type Cursor = { tipo: "calendario" | "visita"; id: string } | null;
const obrigacao = z
  .object({
    tipo: z.enum(["calendario", "visita"]),
    preparada_id: z.string().uuid(),
    versao_id: z.string().uuid(),
    rotina_id: z.string().uuid(),
    alvo_tipo: z.enum(["sistema", "componente", "grupo"]),
    alvo_id: z.string().uuid(),
    vencimento_original: z.string().date(),
    ocorrencia_grupo_id: z.string().uuid().nullable(),
    estado: z.enum([
      "grupo_registrado_nao_executavel",
      "grupo_preparado_sem_registro",
      "preparada_sem_estado_execucao",
    ]),
    fila_executavel: z.literal(false),
  })
  .strict();

function GestaoFilaObrigacao(props: {
  userId: string;
  clienteId: string;
  planoId: string;
  preparadaId: string;
  tipo?: "calendario" | "visita";
}) {
  const [aberta, setAberta] = useState(false);
  return (
    <div>
      <p>Ocorrência preparada {props.preparadaId}</p>
      <button type="button" aria-expanded={aberta} onClick={() => setAberta((v) => !v)}>
        {aberta ? "Ocultar fila deste ciclo" : "Conferir fila deste ciclo"}
      </button>
      {aberta && <FilaPreventivaPcm {...props} />}
    </div>
  );
}

export function ObrigacoesPreparadas({
  userId,
  clienteId,
  planoId,
}: { userId: string; clienteId: string; planoId: string }) {
  const lista = useInfiniteQuery({
    queryKey: ["obrigacoes-preparadas", userId, clienteId, planoId],
    initialPageParam: null as Cursor,
    gcTime: 0,
    queryFn: async ({ pageParam, signal }) => {
      const antes = await supabase.auth.getUser();
      if (antes.error || antes.data.user?.id !== userId || signal.aborted)
        throw new Error("Sessão alterada.");
      const { data, error } = await supabase
        .schema("pcm")
        .rpc("sso_listar_obrigacoes_preparadas_mediada", {
          p_cliente_id: clienteId,
          p_plano_id: planoId,
          p_apos_tipo: pageParam?.tipo ?? null,
          p_apos_id: pageParam?.id ?? null,
          p_limite: 20,
        })
        .abortSignal(signal);
      if (error) throw error;
      const pagina = z.array(obrigacao).max(20).parse(data);
      let anterior: Cursor = pageParam;
      for (const item of pagina) {
        const id = item.preparada_id.toLowerCase();
        if (
          anterior &&
          (item.tipo < anterior.tipo ||
            (item.tipo === anterior.tipo && id <= anterior.id.toLowerCase()))
        )
          throw new Error("Página divergente.");
        anterior = { tipo: item.tipo, id };
      }
      const depois = await supabase.auth.getUser();
      if (depois.error || depois.data.user?.id !== userId || signal.aborted)
        throw new Error("Sessão alterada.");
      return pagina as Obrigacao[];
    },
    getNextPageParam: (pagina): Cursor | undefined => {
      const ultima = pagina.at(-1);
      return pagina.length === 20 && ultima
        ? { tipo: ultima.tipo, id: ultima.preparada_id }
        : undefined;
    },
  });
  const itens = lista.data?.pages.flat() ?? [];
  const consistentes = itens.every(
    (item, i) =>
      i === 0 ||
      item.tipo > itens[i - 1]!.tipo ||
      (item.tipo === itens[i - 1]!.tipo &&
        item.preparada_id.toLowerCase() > itens[i - 1]!.preparada_id.toLowerCase()),
  );
  const visiveis = !!lista.data && !lista.isFetching && !lista.isError && consistentes;
  return (
    <section aria-label="Obrigações preparadas">
      <h4>Obrigações preparadas</h4>
      <p>
        Fonte parcial: não é fila executável e não mostra o estado de OS ou tarefas legadas.
        Ausência aqui não prova ausência de execução.
      </p>
      {lista.isPending && <p>Consultando obrigações…</p>}
      {lista.isError && (
        <p role="alert">
          Consulta indisponível ou acesso não autorizado.{" "}
          <button type="button" onClick={() => void lista.refetch()}>
            Tentar novamente
          </button>
        </p>
      )}
      {!lista.isFetching && !lista.isError && !consistentes && (
        <p role="alert">
          Páginas divergentes.{" "}
          <button type="button" onClick={() => void lista.refetch()}>
            Reconsultar
          </button>
        </p>
      )}
      {import.meta.env.VITE_SSO_FILA_SELECIONADA_ENABLED === "true" && (
        <IncluirFilaSelecionada
          userId={userId}
          clienteId={clienteId}
          planoId={planoId}
          itens={visiveis ? itens.filter((item) => item.tipo === "calendario") : []}
          carregando={!visiveis}
        />
      )}
      {import.meta.env.VITE_SSO_FILA_SELECIONADA_ENABLED === "true" &&
        import.meta.env.VITE_SSO_FILA_VISITA_ENABLED === "true" && (
          <IncluirFilaSelecionada
            userId={userId}
            clienteId={clienteId}
            planoId={planoId}
            tipo="visita"
            itens={visiveis ? itens.filter((item) => item.tipo === "visita") : []}
            carregando={!visiveis}
          />
        )}
      {visiveis && (
        <ul>
          {itens.map((item) => (
            <li key={`${item.tipo}:${item.preparada_id}`}>
              {item.tipo} · vencimento {item.vencimento_original} · alvo {item.alvo_tipo}{" "}
              {item.alvo_id} · Rotina {item.rotina_id} · versão {item.versao_id} · {item.estado}
              {item.alvo_tipo === "componente" && (
                <NaturezaAlvoAprovada
                  userId={userId}
                  clienteId={clienteId}
                  planoId={planoId}
                  versaoId={item.versao_id}
                  rotinaId={item.rotina_id}
                  alvoId={item.alvo_id}
                />
              )}
              {item.ocorrencia_grupo_id && ` · Grupo registrado ${item.ocorrencia_grupo_id}`}
              {item.alvo_tipo === "grupo" &&
                !item.ocorrencia_grupo_id &&
                import.meta.env.VITE_SSO_REGISTRAR_OCORRENCIA_GRUPO_ENABLED === "true" && (
                  <RegistrarOcorrenciaGrupo
                    userId={userId}
                    clienteId={clienteId}
                    planoId={planoId}
                    tipo={item.tipo}
                    preparadaId={item.preparada_id}
                  />
                )}
              {item.ocorrencia_grupo_id &&
                import.meta.env.VITE_SSO_INTENCAO_OS_GRUPO_ENABLED === "true" && (
                  <IntencaoOsGrupo
                    userId={userId}
                    clienteId={clienteId}
                    ocorrenciaId={item.ocorrencia_grupo_id}
                  />
                )}
              {item.ocorrencia_grupo_id &&
                import.meta.env.VITE_SSO_VINCULO_OS_GRUPO_ENABLED === "true" && (
                  <VincularOsGrupo
                    userId={userId}
                    clienteId={clienteId}
                    planoId={planoId}
                    ocorrenciaId={item.ocorrencia_grupo_id}
                  />
                )}
            </li>
          ))}
        </ul>
      )}
      {visiveis &&
        import.meta.env.VITE_SSO_ESTADO_OCORRENCIA_VINCULADA_ENABLED === "true" &&
        itens
          .filter((item) => item.tipo === "calendario")
          .map((item) => (
            <EstadoOcorrenciaVinculada
              key={`estado:${item.preparada_id}`}
              userId={userId}
              clienteId={clienteId}
              planoId={planoId}
              preparadaId={item.preparada_id}
            />
          ))}
      {visiveis &&
        import.meta.env.VITE_SSO_CHAMADO_PREVENTIVO_ENABLED === "true" &&
        itens.map((item) => (
          <ChamadoCicloPreventivo
            key={`chamado:${item.tipo}:${item.preparada_id}`}
            userId={userId}
            clienteId={clienteId}
            planoId={planoId}
            preparadaId={item.preparada_id}
            tipo={item.tipo}
          />
        ))}
      {visiveis &&
        itens
          .filter((item) =>
            item.tipo === "calendario"
              ? import.meta.env.VITE_SSO_FILA_PREVENTIVA_PCM_ENABLED === "true"
              : import.meta.env.VITE_SSO_FILA_VISITA_ENABLED === "true",
          )
          .map((item) => (
            <GestaoFilaObrigacao
              key={`fila:${item.tipo}:${item.preparada_id}`}
              userId={userId}
              clienteId={clienteId}
              planoId={planoId}
              preparadaId={item.preparada_id}
              tipo={item.tipo}
            />
          ))}
      {visiveis &&
        import.meta.env.VITE_SSO_ATESTADO_GRUPO_ENABLED === "true" &&
        itens
          .filter((item) => item.ocorrencia_grupo_id)
          .map((item) => (
            <AtestadoGrupo
              key={`atestado:${item.ocorrencia_grupo_id}`}
              userId={userId}
              clienteId={clienteId}
              ocorrenciaId={item.ocorrencia_grupo_id!}
            />
          ))}
      {visiveis &&
        import.meta.env.VITE_SSO_FOTO_GRUPO_ENABLED === "true" &&
        itens
          .filter((item) => item.ocorrencia_grupo_id)
          .map((item) => (
            <FotosAtestadoGrupo
              key={`foto:${item.ocorrencia_grupo_id}`}
              userId={userId}
              clienteId={clienteId}
              ocorrenciaId={item.ocorrencia_grupo_id!}
            />
          ))}
      {visiveis &&
        import.meta.env.VITE_SSO_REGISTRAR_FOTO_GRUPO_ENABLED === "true" &&
        itens
          .filter((item) => item.ocorrencia_grupo_id)
          .map((item) => (
            <RegistrarFotoGrupo
              key={`registro-foto:${item.ocorrencia_grupo_id}`}
              userId={userId}
              clienteId={clienteId}
              ocorrenciaId={item.ocorrencia_grupo_id!}
            />
          ))}
      {visiveis &&
        import.meta.env.VITE_SSO_DECISAO_FOTO_GRUPO_ENABLED === "true" &&
        itens
          .filter((item) => item.ocorrencia_grupo_id)
          .map((item) => (
            <DecisaoFotoGrupo
              key={`decisao-foto:${item.ocorrencia_grupo_id}`}
              userId={userId}
              clienteId={clienteId}
              ocorrenciaId={item.ocorrencia_grupo_id!}
            />
          ))}
      {visiveis &&
        import.meta.env.VITE_SSO_QUANTIDADE_GRUPO_ENABLED === "true" &&
        itens
          .filter((item) => item.ocorrencia_grupo_id)
          .map((item) => (
            <QuantidadeGrupo
              key={`quantidade:${item.ocorrencia_grupo_id}`}
              userId={userId}
              clienteId={clienteId}
              ocorrenciaId={item.ocorrencia_grupo_id!}
            />
          ))}
      {visiveis &&
        import.meta.env.VITE_SSO_COMPARAR_QUANTIDADE_GRUPO_ENABLED === "true" &&
        itens
          .filter((item) => item.ocorrencia_grupo_id)
          .map((item) => (
            <ComparacaoQuantidadeGrupo
              key={`comparacao:${item.ocorrencia_grupo_id}`}
              userId={userId}
              clienteId={clienteId}
              ocorrenciaId={item.ocorrencia_grupo_id!}
            />
          ))}
      {visiveis &&
        import.meta.env.VITE_SSO_ESFORCO_GRUPO_ENABLED === "true" &&
        itens
          .filter((item) => item.ocorrencia_grupo_id)
          .map((item) => (
            <EsforcoGrupo
              key={`esforco:${item.ocorrencia_grupo_id}`}
              userId={userId}
              clienteId={clienteId}
              ocorrenciaId={item.ocorrencia_grupo_id!}
            />
          ))}
      {lista.hasNextPage && (
        <button
          type="button"
          disabled={lista.isFetchingNextPage}
          onClick={() => void lista.fetchNextPage()}
        >
          Carregar mais
        </button>
      )}
    </section>
  );
}

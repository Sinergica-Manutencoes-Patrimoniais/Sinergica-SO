import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { z } from "zod";
import { supabase } from "../../../../lib/supabase-client";
import {
  confirmarSnapshotExportacao,
  lerSnapshotExportacao,
} from "../../application/snapshot-exportacao";
import {
  avaliarToleranciaCalendario,
  projetarVencimentosPorCalendario,
} from "../../domain/calendario-contratual";
import { obterPaginaSnapshotExportacao } from "../../infrastructure/supabase-snapshot-exportacao";
import { DecidirVencimento } from "./DecidirVencimento";
import { EstadoOcorrenciaVinculada } from "./EstadoOcorrenciaVinculada";
import { FilaPreventivaPcm } from "./FilaPreventivaPcm";
import { MaterializarCicloCanonico } from "./MaterializarCicloCanonico";
import { TriagemCicloAtrasado } from "./TriagemCicloAtrasado";

const obrigacao = z
  .object({
    tipo: z.enum(["calendario", "visita"]),
    preparada_id: z.string().uuid(),
    versao_id: z.string().uuid(),
    rotina_id: z.string().uuid(),
    alvo_tipo: z.string(),
    alvo_id: z.string().uuid(),
    vencimento_original: z.string().date(),
    ocorrencia_grupo_id: z.string().uuid().nullable(),
    estado: z.string(),
    fila_executavel: z.literal(false),
  })
  .strict();

/** Projeção informativa para conferência PCM; não afirma pendência nem cria ocorrências. */
export function PreviaVencimentosPlano(props: {
  userId: string;
  clienteId: string;
  planoId: string;
  versaoId: string;
  revisaoPlano: number;
}) {
  return (
    <Conteudo
      key={JSON.stringify([props.userId, props.clienteId, props.planoId, props.versaoId])}
      {...props}
    />
  );
}

function Conteudo({
  userId,
  clienteId,
  planoId,
  versaoId,
  revisaoPlano,
}: { userId: string; clienteId: string; planoId: string; versaoId: string; revisaoPlano: number }) {
  const [inicio, setInicio] = useState("");
  const [referencia, setReferencia] = useState("");
  const [janela, setJanela] = useState<{ inicio: string; referencia: string } | null>(null);
  const [pagina, setPagina] = useState(0);
  const [selecionada, setSelecionada] = useState<{
    rotinaId: string;
    vencimento: string;
    alvoId: string;
    alvoTipo: "sistema" | "componente" | "grupo";
    ciclo: number;
  } | null>(null);
  const ocorrenciasHabilitadas =
    import.meta.env.VITE_SSO_PREVIA_VENCIMENTOS_OCORRENCIAS_ENABLED === "true";
  const dias =
    (Date.parse(`${referencia}T00:00:00Z`) - Date.parse(`${inicio}T00:00:00Z`)) / 86_400_000;
  const valida = Number.isFinite(dias) && dias >= 0 && dias <= 366;
  const atual = !!janela && janela.inicio === inicio && janela.referencia === referencia;
  const consulta = useQuery({
    queryKey: ["previa-vencimentos-plano", userId, clienteId, planoId, versaoId, janela],
    enabled: atual,
    gcTime: 0,
    retry: false,
    queryFn: async ({ signal }) => {
      if (!janela) throw new Error("Período ausente.");
      const identidade = { clienteId, planoId, versaoId };
      const conferirSessao = async () => {
        const sessao = await supabase.auth.getUser();
        if (sessao.error || sessao.data.user?.id !== userId || signal.aborted)
          throw new Error("Sessão alterada.");
      };
      const pagina = (posicao: number, s?: AbortSignal) => {
        if (posicao >= 1000) throw new Error("Fotografia excede o limite da prévia.");
        return obterPaginaSnapshotExportacao(identidade, posicao, s);
      };
      await conferirSessao();
      const snapshot = await lerSnapshotExportacao(pagina, identidade, signal);
      if (snapshot.total > 1000) throw new Error("Fotografia excede o limite da prévia.");
      if (!snapshot.vigenciaInicio) throw new Error("Vigência inicial não informada.");
      const primeiro =
        snapshot.vigenciaInicio > janela.inicio ? snapshot.vigenciaInicio : janela.inicio;
      const ultimo =
        snapshot.vigenciaFim && snapshot.vigenciaFim < janela.referencia
          ? snapshot.vigenciaFim
          : janela.referencia;
      const linhas: {
        rotinaId: string;
        rotina: string;
        alvo: string;
        alvoId: string;
        alvoTipo: "sistema" | "componente" | "grupo";
        ciclo: number;
        vencimento: string;
        toleranciaAntes: number;
        toleranciaDepois: number;
        fimPermitido: string;
        situacaoPrazo: string;
      }[] = [];
      if (primeiro <= ultimo)
        for (const rotina of snapshot.rotinas) {
          if (
            rotina.modo !== "calendario" ||
            rotina.intervalo === null ||
            rotina.unidade === null ||
            rotina.dataBase === null
          )
            continue;
          const ciclos = projetarVencimentosPorCalendario({
            dataBase: rotina.dataBase,
            intervalo: rotina.intervalo,
            unidade: rotina.unidade,
            inicio: primeiro,
            fim: ultimo,
            feriados: [],
          });
          for (const ciclo of ciclos) {
            if (ciclo.vencimento >= janela.referencia) continue;
            if (linhas.length >= 5000) throw new Error("Prévia excede o limite; reduza o período.");
            const prazo = avaliarToleranciaCalendario({
              vencimento: ciclo.vencimento,
              data: janela.referencia,
              diasAntes: rotina.toleranciaAntes,
              diasDepois: rotina.toleranciaDepois,
            });
            linhas.push({
              rotinaId: rotina.id,
              rotina: rotina.nome,
              alvo: rotina.alvoNome,
              alvoId: rotina.alvoId,
              alvoTipo: rotina.alvoTipo,
              ciclo: ciclo.ciclo,
              vencimento: ciclo.vencimento,
              toleranciaAntes: rotina.toleranciaAntes,
              toleranciaDepois: rotina.toleranciaDepois,
              fimPermitido: prazo.fimPermitido,
              situacaoPrazo: prazo.situacao,
            });
          }
        }
      await confirmarSnapshotExportacao(pagina, identidade, snapshot, signal);
      await conferirSessao();
      linhas.sort(
        (a, b) =>
          a.vencimento.localeCompare(b.vencimento) ||
          a.rotinaId.localeCompare(b.rotinaId) ||
          a.ciclo - b.ciclo,
      );
      return {
        linhas,
        visitas: snapshot.rotinas.filter((r) => r.modo === "visita").length,
        versao: snapshot.versaoNumero,
      };
    },
  });
  const selecionadaAtual =
    !!selecionada &&
    atual &&
    !consulta.isFetching &&
    !consulta.isError &&
    !!consulta.data?.linhas.some(
      (l) =>
        l.rotinaId === selecionada.rotinaId &&
        l.vencimento === selecionada.vencimento &&
        l.alvoId === selecionada.alvoId &&
        l.alvoTipo === selecionada.alvoTipo &&
        l.ciclo === selecionada.ciclo,
    );
  const preparada = useQuery({
    queryKey: [
      "previa-vencimentos-ocorrencia",
      userId,
      clienteId,
      planoId,
      versaoId,
      janela,
      selecionada,
    ],
    enabled: selecionadaAtual && ocorrenciasHabilitadas,
    gcTime: 0,
    retry: false,
    queryFn: async ({ signal }) => {
      if (!selecionada) throw new Error("Seleção ausente.");
      let cursor: { tipo: "calendario" | "visita"; id: string } | null = null;
      const matches: z.infer<typeof obrigacao>[] = [];
      for (let pagina = 0; pagina < 20; pagina++) {
        const antes = await supabase.auth.getUser();
        if (antes.error || antes.data.user?.id !== userId || signal.aborted)
          throw new Error("Sessão alterada.");
        const { data, error } = await supabase
          .schema("pcm")
          .rpc("sso_listar_obrigacoes_preparadas_mediada", {
            p_cliente_id: clienteId,
            p_plano_id: planoId,
            p_apos_tipo: cursor?.tipo ?? null,
            p_apos_id: cursor?.id ?? null,
            p_limite: 50,
          })
          .abortSignal(signal);
        if (error) throw error;
        const itens = z.array(obrigacao).max(50).parse(data);
        for (const item of itens) {
          if (
            cursor &&
            (item.tipo < cursor.tipo ||
              (item.tipo === cursor.tipo &&
                item.preparada_id.toLowerCase() <= cursor.id.toLowerCase()))
          )
            throw new Error("Página divergente.");
          cursor = { tipo: item.tipo, id: item.preparada_id };
          if (
            item.tipo === "calendario" &&
            item.versao_id.toLowerCase() === versaoId.toLowerCase() &&
            item.rotina_id.toLowerCase() === selecionada.rotinaId.toLowerCase() &&
            item.alvo_tipo === selecionada.alvoTipo &&
            item.alvo_id.toLowerCase() === selecionada.alvoId.toLowerCase() &&
            item.vencimento_original === selecionada.vencimento
          )
            matches.push(item);
        }
        const depois = await supabase.auth.getUser();
        if (depois.error || depois.data.user?.id !== userId || signal.aborted)
          throw new Error("Sessão alterada.");
        if (matches.length > 1) throw new Error("Ocorrências ambíguas.");
        if (itens.length < 50) return matches[0] ?? null;
      }
      throw new Error("Limite de páginas excedido.");
    },
  });
  const usoCanonico = useQuery({
    queryKey: [
      "previa-vencimentos-uso-canonico",
      userId,
      clienteId,
      planoId,
      versaoId,
      selecionada,
    ],
    enabled:
      selecionadaAtual &&
      ocorrenciasHabilitadas &&
      import.meta.env.VITE_SSO_CONSULTAR_USO_CICLO_VERSAO_ENABLED === "true",
    gcTime: 0,
    retry: false,
    queryFn: async ({ signal }) => {
      if (!selecionada) throw new Error("Seleção ausente.");
      const antes = await supabase.auth.getUser();
      if (antes.error || antes.data.user?.id !== userId || signal.aborted)
        throw new Error("Sessão alterada.");
      const { data, error } = await supabase
        .schema("pcm")
        .rpc("sso_consultar_uso_ciclo_versao", {
          p_cliente_id: clienteId,
          p_plano_id: planoId,
          p_versao_id: versaoId,
          p_rotina_id: selecionada.rotinaId,
          p_vencimento: selecionada.vencimento,
        })
        .abortSignal(signal);
      if (error) throw error;
      const itens = z
        .array(
          z
            .object({
              ciclo_id: z.string().uuid(),
              preparada_id: z.string().uuid(),
              versao_origem_id: z.string().uuid(),
              alvo_tipo: z.enum(["sistema", "componente", "grupo"]),
              alvo_id: z.string().uuid(),
            })
            .strict(),
        )
        .max(2)
        .parse(data);
      if (
        itens.length > 1 ||
        itens.some(
          (item) =>
            item.alvo_tipo !== selecionada.alvoTipo ||
            item.alvo_id.toLowerCase() !== selecionada.alvoId.toLowerCase(),
        )
      )
        throw new Error("Identidade ambígua.");
      const depois = await supabase.auth.getUser();
      if (depois.error || depois.data.user?.id !== userId || signal.aborted)
        throw new Error("Sessão alterada.");
      return itens[0] ?? null;
    },
  });
  const usoHabilitado = import.meta.env.VITE_SSO_CONSULTAR_USO_CICLO_VERSAO_ENABLED === "true";
  const fontesConflitantes =
    !!preparada.data &&
    !!usoCanonico.data &&
    preparada.data.preparada_id.toLowerCase() !== usoCanonico.data.preparada_id.toLowerCase();
  const consultasConferidas =
    selecionadaAtual &&
    ocorrenciasHabilitadas &&
    !!preparada.dataUpdatedAt &&
    !preparada.isFetching &&
    !preparada.isError &&
    (!usoHabilitado ||
      (!!usoCanonico.dataUpdatedAt && !usoCanonico.isFetching && !usoCanonico.isError));
  const preparadaResolvida =
    consultasConferidas && !fontesConflitantes
      ? (preparada.data?.preparada_id ?? usoCanonico.data?.preparada_id ?? null)
      : null;
  const linhas = consulta.data?.linhas ?? [];
  const paginaAtual = Math.min(pagina, Math.max(0, Math.ceil(linhas.length / 50) - 1));
  return (
    <section aria-label="Prévia consolidada de vencimentos">
      <h4>Conferir vencimentos da versão</h4>
      <p>
        Projeção por calendário da versão selecionada, limitada ao período informado. Para datas
        mais antigas, consulte períodos sucessivos de até 366 dias. Não consulta execução,
        cancelamento ou feriados e não prova que o item esteja pendente. Rotinas por Visita não são
        projetadas; não cria ocorrências ou OS. O registro preliminar de decisão depende das regras
        de retomada do servidor.
      </p>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (!valida) return;
          setPagina(0);
          setSelecionada(null);
          if (atual) void consulta.refetch();
          else setJanela({ inicio, referencia });
        }}
      >
        <label>
          Início da conferência{" "}
          <input type="date" required value={inicio} onChange={(e) => setInicio(e.target.value)} />
        </label>
        <label>
          Data de referência{" "}
          <input
            type="date"
            required
            value={referencia}
            onChange={(e) => setReferencia(e.target.value)}
          />
        </label>
        <button type="submit" disabled={!valida || consulta.isFetching}>
          Consultar vencimentos anteriores
        </button>
      </form>
      {inicio && referencia && !valida && (
        <p role="alert">Informe um período válido de até 366 dias.</p>
      )}
      {atual && consulta.isFetching && <output>Conferindo versão e ciclos…</output>}
      {atual && consulta.isError && (
        <p role="alert">
          Prévia indisponível ou acima do limite. Confira acesso e reduza o período.
        </p>
      )}
      {atual && consulta.data && !consulta.isFetching && !consulta.isError && (
        <>
          <p>
            Versão {consulta.data.versao} · {consulta.data.linhas.length} vencimento(s) anterior(es)
            à referência · {consulta.data.visitas} Rotina(s) por Visita não projetada(s). Confira
            cada ocorrência com o PCM.
          </p>
          {consulta.data.linhas.length > 0 && (
            <ul>
              {linhas.slice(paginaAtual * 50, (paginaAtual + 1) * 50).map((l) => (
                <li key={`${l.rotinaId}:${l.ciclo}`}>
                  {l.vencimento} · {l.rotina} ·{" "}
                  {l.alvoTipo === "sistema"
                    ? "Sistema"
                    : l.alvoTipo === "grupo"
                      ? "Grupo Quantitativo"
                      : "Equipamento ou Componente"}{" "}
                  {l.alvo} · ID {l.alvoId} · ciclo {l.ciclo} · tolerância {l.toleranciaAntes} dia(s)
                  antes e {l.toleranciaDepois} depois · fim permitido {l.fimPermitido} ·{" "}
                  {l.situacaoPrazo === "apos_a_tolerancia"
                    ? "referência após a tolerância"
                    : "referência dentro da tolerância"}
                  {(ocorrenciasHabilitadas ||
                    import.meta.env.VITE_SSO_DECISAO_VENCIMENTO_ENABLED === "true" ||
                    import.meta.env.VITE_SSO_PREPARAR_CICLO_VENCIDO_ENABLED === "true") && (
                    <button
                      type="button"
                      onClick={() => {
                        if (
                          ocorrenciasHabilitadas &&
                          selecionadaAtual &&
                          selecionada?.rotinaId === l.rotinaId &&
                          selecionada.vencimento === l.vencimento &&
                          selecionada.alvoId === l.alvoId &&
                          selecionada.alvoTipo === l.alvoTipo
                        )
                          void preparada.refetch();
                        else
                          setSelecionada({
                            rotinaId: l.rotinaId,
                            vencimento: l.vencimento,
                            alvoId: l.alvoId,
                            alvoTipo: l.alvoTipo,
                            ciclo: l.ciclo,
                          });
                      }}
                    >
                      Conferir este ciclo
                    </button>
                  )}
                </li>
              ))}
            </ul>
          )}
          {linhas.length > 50 && (
            <nav aria-label="Páginas dos vencimentos">
              <p>
                Página {paginaAtual + 1} de {Math.ceil(linhas.length / 50)}.
              </p>
              <button
                type="button"
                disabled={paginaAtual === 0}
                onClick={() => setPagina(paginaAtual - 1)}
              >
                Página anterior
              </button>
              <button
                type="button"
                disabled={(paginaAtual + 1) * 50 >= linhas.length}
                onClick={() => setPagina(paginaAtual + 1)}
              >
                Próxima página
              </button>
            </nav>
          )}
          {selecionadaAtual && selecionada && (
            <section aria-label="Ocorrência do ciclo selecionado">
              <h5>Ocorrência selecionada</h5>
              <p>
                Vencimento {selecionada.vencimento} · Rotina {selecionada.rotinaId}. A consulta não
                comprova execução nem ausência de registros em outras versões.
              </p>
              {import.meta.env.VITE_SSO_PREPARAR_CICLO_VENCIDO_ENABLED === "true" && (
                <MaterializarCicloCanonico
                  vencido
                  userId={userId}
                  clienteId={clienteId}
                  planoId={planoId}
                  versaoId={versaoId}
                  rotinaId={selecionada.rotinaId}
                  revision={revisaoPlano}
                  ciclo={selecionada.ciclo}
                  vencimento={selecionada.vencimento}
                />
              )}
              {ocorrenciasHabilitadas && preparada.isFetching && (
                <output>Consultando ocorrência preparada…</output>
              )}
              {ocorrenciasHabilitadas && preparada.isError && (
                <p role="alert">
                  Consulta incompleta, ambígua ou indisponível.{" "}
                  <button type="button" onClick={() => void preparada.refetch()}>
                    Tentar novamente
                  </button>
                </p>
              )}
              {ocorrenciasHabilitadas &&
                !preparada.isFetching &&
                !preparada.isError &&
                preparada.data === null && (
                  <p>
                    Nenhuma ocorrência foi encontrada nesta fonte e versão; isso não prova ausência
                    de execução.
                  </p>
                )}
              {ocorrenciasHabilitadas &&
                import.meta.env.VITE_SSO_CONSULTAR_USO_CICLO_VERSAO_ENABLED === "true" && (
                  <>
                    <button
                      type="button"
                      disabled={usoCanonico.isFetching}
                      onClick={() => void usoCanonico.refetch()}
                    >
                      Atualizar uso canônico
                    </button>
                    {usoCanonico.isFetching && <output>Conferindo uso em outras versões…</output>}
                    {usoCanonico.isError && (
                      <p role="alert">
                        Uso canônico indisponível ou ambíguo.{" "}
                        <button type="button" onClick={() => void usoCanonico.refetch()}>
                          Tentar novamente
                        </button>
                      </p>
                    )}
                    {!usoCanonico.isFetching && !usoCanonico.isError && usoCanonico.data && (
                      <p>
                        Uso canônico: ocorrência {usoCanonico.data.preparada_id} · versão de origem{" "}
                        {usoCanonico.data.versao_origem_id}. Confira o vínculo; isso não comprova
                        execução.
                      </p>
                    )}
                    {fontesConflitantes && (
                      <p role="alert">
                        As consultas apontam ocorrências diferentes; não presumir equivalência.
                      </p>
                    )}
                  </>
                )}
              {preparadaResolvida && (
                <>
                  <p>
                    Ocorrência preparada {preparadaResolvida}
                    {preparada.data
                      ? ` · ${preparada.data.estado}`
                      : " · reutilizada de outra versão"}
                    ; estado de execução não comprovado.
                  </p>
                  {import.meta.env.VITE_SSO_ESTADO_OCORRENCIA_VINCULADA_ENABLED === "true" && (
                    <EstadoOcorrenciaVinculada
                      userId={userId}
                      clienteId={clienteId}
                      planoId={planoId}
                      preparadaId={preparadaResolvida}
                    />
                  )}
                  {import.meta.env.VITE_SSO_FILA_PREVENTIVA_PCM_ENABLED === "true" && (
                    <FilaPreventivaPcm
                      userId={userId}
                      clienteId={clienteId}
                      planoId={planoId}
                      preparadaId={preparadaResolvida}
                    />
                  )}
                  {preparada.data &&
                    import.meta.env.VITE_SSO_TRIAGEM_CICLO_ATRASADO_ENABLED === "true" && (
                      <TriagemCicloAtrasado
                        userId={userId}
                        clienteId={clienteId}
                        planoId={planoId}
                        rotinaId={selecionada.rotinaId}
                        ocorrenciaEmConferencia={preparadaResolvida}
                      />
                    )}
                </>
              )}
              {import.meta.env.VITE_SSO_DECISAO_VENCIMENTO_ENABLED === "true" && (
                <DecidirVencimento
                  userId={userId}
                  clienteId={clienteId}
                  planoId={planoId}
                  revision={revisaoPlano}
                  versaoId={versaoId}
                  rotinaId={selecionada.rotinaId}
                  ciclo={selecionada.ciclo}
                  vencimento={selecionada.vencimento}
                />
              )}
            </section>
          )}
        </>
      )}
    </section>
  );
}

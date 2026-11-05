import { Button } from "@sinergica/ui";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "../../../../lib/supabase-client";
import { planoManutencaoKeys } from "../../application/plano-manutencao-queries";
import { avaliarToleranciaCalendario, janelaPadraoCalendario } from "../../domain/calendario-contratual";
import { supabasePlanoManutencaoAdapter } from "../../infrastructure/supabase-plano-manutencao-adapter";
import { DecidirVencimento } from "./DecidirVencimento";
import { ExportarPreviaCiclos } from "./ExportarPreviaCiclos";
import { DiagnosticoPmoc } from "./DiagnosticoPmoc";
import { ProximoCicloAncorado } from "./ProximoCicloAncorado";
import { MaterializarCicloCanonico } from "./MaterializarCicloCanonico";
import { HistoricoCicloCanonico } from "./HistoricoCicloCanonico";
import { TriagemCicloAtrasado } from "./TriagemCicloAtrasado";
import { DecisaoFeriadoCalendario } from "./DecisaoFeriadoCalendario";
import { MaterializarLoteCalendario } from "./MaterializarLoteCalendario";
import { OrigemGeracaoRotina } from "./OrigemGeracaoRotina";

function janela(vencimento: string, diasAntes: number, diasDepois: number) {
  try {
    const resultado = avaliarToleranciaCalendario({
      vencimento,
      data: vencimento,
      diasAntes,
      diasDepois,
    });
    const formato = (data: string) => data.split("-").reverse().join("/");
    return `Janela: ${formato(resultado.inicioPermitido)} a ${formato(resultado.fimPermitido)}`;
  } catch {
    return "Janela indisponível: confira as tolerâncias da Rotina.";
  }
}

function avaliarData(vencimento: string, data: string, diasAntes: number, diasDepois: number) {
  try {
    const resultado = avaliarToleranciaCalendario({ vencimento, data, diasAntes, diasDepois });
    return {
      antes_da_tolerancia: "antes da janela de tolerância",
      dentro_da_tolerancia: "dentro da janela de tolerância",
      apos_a_tolerancia: "após a janela de tolerância",
    }[resultado.situacao];
  } catch {
    return "indisponível: confira data e tolerâncias";
  }
}

type Props = { userId: string; clienteId: string; planoId: string; versaoId: string; rotinaId: string; revisaoPlano?: number };
export function PreviaCiclos(props: Props) {
  return <Conteudo key={JSON.stringify([props.userId, props.clienteId, props.planoId, props.versaoId, props.rotinaId])} {...props} />;
}
function Conteudo({
  userId,
  clienteId,
  planoId,
  versaoId,
  rotinaId,
  revisaoPlano,
}: Props) {
  const [inicio, setInicio] = useState("");
  const [fim, setFim] = useState("");
  const [periodo, setPeriodo] = useState<{ inicio: string; fim: string } | null>(null);
  const [feriado, setFeriado] = useState("");
  const [feriados, setFeriados] = useState<string[]>([]);
  const [erro, setErro] = useState("");
  const [dataAvaliacao, setDataAvaliacao] = useState("");
  const [ocorrenciaEmConferencia, setOcorrenciaEmConferencia] = useState<string | undefined>();
  const ciclos = useQuery({
    queryKey: [
      ...planoManutencaoKeys.raiz(userId, clienteId),
      planoId,
      versaoId,
      rotinaId,
      "previa-ciclos",
      periodo,
    ],
    queryFn: async ({ signal }) => {
      if (!periodo) throw new Error("Período de prévia indisponível.");
      const antes = await supabase.auth.getUser();
      if (antes.error || antes.data.user?.id !== userId || signal.aborted) throw new Error("Sessão alterada.");
      const resultado = await supabasePlanoManutencaoAdapter.preverCiclos(
        planoId,
        versaoId,
        rotinaId,
        periodo.inicio,
        periodo.fim,
        signal,
      );
      const depois = await supabase.auth.getUser();
      if (depois.error || depois.data.user?.id !== userId || signal.aborted) throw new Error("Sessão alterada.");
      return resultado;
    },
    enabled: periodo !== null,
    gcTime: 0,
    retry: false,
  });
  return (
    <div className="space-y-2">
      <p>
        Prévia informativa: não cria Ocorrências, não confere feriados ou cancelamentos e não
        autoriza programação.
      </p>
      <p>Para simular, informe feriados hipotéticos abaixo. Nenhuma fonte oficial está conectada. Em Rotina por calendário, feriado não remove vencimento nem desloca a âncora.</p>
      <label>Feriado hipotético <input type="date" value={feriado} onChange={(e) => setFeriado(e.target.value)} /></label>
      <button type="button" disabled={!feriado} onClick={() => {if (feriado) {setFeriados((atuais) => [...new Set([...atuais,feriado])].sort());setFeriado("");}}}>Adicionar feriado hipotético</button>
      {feriados.length > 0 && <ul aria-label="Feriados hipotéticos da prévia">{feriados.map((data) => <li key={data}>{data} <button type="button" onClick={() => setFeriados((atuais) => atuais.filter((item) => item!==data))}>Remover {data}</button></li>)}</ul>}
      <form
        className="flex flex-wrap items-end gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          const dias =
            (Date.parse(`${fim}T00:00:00Z`) - Date.parse(`${inicio}T00:00:00Z`)) / 86400000;
          if (!Number.isFinite(dias) || dias < 0 || dias > 366) {
            setErro("Informe um período válido de até 366 dias de diferença.");
            return;
          }
          setErro("");
          if (periodo?.inicio === inicio && periodo.fim === fim) {
            void ciclos.refetch();
          } else {
            setPeriodo({ inicio, fim });
          }
        }}
      >
        <label>
          Início da prévia{" "}
          <input
            className="input"
            type="date"
            required
            value={inicio}
            onChange={(e) => {
              setInicio(e.target.value);
              setPeriodo(null);
            }}
          />
        </label>
        <label>
          Fim da prévia{" "}
          <input
            className="input"
            type="date"
            required
            value={fim}
            onChange={(e) => {
              setFim(e.target.value);
              setPeriodo(null);
            }}
          />
        </label>
        <Button type="button" variant="secondary" disabled={!inicio} onClick={() => {
          try {
            const janelaPadrao = janelaPadraoCalendario(inicio);
            setFim(janelaPadrao.fim);
            setPeriodo(null);
            setErro("");
          } catch {
            setErro("Informe uma data de início válida que comporte 30 dias.");
          }
        }}>
          Usar 30 dias a partir do início
        </Button>
        <Button type="submit" variant="secondary">
          Consultar ciclos
        </Button>
      </form>
      {erro && <p role="alert">{erro}</p>}
      {periodo && ciclos.isFetching && <output>Carregando ciclos...</output>}
      {periodo && ciclos.isError && (
        <p role="alert">
          Não foi possível consultar ciclos.{" "}
          <button type="button" onClick={() => void ciclos.refetch()}>
            Tentar novamente
          </button>
        </p>
      )}
      {periodo && !ciclos.isFetching && !ciclos.isError && ciclos.data?.length === 0 && (
        <p>Nenhum ciclo neste período.</p>
      )}
      {periodo && !ciclos.isFetching && !ciclos.isError && !!ciclos.data?.length && (
        <label>Comparar data com as tolerâncias <input type="date" value={dataAvaliacao} onChange={(e) => setDataAvaliacao(e.target.value)} /></label>
      )}
      {import.meta.env.VITE_SSO_EXPORTAR_PREVIA_CICLOS_ENABLED === "true" && periodo && !ciclos.isFetching && !ciclos.isError && ciclos.data && (
        <ExportarPreviaCiclos clienteId={clienteId} planoId={planoId} versaoId={versaoId} rotinaId={rotinaId}
          inicio={periodo.inicio} fim={periodo.fim} ciclos={ciclos.data} feriados={feriados} />
      )}
      {revisaoPlano !== undefined && <OrigemGeracaoRotina userId={userId} clienteId={clienteId} planoId={planoId} versaoId={versaoId} rotinaId={rotinaId} revision={revisaoPlano} />}
      {import.meta.env.VITE_SSO_DIAGNOSTICO_PMOC_ENABLED === "true" && periodo && !ciclos.isFetching && !ciclos.isError && ciclos.data && <DiagnosticoPmoc userId={userId} clienteId={clienteId} planoId={planoId} versaoId={versaoId} rotinaId={rotinaId} inicio={periodo.inicio} fim={periodo.fim} revision={revisaoPlano} />}
      {import.meta.env.VITE_SSO_LOTE_CICLOS_CALENDARIO_ENABLED === "true" && periodo && !ciclos.isFetching && !ciclos.isError && ciclos.data && revisaoPlano !== undefined && <MaterializarLoteCalendario userId={userId} clienteId={clienteId} planoId={planoId} versaoId={versaoId} rotinaId={rotinaId} revision={revisaoPlano} inicio={periodo.inicio} fim={periodo.fim} ciclos={ciclos.data} />}
      {import.meta.env.VITE_SSO_TRIAGEM_CICLO_ATRASADO_ENABLED === "true" && <TriagemCicloAtrasado userId={userId} clienteId={clienteId} planoId={planoId} rotinaId={rotinaId} ocorrenciaEmConferencia={ocorrenciaEmConferencia} />}
      {periodo && !ciclos.isFetching && !ciclos.isError && (
        <ul>
          {ciclos.data?.map((item) => (
            <li key={item.ciclo}>
              Ciclo {item.ciclo}: {item.vencimento.split("-").reverse().join("/")} — tolerância{" "}
              {item.toleranciaAntes} dias antes e {item.toleranciaDepois} dias depois{" "}
              <span>{janela(item.vencimento, item.toleranciaAntes, item.toleranciaDepois)}</span>
              {dataAvaliacao && <p>Data {dataAvaliacao.split("-").reverse().join("/")}: {avaliarData(item.vencimento, dataAvaliacao, item.toleranciaAntes, item.toleranciaDepois)}. Avaliação informativa; não registra execução nem altera o vencimento.</p>}
              {feriados.includes(item.vencimento) && <p>Feriado hipotético: vencimento permanece para tratamento PCM; ciclo seguinte continua baseado na âncora.</p>}
              {import.meta.env.VITE_SSO_PROXIMO_CICLO_ANCORADO_ENABLED === "true" && <ProximoCicloAncorado userId={userId} clienteId={clienteId} planoId={planoId} versaoId={versaoId} rotinaId={rotinaId} ciclo={item.ciclo} />}
              {import.meta.env.VITE_SSO_MATERIALIZAR_CICLO_CANONICO_ENABLED === "true" && revisaoPlano !== undefined && <MaterializarCicloCanonico userId={userId} clienteId={clienteId} planoId={planoId} versaoId={versaoId} rotinaId={rotinaId} revision={revisaoPlano} ciclo={item.ciclo} vencimento={item.vencimento} />}
              {import.meta.env.VITE_SSO_HISTORICO_CICLO_CANONICO_ENABLED === "true" && <HistoricoCicloCanonico userId={userId} clienteId={clienteId} planoId={planoId} versaoId={versaoId} rotinaId={rotinaId} ciclo={item.ciclo} />}
              {import.meta.env.VITE_SSO_DECISAO_FERIADO_CALENDARIO_ENABLED === "true" && <DecisaoFeriadoCalendario userId={userId} clienteId={clienteId} planoId={planoId} versaoId={versaoId} rotinaId={rotinaId} ciclo={item.ciclo}
                aoConferirAtraso={import.meta.env.VITE_SSO_TRIAGEM_CICLO_ATRASADO_ENABLED === "true" ? setOcorrenciaEmConferencia : undefined} />}
              {import.meta.env.VITE_SSO_DECISAO_VENCIMENTO_ENABLED === "true" && revisaoPlano !== undefined && <DecidirVencimento userId={userId} clienteId={clienteId}
                planoId={planoId} revision={revisaoPlano} versaoId={versaoId} rotinaId={rotinaId} ciclo={item.ciclo} vencimento={item.vencimento} />}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

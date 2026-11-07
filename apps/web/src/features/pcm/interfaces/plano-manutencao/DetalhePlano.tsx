import { Button } from "@sinergica/ui";
import { useRef, useState } from "react";
import type { PlanoResumo, RotinaDetalhe } from "../../application/plano-manutencao-gateway";
import { useRotinasPlano, useVersoesPlano } from "../../application/plano-manutencao-queries";
import { pendenciasConhecidasRotina } from "../../domain/plano-manutencao";
import { consultarVigencia } from "../../domain/vigencia-plano";
import { supabasePlanoManutencaoAdapter } from "../../infrastructure/supabase-plano-manutencao-adapter";
import { supabase } from "../../../../lib/supabase-client";
import { FormularioRotina } from "./FormularioRotina";
import { conferirSessaoDiagnostico } from "./diagnostico-revisao-sessao";
import { NaturezaAlvoRotina } from "./NaturezaAlvoRotina";
import { NaturezaAlvoAprovada } from "./NaturezaAlvoAprovada";
import { ExportarVersaoPlano } from "./ExportarVersaoPlano";
import { ExportarCronogramaFotografia } from "./ExportarCronogramaFotografia";
import { ExigenciaLegalRotina } from "./ExigenciaLegalRotina";
import { DiagnosticoNormativoAprovado } from "./DiagnosticoNormativoAprovado";
import { DiagnosticoModoVisita } from "./DiagnosticoModoVisita";
import { FusoPlanoDeclarado } from "./FusoPlanoDeclarado";
import { VincularSerieRotina } from "./VincularSerieRotina";
import { PreviaCiclos } from "./PreviaCiclos";
import { PreviaVencimentosPlano } from "./PreviaVencimentosPlano";
import { PrepararRotinasJanela } from "./PrepararRotinasJanela";
import { CiclosUniformes } from "./CiclosUniformes";
import { ContratoPerguntas } from "./ContratoPerguntas";
import { IniciarRevisaoContratos } from "./IniciarRevisaoContratos";
import { ContratoEvidencia } from "./ContratoEvidencia";
import { PreviaRevisionada } from "./PreviaRevisionada";
import { QuestionarioAprovado } from "./QuestionarioAprovado";
import { RetiradaRotina } from "./RetiradaRotina";
import { ObrigacoesPreparadas } from "./ObrigacoesPreparadas";
import { ObrigacoesPmoc } from "./ObrigacoesPmoc";
import { CopiarPlanoAprovado } from "./CopiarPlanoAprovado";
import { CopiarRotinaModelo } from "./CopiarRotinaModelo";
import { ProvenienciaRotinaModelo } from "./ProvenienciaRotinaModelo";
import { ConferenciaRotinaCopiada } from "./ConferenciaRotinaCopiada";

export function DetalhePlano({
  userId,
  clienteId,
  plano,
  onAtualizar,
  onEdicaoAtiva,
}: {
  userId: string;
  clienteId: string;
  plano: PlanoResumo;
  onAtualizar: () => void;
  onEdicaoAtiva: (ativa: boolean) => void;
}) {
  const [versaoEscolhida, setVersaoEscolhida] = useState("");
  const [dataConsulta, setDataConsulta] = useState("");
  const [novaRotina, setNovaRotina] = useState(false);
  const [rotinaEmEdicao, setRotinaEmEdicao] = useState<RotinaDetalhe | null>(null);
  const [rotinaPrevia, setRotinaPrevia] = useState<string | null>(null);
  const [rotinaQuestionario, setRotinaQuestionario] = useState<string | null>(null);
  const [rotinaCopiaModelo, setRotinaCopiaModelo] = useState<string | null>(null);
  const [rotinaProveniencia, setRotinaProveniencia] = useState<string | null>(null);
  const [rotinaConferenciaCopia, setRotinaConferenciaCopia] = useState<string | null>(null);
  const [compararRevisao, setCompararRevisao] = useState(false);
  const [retiradaAtiva, setRetiradaAtiva] = useState(false);
  const [rotinaParaRevisar, setRotinaParaRevisar] = useState<{ id: string; nome: string; versaoId: string } | null>(null);
  const [copiaSelecionada, setCopiaSelecionada] = useState<{ id: string; versaoId: string; origemNome: string } | null>(null);
  const [buscandoCopia, setBuscandoCopia] = useState(false);
  const consultaCopiaAtual = useRef(0);
  const [avisoCopia, setAvisoCopia] = useState("");
  async function selecionarCopia() {
    if (!rotinaParaRevisar) return;
    const consulta = ++consultaCopiaAtual.current;
    setBuscandoCopia(true); setAvisoCopia("");
    try {
      await conferirSessaoDiagnostico(userId);
      const { data, error } = await supabase.schema("pcm").rpc("sso_localizar_rotina_revisada_mediada", { p_ator:userId,p_cliente:clienteId,p_plano:plano.id,p_versao:rotinaParaRevisar.versaoId,p_rotina:rotinaParaRevisar.id });
      if (error) throw error;
      await conferirSessaoDiagnostico(userId);
      if (!data || data.edicaoIniciada !== false || data.rotinaOrigemId !== rotinaParaRevisar.id || data.versaoOrigemId !== rotinaParaRevisar.versaoId || typeof data.rotinaRascunhoId !== "string" || typeof data.versaoRascunhoId !== "string") throw new Error("Cópia inválida.");
      if (consulta !== consultaCopiaAtual.current) return;
      setCopiaSelecionada({ id: data.rotinaRascunhoId, versaoId: data.versaoRascunhoId, origemNome: rotinaParaRevisar.nome }); setVersaoEscolhida(data.versaoRascunhoId);
    } catch { if (consulta === consultaCopiaAtual.current) setAvisoCopia("Cópia indisponível, origem não comprovada ou acesso revogado. Recarregue a revisão; não foi feita alteração."); } finally { setBuscandoCopia(false); }
  }
  const versoes = useVersoesPlano(
    supabasePlanoManutencaoAdapter,
    userId,
    clienteId,
    plano.id,
    true,
  );
  const versoesDisponiveis = !versoes.isFetching && !versoes.isError;
  const listaVersoes = versoesDisponiveis ? (versoes.data?.pages.flat() ?? []) : [];
  const resultadoVigencia = dataConsulta
    ? consultarVigencia(
        listaVersoes,
        dataConsulta,
        !versoes.hasNextPage && versoesDisponiveis && !versoes.isPending,
      )
    : null;
  const vigenteConsultada =
    resultadoVigencia?.tipo === "encontrada"
      ? listaVersoes.find((v) => v.id === resultadoVigencia.versaoId)
      : undefined;
  const versao = versaoEscolhida
    ? listaVersoes.find((v) => v.id === versaoEscolhida)
    : (listaVersoes.find((v) => v.estado === "rascunho") ??
      (listaVersoes.length === 1 && !versoes.hasNextPage ? listaVersoes[0] : undefined));
  const escolhaIndisponivel = versoesDisponiveis && Boolean(versaoEscolhida) && !versao;
  const rotinas = useRotinasPlano(
    supabasePlanoManutencaoAdapter,
    userId,
    clienteId,
    plano.id,
    versao?.id ?? "",
    Boolean(versao),
  );
  const rotinasDisponiveis = versoesDisponiveis && !rotinas.isFetching && !rotinas.isError;
  const itens = rotinasDisponiveis ? (rotinas.data?.pages.flat() ?? []) : [];
  return (
    <section
      aria-label={`Rotinas de ${plano.nome}`}
      className="mt-2 rounded-md border border-line p-3"
    >
      <h3 className="font-semibold">Rotinas</h3>
      {import.meta.env.VITE_SSO_FILA_OBRIGACOES_PREPARADAS_ENABLED === "true" && <ObrigacoesPreparadas userId={userId} clienteId={clienteId} planoId={plano.id} />}
      <ObrigacoesPmoc userId={userId} clienteId={clienteId} planoId={plano.id} />
      {import.meta.env.VITE_SSO_FUSO_PLANO_DECLARADO_ENABLED === "true" && <FusoPlanoDeclarado userId={userId} clienteId={clienteId} planoId={plano.id} />}
      {copiaSelecionada && <p role="status">Cópia localizada para {copiaSelecionada.origemNome}: versão rascunho {copiaSelecionada.versaoId}, Rotina {copiaSelecionada.id}. Carregue mais Rotinas se necessário. A seleção não inicia edição nem aprova a revisão.</p>}
      {import.meta.env.VITE_SSO_REVISAO_COM_CONTRATOS_ENABLED === "true" && (plano.estado === "aprovado" || plano.estado === "rascunho") && <IniciarRevisaoContratos userId={userId} clienteId={clienteId} planoId={plano.id} revision={plano.revisao} permitirNova={plano.estado === "aprovado"} />}
      {escolhaIndisponivel && (
        <p role="alert">
          A versão escolhida não está disponível na lista carregada. Escolha outra versão ou
          carregue mais versões.
        </p>
      )}
      {listaVersoes.some((v) => v.estado === "aprovado") &&
        listaVersoes.some((v) => v.estado === "rascunho") && (
          <>
            <Button variant="secondary" onClick={() => setCompararRevisao(!compararRevisao)}>
              {compararRevisao ? "Fechar comparação" : "Comparar revisão"}
            </Button>
            {compararRevisao && (
              <PreviaRevisionada
                key={`${userId}:${clienteId}:${plano.id}:${plano.revisao}`}
                userId={userId}
                clienteId={clienteId}
                planoId={plano.id}
                revisao={plano.revisao}
              />
            )}
          </>
        )}
      {(plano.estado === "rascunho" || (plano.estado === "em_revisao" && import.meta.env.VITE_SSO_INCLUIR_RETIRAR_REVISAO_ENABLED === "true" && versao?.estado === "rascunho")) &&
        !versoes.isPending &&
        versoesDisponiveis &&
        !escolhaIndisponivel &&
        (!versao || rotinasDisponiveis) &&
        (!versao || versao.estado === "rascunho") &&
        !novaRotina &&
        !retiradaAtiva &&
        !rotinaEmEdicao && (
          <Button
            variant="secondary"
            onClick={() => {
              setNovaRotina(true);
              onEdicaoAtiva(true);
            }}
          >
            Nova Rotina
          </Button>
        )}
      {novaRotina && (
        <FormularioRotina
          userId={userId}
          clienteId={clienteId}
          plano={plano}
          consultaDisponivel={
            versoesDisponiveis &&
            !escolhaIndisponivel &&
            (!versao || (versao.estado === "rascunho" && rotinasDisponiveis))
          }
          onCancelar={() => {
            setNovaRotina(false);
            onEdicaoAtiva(false);
          }}
          onAtualizar={onAtualizar}
        />
      )}
      {rotinaEmEdicao && (
        <FormularioRotina
          key={rotinaEmEdicao.id}
          userId={userId}
          clienteId={clienteId}
          plano={plano}
          consultaDisponivel={
            versao?.id === rotinaEmEdicao.versaoId &&
            versao.estado === "rascunho" &&
            rotinasDisponiveis
          }
          rotina={rotinaEmEdicao}
          onCancelar={() => {
            setRotinaEmEdicao(null);
            onEdicaoAtiva(false);
          }}
          onAtualizar={onAtualizar}
        />
      )}
      {versoes.isFetching && <output>Carregando versões…</output>}
      {versoes.isError && (
        <div role="alert">
          Não foi possível carregar versões.{" "}
          <button type="button" onClick={() => void versoes.refetch()}>
            Tentar novamente
          </button>
        </div>
      )}
      {!versoes.isPending && versoesDisponiveis && listaVersoes.length === 0 && (
        <p>Nenhuma Rotina cadastrada neste Plano.</p>
      )}
      {listaVersoes.length > 0 && (
        <label>
          Versão do Plano
          <select
            className="input"
            value={versao?.id ?? ""}
            disabled={novaRotina || Boolean(rotinaEmEdicao) || retiradaAtiva}
            onChange={(e) => {
              setRotinaPrevia(null);
              setRotinaQuestionario(null);
              consultaCopiaAtual.current++;
              setVersaoEscolhida(e.target.value);
            }}
          >
            {!versao && <option value="">Selecione uma versão</option>}
            {listaVersoes.map((v) => (
              <option key={v.id} value={v.id}>
                Versão {v.numero} —{" "}
                {v.estado === "rascunho"
                  ? "Rascunho"
                  : `Aprovada — ${v.vigenciaInicio ?? "início indisponível"} a ${v.vigenciaFim ?? "sem fim definido"}`}
              </option>
            ))}
          </select>
        </label>
      )}
      {listaVersoes.filter((v) => v.estado === "aprovado").length > 1 && (
        <p>Confira os períodos: aprovação não indica que a versão está vigente hoje.</p>
      )}
      {listaVersoes.some((v) => v.estado === "aprovado") && (
        <div>
          <label>
            Consultar vigência na data{" "}
            <input
              className="input"
              type="date"
              value={dataConsulta}
              onChange={(e) => setDataConsulta(e.target.value)}
            />
          </label>
          {resultadoVigencia?.tipo === "incompleta" && (
            <p>Carregue todas as versões antes de consultar a vigência.</p>
          )}
          {resultadoVigencia?.tipo === "nenhuma" && (
            <p>Nenhuma versão aprovada cobre a data informada.</p>
          )}
          {(resultadoVigencia?.tipo === "conflito" ||
            resultadoVigencia?.tipo === "dados_invalidos") && (
            <p role="alert">
              Não foi possível determinar a vigência: há períodos conflitantes ou dados incompletos.
            </p>
          )}
          {resultadoVigencia?.tipo === "data_invalida" && (
            <p role="alert">Informe uma data válida.</p>
          )}
          {vigenteConsultada && (
            <div>
              <p>Versão {vigenteConsultada.numero} cobre a data informada.</p>
              <Button
                variant="secondary"
                disabled={novaRotina || Boolean(rotinaEmEdicao) || retiradaAtiva}
                onClick={() => {
                  setRotinaPrevia(null);
                  setRotinaQuestionario(null);
                  consultaCopiaAtual.current++;
              setVersaoEscolhida(vigenteConsultada.id);
                }}
              >
                Ver versão {vigenteConsultada.numero}
              </Button>
            </div>
          )}
        </div>
      )}
      {versoesDisponiveis && versoes.hasNextPage && (
        <Button
          variant="secondary"
          disabled={versoes.isFetchingNextPage}
          onClick={() => void versoes.fetchNextPage()}
        >
          Mais versões
        </Button>
      )}
      {versao && rotinas.isFetching && <output>Carregando Rotinas…</output>}
      {versao?.estado === "aprovado" && !rotinas.isError && (
        <p>Dados congelados na aprovação; a situação atual dos alvos pode ser diferente.</p>
      )}
      {import.meta.env.VITE_SSO_PREVIA_VENCIMENTOS_PLANO_ENABLED === "true" && versao?.estado === "aprovado" && <PreviaVencimentosPlano userId={userId} clienteId={clienteId} planoId={plano.id} versaoId={versao.id} revisaoPlano={plano.revisao} />}
      {import.meta.env.VITE_SSO_LOTE_CICLOS_CALENDARIO_ENABLED === "true" && import.meta.env.VITE_SSO_LOTE_CALENDARIO_CONFERIDO_ENABLED === "true" && import.meta.env.VITE_SSO_ORIGEM_LOTE_ENABLED === "true" && versao?.estado === "aprovado" && <PrepararRotinasJanela userId={userId} clienteId={clienteId} planoId={plano.id} versaoId={versao.id} revision={plano.revisao} />}
      {import.meta.env.VITE_SSO_COPIA_PLANO_ENABLED === "true" && versao?.estado === "aprovado" && (
        <CopiarPlanoAprovado key={`${userId}:${clienteId}:${plano.id}:${versao.id}:${plano.revisao}`} userId={userId} clienteId={clienteId}
          planoId={plano.id} planoNome={plano.nome} revisao={plano.revisao} versaoId={versao.id} versaoNumero={versao.numero} />
      )}
      {import.meta.env.VITE_SSO_EXPORTAR_PLANO_ENABLED === "true" && versao?.estado === "aprovado" && (
        <ExportarVersaoPlano clienteId={clienteId} plano={plano} versao={versao} rotinas={itens}
          completo={rotinasDisponiveis && !rotinas.isPending && !rotinas.hasNextPage} />
      )}
      {import.meta.env.VITE_SSO_CRONOGRAMA_PARCIAL_ENABLED === "true" && versoesDisponiveis && !versoes.isPending && versao?.estado === "aprovado" && (
        <ExportarCronogramaFotografia key={`${userId}:${clienteId}:${plano.id}:${versao.id}`} userId={userId} clienteId={clienteId} planoId={plano.id} versaoId={versao.id} />
      )}
      {versao && rotinas.isError && (
        <div role="alert">
          Não foi possível carregar Rotinas.{" "}
          <button type="button" onClick={() => void rotinas.refetch()}>
            Tentar novamente
          </button>
        </div>
      )}
      {versao && rotinasDisponiveis && !rotinas.isPending && itens.length === 0 && (
        <p>Nenhuma Rotina nesta versão.</p>
      )}
      <RetiradaRotina
        userId={userId}
        clienteId={clienteId}
        plano={plano}
        rotinas={itens}
        permitirNova={
          (plano.estado === "rascunho" || (plano.estado === "em_revisao" && import.meta.env.VITE_SSO_INCLUIR_RETIRAR_REVISAO_ENABLED === "true")) &&
          versao?.estado === "rascunho" &&
          !novaRotina &&
          !rotinaEmEdicao &&
          !rotinas.isFetching &&
          !rotinas.isError
        }
        onAtivo={(ativa) => {
          setRetiradaAtiva(ativa);
          onEdicaoAtiva(ativa);
        }}
        onAtualizar={onAtualizar}
      />
      <ul>
        {itens.map((r) => (
          <li key={r.id}>
            {copiaSelecionada?.id === r.id && copiaSelecionada.versaoId === versao?.id && <p>Rotina selecionada pela identidade lógica do histórico aprovado.</p>}
            <strong>{r.nome}</strong> ·{" "}
            {r.alvoTipo === "sistema"
              ? "Sistema"
              : r.alvoTipo === "grupo"
                ? "Grupo Quantitativo"
                : "Componente"}{" "}
            · {r.alvoNome ?? `Alvo indisponível (${r.alvoId})`}
            {r.alvoNome && !r.alvoAtivo ? " (inativo)" : ""}
            {r.intervalo && r.unidade && (
              <p>
                {r.modo === "calendario" ? "Por calendário" : "Por Visita"} · a cada {r.intervalo}{" "}
                {r.unidade}
              </p>
            )}
            {r.dataBase && <p>Data-base: {r.dataBase.split("-").reverse().join("/")}</p>}
            {r.instrucao && <p>Instrução: {r.instrucao}</p>}
            {r.questionarioId && (
              <p>Questionário: {r.questionarioNome ?? "referência indisponível"}</p>
            )}
            {import.meta.env.VITE_SSO_CONFERENCIA_COPIA_ROTINA_ENABLED === "true" && versao?.estado === "rascunho" && <>
              <Button variant="secondary" onClick={() => setRotinaConferenciaCopia(rotinaConferenciaCopia === r.id ? null : r.id)}>{rotinaConferenciaCopia === r.id ? "Fechar conferência" : `Conferir cópia de ${r.nome}`}</Button>
              {rotinaConferenciaCopia === r.id && <ConferenciaRotinaCopiada key={`${userId}:${clienteId}:${plano.id}:${versao.id}:${r.id}:${plano.revisao}`} userId={userId} clienteId={clienteId} planoId={plano.id} versaoId={versao.id} rotinaId={r.id} revisao={plano.revisao} />}
            </>}
            {import.meta.env.VITE_SSO_PROVENIENCIA_ROTINA_MODELO_ENABLED === "true" && versao?.estado === "rascunho" && <>
              <Button variant="secondary" onClick={() => setRotinaProveniencia(rotinaProveniencia === r.id ? null : r.id)}>{rotinaProveniencia === r.id ? "Fechar procedência" : `Ver procedência de ${r.nome}`}</Button>
              {rotinaProveniencia === r.id && <ProvenienciaRotinaModelo key={`${userId}:${clienteId}:${plano.id}:${versao.id}:${r.id}`} userId={userId} clienteId={clienteId} planoId={plano.id} versaoId={versao.id} rotinaId={r.id} />}
            </>}
            {import.meta.env.VITE_SSO_COPIA_ROTINA_MODELO_ENABLED === "true" && versao?.estado === "aprovado" && <>
              <Button variant="secondary" onClick={() => setRotinaCopiaModelo(rotinaCopiaModelo === r.id ? null : r.id)}>{rotinaCopiaModelo === r.id ? "Fechar cópia" : `Copiar ${r.nome} para outro Plano`}</Button>
              {rotinaCopiaModelo === r.id && <CopiarRotinaModelo key={`${userId}:${clienteId}:${plano.id}:${versao.id}:${r.id}:${plano.revisao}`} userId={userId} clienteId={clienteId} plano={plano} versaoId={versao.id} rotina={r} />}
            </>}
            {versao?.estado === "aprovado" && r.questionarioId && (
              <>
                <Button
                  variant="secondary"
                  onClick={() => setRotinaQuestionario(rotinaQuestionario === r.id ? null : r.id)}
                >
                  {rotinaQuestionario === r.id
                    ? `Fechar questionário de ${r.nome}`
                    : `Ver questionário de ${r.nome}`}
                </Button>
                {rotinaQuestionario === r.id && (
                  <QuestionarioAprovado
                    key={`${versao.id}:${r.id}`}
                    userId={userId}
                    clienteId={clienteId}
                    planoId={plano.id}
                    versaoId={versao.id}
                    rotinaId={r.id}
                  />
                )}
              </>
            )}
            {r.toleranciaAntes != null && r.toleranciaDepois != null && (
              <p>
                Tolerância: {r.toleranciaAntes} dias antes e {r.toleranciaDepois} dias depois
              </p>
            )}
            {import.meta.env.VITE_SSO_VINCULAR_ROTINA_SERIE_ENABLED === "true" && versao?.estado === "aprovado" && r.modo === "visita" && (
              <VincularSerieRotina userId={userId} clienteId={clienteId} planoId={plano.id} versaoId={versao.id} rotinaId={r.id} revision={plano.revisao} />
            )}
            {plano.estado === "em_revisao" && versao?.estado === "rascunho" && r.questionarioId && import.meta.env.VITE_SSO_CONTRATOS_EM_REVISAO_ENABLED === "true" && <p>Confira novamente as perguntas e exigências de evidência desta versão. A versão aprovada permanece preservada; esta conferência não aprova o Plano.</p>}
            {import.meta.env.VITE_SSO_CONTRATO_PERGUNTAS_ENABLED === "true" && (plano.estado === "rascunho" || (plano.estado === "em_revisao" && import.meta.env.VITE_SSO_CONTRATOS_EM_REVISAO_ENABLED === "true")) && versao?.estado === "rascunho" && r.questionarioId && <ContratoPerguntas userId={userId} clienteId={clienteId} planoId={plano.id} versaoId={versao.id} rotinaId={r.id} revision={plano.revisao} />}
            {import.meta.env.VITE_SSO_CONTRATO_EVIDENCIA_ENABLED === "true" && (plano.estado === "rascunho" || (plano.estado === "em_revisao" && import.meta.env.VITE_SSO_CONTRATOS_EM_REVISAO_ENABLED === "true")) && versao?.estado === "rascunho" && r.questionarioId && <ContratoEvidencia userId={userId} clienteId={clienteId} planoId={plano.id} versaoId={versao.id} rotinaId={r.id} revision={plano.revisao} />}
            {pendenciasConhecidasRotina(r).includes("recorrencia") && (
              <p>Recorrência não informada</p>
            )}
            {pendenciasConhecidasRotina(r).includes("data_base") && <p>Data-base não informada</p>}
            {pendenciasConhecidasRotina(r).includes("instrucao_ou_questionario") && (
              <p>Instrução ou questionário não informado</p>
            )}
            <p>
              {!r.tempoMinutos || !r.tipoTempo
                ? "Tempo a validar"
                : `${r.tempoMinutos} min ${r.tipoTempo === "por_unidade" ? "por unidade" : "no total"}`}
            </p>
            {versao?.estado === "aprovado" && r.modo === "calendario" && (
              <>
                <Button
                  variant="secondary"
                  onClick={() => setRotinaPrevia(rotinaPrevia === r.id ? null : r.id)}
                >
                  {rotinaPrevia === r.id ? `Fechar prévia de ${r.nome}` : `Prévia de ${r.nome}`}
                </Button>
                {rotinaPrevia === r.id && (
                  <PreviaCiclos
                    key={`${versao.id}:${r.id}`}
                    userId={userId}
                    clienteId={clienteId}
                    planoId={plano.id}
                    versaoId={versao.id}
                    rotinaId={r.id}
                    revisaoPlano={plano.revisao}
                  />
                )}
              </>
            )}
            {versao?.estado === "aprovado" && r.modo === "calendario" && import.meta.env.VITE_SSO_CICLOS_UNIFORMES_ENABLED === "true" && <CiclosUniformes userId={userId} clienteId={clienteId} planoId={plano.id} versaoId={versao.id} rotinaId={r.id} revisaoPlano={plano.revisao} />}
            {versao?.estado === "rascunho" && import.meta.env.VITE_SSO_EXIGENCIA_LEGAL_ENABLED === "true" && <ExigenciaLegalRotina key={JSON.stringify([userId, clienteId, plano.id, versao.id, r.id])} userId={userId} clienteId={clienteId} planoId={plano.id} versaoId={versao.id} rotinaId={r.id} planoRevision={plano.revisao} modo={r.modo} />}
            {versao?.estado === "rascunho" && r.alvoTipo === "componente" && <NaturezaAlvoRotina userId={userId} clienteId={clienteId} planoId={plano.id} versaoId={versao.id} rotinaId={r.id} alvoId={r.alvoId} revisao={plano.revisao} onAtualizar={onAtualizar} />}
            {versao?.estado === "aprovado" && r.alvoTipo === "componente" && <NaturezaAlvoAprovada userId={userId} clienteId={clienteId} planoId={plano.id} versaoId={versao.id} rotinaId={r.id} alvoId={r.alvoId} />}
            {versao?.estado === "aprovado" && import.meta.env.VITE_SSO_DIAGNOSTICO_NORMATIVO_ENABLED === "true" && <DiagnosticoNormativoAprovado userId={userId} clienteId={clienteId} planoId={plano.id} versaoId={versao.id} rotinaId={r.id} />}
            {versao && r.modo === "visita" && import.meta.env.VITE_SSO_DIAGNOSTICO_MODO_VISITA_ENABLED === "true" && <DiagnosticoModoVisita userId={userId} clienteId={clienteId} planoId={plano.id} versaoId={versao.id} rotinaId={r.id} />}
            {versao?.estado === "aprovado" && import.meta.env.VITE_SSO_REVISAR_ROTINA_APROVADA_ENABLED === "true" && <><Button variant="secondary" onClick={() => { consultaCopiaAtual.current++; setRotinaParaRevisar({ id: r.id, nome: r.nome, versaoId: versao.id }); }}>Alterar {r.nome} em nova revisão</Button>{rotinaParaRevisar?.id === r.id && rotinaParaRevisar.versaoId === versao.id && <section aria-label="Revisão da Rotina aprovada"><p>Rotina selecionada: {rotinaParaRevisar.nome} · versão {rotinaParaRevisar.versaoId} · ID histórico {rotinaParaRevisar.id}. A versão aprovada permanece preservada; uma revisão cria rascunho, sem salvar mudanças diretamente.</p>{plano.estado === "aprovado" && import.meta.env.VITE_SSO_REVISAO_COM_CONTRATOS_ENABLED === "true" ? <IniciarRevisaoContratos userId={userId} clienteId={clienteId} planoId={plano.id} revision={plano.revisao} /> : <p>Início de revisão indisponível neste estado ou configuração.</p>}{import.meta.env.VITE_SSO_LOCALIZAR_COPIA_ROTINA_ENABLED === "true" && <button type="button" disabled={buscandoCopia} onClick={() => void selecionarCopia()}>Localizar cópia em rascunho</button>}{avisoCopia && <p role="alert">{avisoCopia}</p>}<button type="button" onClick={() => { consultaCopiaAtual.current++; setRotinaParaRevisar(null); }}>Cancelar intenção de revisão</button></section>}</>}
            {(plano.estado === "rascunho" || (plano.estado === "em_revisao" && import.meta.env.VITE_SSO_EDICAO_ROTINA_REVISAO_ENABLED === "true" && copiaSelecionada?.id === r.id && copiaSelecionada.versaoId === versao?.id)) &&
              versao?.estado === "rascunho" &&
              !novaRotina &&
              !retiradaAtiva &&
              !rotinaEmEdicao && (
                <Button
                  variant="secondary"
                  onClick={() => {
                    setRotinaEmEdicao(r);
                    onEdicaoAtiva(true);
                  }}
                >
                  Editar Rotina {r.nome}
                </Button>
              )}
          </li>
        ))}
      </ul>
      {rotinasDisponiveis && rotinas.hasNextPage && (
        <Button
          variant="secondary"
          disabled={rotinas.isFetchingNextPage}
          onClick={() => void rotinas.fetchNextPage()}
        >
          Mais Rotinas
        </Button>
      )}
    </section>
  );
}

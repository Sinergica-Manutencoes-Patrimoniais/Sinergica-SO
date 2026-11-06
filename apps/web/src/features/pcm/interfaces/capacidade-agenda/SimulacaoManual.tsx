import { useState } from "react";
import { calcularDisponibilidade, calcularEsforcoEstimado, simularRemanejamento } from "../../domain/capacidade-agenda";
import { semanaCapacidade } from "../../domain/semana-capacidade";
import { SnapshotCapacidade } from "./SnapshotCapacidade";
import { DeslocamentosSemana } from "./DeslocamentosSemana";

type Verificacao = "nao_verificado" | "sim" | "nao";
type Resultado = ReturnType<typeof simularRemanejamento>;
export type SimulacaoDeclarada = { vencimento: string; programada: string | null; destino: string; alertas: string[]; origemParcial?: boolean; destinoParcial?: boolean; protocolo?: "proveniencia" };
const descricaoAlerta: Record<string, string> = {
  capacidade_nao_verificada: "Capacidade ou esforço incompletos: não é possível confirmar saldo.",
  sobrecarga: "Demanda informada supera a disponibilidade no destino.",
  simultaneidade_incompativel: "Equipe informada não está disponível simultaneamente.",
  qualificacao_incompativel: "Equipe informada não possui a qualificação necessária.",
  conflito: "Há conflito de agenda informado.",
  equipe_nao_verificada: "Simultaneidade, qualificação ou conflito não foram verificados.",
};

function minutos(valor: string): number | null {
  if (!valor.trim()) return null;
  const numero = Number(valor);
  if (!Number.isSafeInteger(numero) || numero < 0) throw new Error("Informe minutos inteiros não negativos.");
  return numero;
}

function verificado(valor: Verificacao): boolean | null {
  return valor === "nao_verificado" ? null : valor === "sim";
}

function CalcularDisponibilidade({ semana, aoUsar, aoAlterar }: { semana: string; aoUsar: (valor: number) => void; aoAlterar: (valor: number) => void }) {
  const [destinados, setDestinados] = useState("");
  const [reservas, setReservas] = useState("");
  const [ausencias, setAusencias] = useState("");
  const [conferido, setConferido] = useState(false);
  const [aplicado, setAplicado] = useState<number | null>(null);
  const [erro, setErro] = useState("");
  function alterar() {
    if (aplicado !== null) aoAlterar(aplicado);
    setAplicado(null); setConferido(false);
  }
  function aplicar() {
    try {
      if (!conferido) throw new Error("Confirme que reservas e ausências não se sobrepõem.");
      const resultado = calcularDisponibilidade({ destinadosMinutos: minutos(destinados), reservasMinutos: minutos(reservas), ausenciasMinutos: minutos(ausencias) });
      if (resultado.disponiveisMinutos === null) throw new Error("Informe os três valores, inclusive zero quando aplicável.");
      aoUsar(resultado.disponiveisMinutos); setAplicado(resultado.disponiveisMinutos); setErro("");
    } catch (e) { setErro(e instanceof Error ? e.message : "Não foi possível calcular a disponibilidade."); }
  }
  return <fieldset><legend>Calcular disponibilidade — {semana}</legend>
    <p>Informe minutos-homem destinados à operação e descontos sem sobreposição; não presumimos toda a jornada disponível.</p>
    <label>Tempo destinado <input type="number" min="0" step="1" value={destinados} onChange={e => { alterar(); setDestinados(e.target.value); }} /></label>
    <label>Reservas <input type="number" min="0" step="1" value={reservas} onChange={e => { alterar(); setReservas(e.target.value); }} /></label>
    <label>Ausências <input type="number" min="0" step="1" value={ausencias} onChange={e => { alterar(); setAusencias(e.target.value); }} /></label>
    <label><input type="checkbox" checked={conferido} onChange={e => { if (!e.target.checked) alterar(); else setConferido(true); }} /> Conferi que reservas e ausências não se sobrepõem.</label>
    <button type="button" onClick={aplicar}>Usar disponibilidade calculada</button>
    {erro && <p role="alert">{erro}</p>}
  </fieldset>;
}

/** Prévia digitada pelo operador; não consulta fontes oficiais nem altera programação. */
export function SimulacaoManual({ userId, clienteId, datasIniciais, aoSimular }: { userId: string; clienteId: string; datasIniciais?: { vencimento: string; programada: string; destino: string }; aoSimular?: (dados: SimulacaoDeclarada | null) => void }) {
  const [vencimento, setVencimento] = useState(datasIniciais?.vencimento ?? "");
  const [programada, setProgramada] = useState(datasIniciais?.programada ?? "");
  const [destino, setDestino] = useState(datasIniciais?.destino ?? "");
  const [esforco, setEsforco] = useState("");
  const [duracao, setDuracao] = useState("");
  const [tecnicos, setTecnicos] = useState("");
  const [quantidade, setQuantidade] = useState("");
  const [tipoTempo, setTipoTempo] = useState<"total" | "por_unidade">("total");
  const [tipoEquipe, setTipoEquipe] = useState<"propria" | "terceiro">("propria");
  const [tempoTerceiros, setTempoTerceiros] = useState("");
  const [calculado, setCalculado] = useState(false);
  const [deslocamentoPorPessoa, setDeslocamentoPorPessoa] = useState("");
  const [pessoasEmDeslocamento, setPessoasEmDeslocamento] = useState("");
  const [deslocamentoSemanalOrigem, setDeslocamentoSemanalOrigem] = useState<{ semana: string; valor: number } | null>(null);
  const [deslocamentoSemanalDestino, setDeslocamentoSemanalDestino] = useState<{ semana: string; valor: number } | null>(null);
  const [conferiuDeslocamentos, setConferiuDeslocamentos] = useState(false);
  const [disponibilidadeOrigem, setDisponibilidadeOrigem] = useState("");
  const [demandaOrigem, setDemandaOrigem] = useState("");
  const [disponibilidadeDestino, setDisponibilidadeDestino] = useState("");
  const [demandaDestino, setDemandaDestino] = useState("");
  const [simultaneidade, setSimultaneidade] = useState<Verificacao>("nao_verificado");
  const [qualificacao, setQualificacao] = useState<Verificacao>("nao_verificado");
  const [conflito, setConflito] = useState<Verificacao>("nao_verificado");
  const [resultado, setResultado] = useState<Resultado | null>(null);
  const [erro, setErro] = useState("");
  const [consultarContexto, setConsultarContexto] = useState(false);
  const [origemParcial, setOrigemParcial] = useState<string | null>(null);
  const [destinoParcial, setDestinoParcial] = useState<string | null>(null);
  const semanaOrigem = semanaCapacidade(programada || vencimento)?.inicio;
  const semanaDestino = semanaCapacidade(destino)?.inicio;

  function alterarEstimativa() {
    if (calculado) setEsforco("");
    setCalculado(false); setResultado(null); aoSimular?.(null);
  }
  function aplicarEstimativa() {
    try {
      if (tipoEquipe === "terceiro" && !minutos(tempoTerceiros)) throw new Error("Informe o esforço de terceiros para completar a estimativa.");
      const resultado = calcularEsforcoEstimado({ duracaoMinutos: minutos(duracao), tecnicos: minutos(tecnicos),
        quantidade: tipoTempo === "por_unidade" ? minutos(quantidade) : null, tipoTempo });
      if (resultado === null) throw new Error("Informe duração, técnicos e, quando aplicável, quantidade maiores que zero.");
      setEsforco(String(resultado)); setCalculado(true); setResultado(null); aoSimular?.(null); setErro("");
    } catch (e) { setErro(e instanceof Error ? e.message : "Não foi possível calcular o esforço."); }
  }

  function simular() {
    try {
      const origem = semanaCapacidade(programada || vencimento);
      const semanaDestino = semanaCapacidade(destino);
      if (!origem || !semanaDestino) throw new Error("Informe datas válidas para origem e destino.");
      if ((origemParcial && origemParcial !== origem.inicio) || (destinoParcial && destinoParcial !== semanaDestino.inicio)) throw new Error("A semana mudou. Reconsulte os subtotais ou edite os valores.");
      const disponiveisOrigem = minutos(disponibilidadeOrigem);
      let demandaDaOrigem = minutos(demandaOrigem);
      const disponiveisDestino = minutos(disponibilidadeDestino);
      let demandaDoDestino = minutos(demandaDestino);
      if (deslocamentoSemanalOrigem || deslocamentoSemanalDestino) {
        if (!conferiuDeslocamentos || !deslocamentoSemanalOrigem || !deslocamentoSemanalDestino ||
          deslocamentoSemanalOrigem.semana !== origem.inicio || deslocamentoSemanalDestino.semana !== semanaDestino.inicio ||
          demandaDaOrigem === null || demandaDoDestino === null) throw new Error("Confira os deslocamentos das duas semanas e informe as demandas sem deslocamento.");
        demandaDaOrigem += deslocamentoSemanalOrigem.valor;
        demandaDoDestino += deslocamentoSemanalDestino.valor;
        if (!Number.isSafeInteger(demandaDaOrigem) || !Number.isSafeInteger(demandaDoDestino)) throw new Error("Demanda excede a precisão permitida.");
      }
      const esforcoBase = minutos(esforco);
      const deslocamento = minutos(deslocamentoPorPessoa);
      const pessoas = minutos(pessoasEmDeslocamento);
      if ((deslocamento === null) !== (pessoas === null) || (pessoas !== null && pessoas < 1)) throw new Error("Informe duração e número de pessoas para incluir deslocamento.");
      if (deslocamento !== null && esforcoBase === null) throw new Error("Informe o esforço da atividade antes de incluir deslocamento.");
      const deslocamentoTotal = deslocamento !== null && pessoas !== null ? deslocamento * pessoas : 0;
      const esforcoTotal = esforcoBase === null ? null : esforcoBase + deslocamentoTotal;
      if (!Number.isSafeInteger(deslocamentoTotal) || (esforcoTotal !== null && !Number.isSafeInteger(esforcoTotal))) throw new Error("Esforço informado excede a precisão permitida.");
      const esforcoTerceiro = tipoEquipe === "terceiro" ? minutos(tempoTerceiros) : null;
      const calculado = simularRemanejamento({
        vencimento,
        programada: programada || null,
        destino,
        esforcoMinutos: esforcoTotal,
        origem: { semanaInicio: origem.inicio, disponiveisMinutos: disponiveisOrigem, demandaMinutos: demandaDaOrigem, completa: !origemParcial && !deslocamentoSemanalOrigem && disponiveisOrigem !== null && demandaDaOrigem !== null },
        destinoSemana: { semanaInicio: semanaDestino.inicio, disponiveisMinutos: disponiveisDestino, demandaMinutos: demandaDoDestino, completa: !destinoParcial && !deslocamentoSemanalDestino && disponiveisDestino !== null && demandaDoDestino !== null },
        equipe: { simultaneidade: verificado(simultaneidade), qualificacao: verificado(qualificacao), conflito: verificado(conflito) },
      });
      const terceiroIncompleto = tipoEquipe === "terceiro" && (!esforcoTerceiro || !esforcoBase);
      const resultadoFinal = terceiroIncompleto
        ? { ...calculado, origem: { ...calculado.origem, antes: null, depois: null }, destino: { ...calculado.destino, antes: null, depois: null },
            alertas: calculado.alertas.includes("capacidade_nao_verificada") ? calculado.alertas : [...calculado.alertas, "capacidade_nao_verificada"] }
        : calculado;
      setResultado(resultadoFinal);
      aoSimular?.({ vencimento, programada: programada || null, destino, alertas: [...resultadoFinal.alertas], origemParcial: !!origemParcial || !!deslocamentoSemanalOrigem, destinoParcial: !!destinoParcial || !!deslocamentoSemanalDestino });
      setErro("");
    } catch (e) {
      setResultado(null);
      aoSimular?.(null);
      setErro(e instanceof Error ? e.message : "Não foi possível simular.");
    }
  }

  return (
    <section aria-label="Simulação manual de remanejamento">
      <h3>Simulação manual de remanejamento</h3>
      <p>Prévia com dados informados por você. Não valida equipe nem salva alterações. Campos vazios mantêm os saldos desconhecidos. Subtotais parciais só são usados por escolha explícita e não comprovam capacidade.</p>
      <form onChange={() => { setResultado(null); aoSimular?.(null); setConferiuDeslocamentos(false); setErro(""); }} onSubmit={(e) => { e.preventDefault(); simular(); }}>
        <label>Vencimento original <input type="date" required value={vencimento} onChange={(e) => setVencimento(e.target.value)} /></label>
        <label>Data programada atual (opcional) <input type="date" value={programada} onChange={(e) => setProgramada(e.target.value)} /></label>
        <label>Data de destino <input type="date" required value={destino} onChange={(e) => setDestino(e.target.value)} /></label>
      <fieldset><legend>Calcular esforço previsto da atividade</legend>
          <label>Execução <select value={tipoEquipe} onChange={(e) => { alterarEstimativa(); setTipoEquipe(e.target.value === "terceiro" ? "terceiro" : "propria"); }}><option value="propria">Equipe própria</option><option value="terceiro">Terceiro com acompanhamento</option></select></label>
          <p>O tempo total não multiplica a quantidade novamente. {tipoEquipe === "terceiro" ? "Calcule abaixo apenas o acompanhamento da equipe própria; o tempo do terceiro é mostrado separadamente." : "Informe a equipe própria."} Acrescente deslocamento separadamente.</p>
          {tipoEquipe === "terceiro" && <label>Esforço de terceiros informado (minutos-homem) <input type="number" min="0" step="1" value={tempoTerceiros} onChange={(e) => { alterarEstimativa(); setTempoTerceiros(e.target.value); }} /></label>}
          <label>Tipo de tempo <select value={tipoTempo} onChange={(e) => { alterarEstimativa(); setTipoTempo(e.target.value === "por_unidade" ? "por_unidade" : "total"); }}><option value="total">Tempo total</option><option value="por_unidade">Tempo por unidade</option></select></label>
          <label>{tipoEquipe === "terceiro" ? "Duração do acompanhamento em minutos" : "Duração em minutos"} <input type="number" min="1" step="1" value={duracao} onChange={(e) => { alterarEstimativa(); setDuracao(e.target.value); }} /></label>
          <label>{tipoEquipe === "terceiro" ? "Pessoas da equipe própria no acompanhamento" : "Número de técnicos"} <input type="number" min="1" step="1" value={tecnicos} onChange={(e) => { alterarEstimativa(); setTecnicos(e.target.value); }} /></label>
          {tipoTempo === "por_unidade" && <label>Quantidade de unidades <input type="number" min="1" step="1" value={quantidade} onChange={(e) => { alterarEstimativa(); setQuantidade(e.target.value); }} /></label>}
          <button type="button" onClick={aplicarEstimativa}>Usar esforço calculado</button>
          {tipoEquipe === "terceiro" && <p>O esforço de terceiros não é somado ao esforço da equipe própria. A ausência de acompanhamento deixa a demanda própria incompleta.</p>}
        </fieldset>
        <label>Esforço da atividade, sem deslocamento (minutos-homem) <input type="number" min="1" step="1" value={esforco} onChange={(e) => { setCalculado(false); setEsforco(e.target.value); }} /></label>
        <fieldset><legend>Deslocamento adicional declarado, opcional</legend>
          <p>Preencha os dois campos apenas se o deslocamento ainda não estiver incluído nos valores informados. A quantidade deve representar pessoas da equipe própria que realmente se deslocam.</p>
          <label>Duração por pessoa (minutos) <input type="number" min="0" step="1" value={deslocamentoPorPessoa} onChange={(e) => setDeslocamentoPorPessoa(e.target.value)} /></label>
          <label>Pessoas da equipe própria <input type="number" min="1" step="1" value={pessoasEmDeslocamento} onChange={(e) => setPessoasEmDeslocamento(e.target.value)} /></label>
        </fieldset>
        <fieldset><legend>Semana de origem — valores informados</legend>
          <label>Disponibilidade (minutos-homem) <input type="number" min="0" step="1" value={disponibilidadeOrigem} onChange={(e) => setDisponibilidadeOrigem(e.target.value)} /></label>
          <CalcularDisponibilidade semana="origem" aoUsar={(valor) => { setDisponibilidadeOrigem(String(valor)); setResultado(null); aoSimular?.(null); }} aoAlterar={(valor) => { setDisponibilidadeOrigem(atual => atual === String(valor) ? "" : atual); setResultado(null); aoSimular?.(null); }} />
          <label>Demanda (minutos-homem) <input type="number" min="0" step="1" value={demandaOrigem} onChange={(e) => setDemandaOrigem(e.target.value)} /></label>
          {origemParcial && <><p>Subtotal parcial da semana {origemParcial}; saldo permanecerá desconhecido mesmo após edição.</p><button type="button" onClick={() => { setDisponibilidadeOrigem(""); setDemandaOrigem(""); setOrigemParcial(null); setConferiuDeslocamentos(false); setResultado(null); aoSimular?.(null); }}>Limpar subtotais da origem</button></>}
        </fieldset>
        <fieldset><legend>Semana de destino — valores informados</legend>
          <label>Disponibilidade (minutos-homem) <input type="number" min="0" step="1" value={disponibilidadeDestino} onChange={(e) => setDisponibilidadeDestino(e.target.value)} /></label>
          <CalcularDisponibilidade semana="destino" aoUsar={(valor) => { setDisponibilidadeDestino(String(valor)); setResultado(null); aoSimular?.(null); }} aoAlterar={(valor) => { setDisponibilidadeDestino(atual => atual === String(valor) ? "" : atual); setResultado(null); aoSimular?.(null); }} />
          <label>Demanda (minutos-homem) <input type="number" min="0" step="1" value={demandaDestino} onChange={(e) => setDemandaDestino(e.target.value)} /></label>
          {destinoParcial && <><p>Subtotal parcial da semana {destinoParcial}; saldo permanecerá desconhecido mesmo após edição.</p><button type="button" onClick={() => { setDisponibilidadeDestino(""); setDemandaDestino(""); setDestinoParcial(null); setConferiuDeslocamentos(false); setResultado(null); aoSimular?.(null); }}>Limpar subtotais do destino</button></>}
          {semanaOrigem && semanaOrigem === semanaDestino && <>
            <p>Origem e destino estão na mesma semana; a comparação exige os mesmos valores e a mesma origem dos dados.</p>
            <button type="button" disabled={!!disponibilidadeDestino || !!demandaDestino || !!destinoParcial || (!disponibilidadeOrigem && !demandaOrigem)} onClick={() => {
              setDisponibilidadeDestino(disponibilidadeOrigem); setDemandaDestino(demandaOrigem); setDestinoParcial(origemParcial);
              setConferiuDeslocamentos(false); setResultado(null); aoSimular?.(null); setErro("");
            }}>Copiar valores da origem para o destino</button>
            {(disponibilidadeDestino || demandaDestino || destinoParcial) && <p>Para copiar novamente, limpe os valores do destino primeiro.</p>}
          </>}
        </fieldset>
        {([
          ["Equipe disponível simultaneamente?", simultaneidade, setSimultaneidade],
          ["Equipe possui qualificação necessária?", qualificacao, setQualificacao],
          ["Existe conflito de agenda?", conflito, setConflito],
        ] as const).map(([rotulo, valor, atualizar]) => (
          <label key={rotulo}>{rotulo} <select value={valor} onChange={(e) => atualizar(e.target.value as Verificacao)}><option value="nao_verificado">Não verificado</option><option value="sim">Sim</option><option value="nao">Não</option></select></label>
        ))}
        <button type="submit">Simular</button>
      </form>
      {import.meta.env.VITE_SSO_DESLOCAMENTOS_SEMANA_ENABLED === "true" && <section aria-label="Hipótese de deslocamentos semanais">
        <h4>Deslocamentos semanais como hipótese parcial</h4>
        <p>Os subtotais são opcionais e incompletos. Se usar, confira que as demandas informadas acima não incluem deslocamento e que o esforço a mover inclui apenas o deslocamento da atividade reprogramada.</p>
        {semanaOrigem && <DeslocamentosSemana key={`origem:${userId}:${clienteId}:${semanaOrigem}`} userId={userId} clienteId={clienteId} semana={semanaOrigem} aoUsarParcial={(d) => {
          setDeslocamentoSemanalOrigem({ semana: d.semana, valor: d.minutosHomem });
          if (semanaDestino === d.semana) setDeslocamentoSemanalDestino({ semana: d.semana, valor: d.minutosHomem });
          setConferiuDeslocamentos(false); setResultado(null); aoSimular?.(null);
        }} />}
        {semanaDestino && semanaDestino !== semanaOrigem && <DeslocamentosSemana key={`destino:${userId}:${clienteId}:${semanaDestino}`} userId={userId} clienteId={clienteId} semana={semanaDestino} aoUsarParcial={(d) => {
          setDeslocamentoSemanalDestino({ semana: d.semana, valor: d.minutosHomem }); setConferiuDeslocamentos(false); setResultado(null); aoSimular?.(null);
        }} />}
        {(deslocamentoSemanalOrigem || deslocamentoSemanalDestino) && <>
          <p>Origem: {deslocamentoSemanalOrigem ? `${deslocamentoSemanalOrigem.valor} min na semana ${deslocamentoSemanalOrigem.semana}` : "não selecionado"}; destino: {deslocamentoSemanalDestino ? `${deslocamentoSemanalDestino.valor} min na semana ${deslocamentoSemanalDestino.semana}` : "não selecionado"}.</p>
          <label><input type="checkbox" checked={conferiuDeslocamentos} onChange={(e) => { setConferiuDeslocamentos(e.target.checked); setResultado(null); aoSimular?.(null); }} /> Conferi que as demandas não incluem esses deslocamentos e que não há dupla contagem.</label>
          <button type="button" onClick={() => { setDeslocamentoSemanalOrigem(null); setDeslocamentoSemanalDestino(null); setConferiuDeslocamentos(false); setResultado(null); aoSimular?.(null); }}>Remover subtotais de deslocamento</button>
        </>}
      </section>}
      {import.meta.env.VITE_SSO_SNAPSHOT_CAPACIDADE_ENABLED === "true" && (
        <div>
          <label>
            <input type="checkbox" checked={consultarContexto} onChange={(e) => setConsultarContexto(e.target.checked)} />
            Consultar declarações parciais das semanas informadas
          </label>
          {consultarContexto && (
            <p>Consultas independentes, não uma fotografia única. Confira as fontes e a data antes de usar qualquer valor; cobertura e esforço restante não estão comprovados.</p>
          )}
          {consultarContexto && semanaOrigem && (
            <div aria-label="Contexto parcial da semana de origem">
              <h4>Origem: semana de {semanaOrigem}</h4>
              <SnapshotCapacidade key={`${clienteId}:${semanaOrigem}`} userId={userId} clienteId={clienteId} semana={semanaOrigem}
                aoUsarParcial={(d) => { setDisponibilidadeOrigem(String(d.disponibilidade)); setDemandaOrigem(String(d.demanda)); setOrigemParcial(d.semana); setConferiuDeslocamentos(false); setResultado(null); aoSimular?.(null); }} />
            </div>
          )}
          {consultarContexto && semanaDestino && semanaDestino !== semanaOrigem && (
            <div aria-label="Contexto parcial da semana de destino">
              <h4>Destino: semana de {semanaDestino}</h4>
              <SnapshotCapacidade key={`${clienteId}:${semanaDestino}`} userId={userId} clienteId={clienteId} semana={semanaDestino}
                aoUsarParcial={(d) => { setDisponibilidadeDestino(String(d.disponibilidade)); setDemandaDestino(String(d.demanda)); setDestinoParcial(d.semana); setConferiuDeslocamentos(false); setResultado(null); aoSimular?.(null); }} />
            </div>
          )}
        </div>
      )}
      {erro && <p role="alert">{erro}</p>}
      {resultado && <div role="status">
        <p>Semana do vencimento original: {resultado.baselineSemana}.</p>
        {tipoEquipe === "terceiro" && <p>Esforço de terceiros informado: {tempoTerceiros ? `${tempoTerceiros} minutos-homem` : "não informado"}. Confira se o esforço próprio corresponde somente ao acompanhamento.</p>}
        {tipoEquipe === "terceiro" && (!tempoTerceiros || Number(tempoTerceiros) === 0 || !esforco) && <p>Esforço de terceiros ou acompanhamento próprio não informado; demanda incompleta.</p>}
        {[resultado.origem, resultado.destino].map((s, i) => <p key={i}>{i === 0 ? "Origem" : "Destino"}, semana de {s.semanaInicio}: antes {s.antes === null ? "desconhecido" : `${s.antes} min`}; depois {s.depois === null ? "desconhecido" : `${s.depois} min`}.</p>)}
        {resultado.alertas.length ? <><p>Alertas informativos:</p><ul>{resultado.alertas.map((alerta) => <li key={alerta}>{descricaoAlerta[alerta] ?? alerta}</li>)}</ul></> : <p>Nenhum alerta com os dados informados; a simulação não comprova disponibilidade real.</p>}
      </div>}
    </section>
  );
}

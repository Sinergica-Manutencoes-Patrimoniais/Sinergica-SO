import { Button } from "@sinergica/ui";
import { useState } from "react";
import type { RegraContratualResumo } from "../../application/calendario-contratual-gateway";
import { projetarVisitasContratuais } from "../../domain/calendario-contratual";
import { SimulacaoMudancaDia } from "./SimulacaoMudancaDia";

type PeriodoDeclaracoes = { inicio: string; fim: string };
export function SimulacaoRegra({ regra, feriadosDeclarados = [], periodoDeclaracoes = null }: { regra: RegraContratualResumo; feriadosDeclarados?: readonly string[]; periodoDeclaracoes?: PeriodoDeclaracoes | null }) {
  return <ConteudoSimulacao key={JSON.stringify([regra,feriadosDeclarados,periodoDeclaracoes])} regra={regra} feriadosDeclarados={feriadosDeclarados} periodoDeclaracoes={periodoDeclaracoes} />;
}

function ConteudoSimulacao({ regra, feriadosDeclarados, periodoDeclaracoes }: { regra: RegraContratualResumo; feriadosDeclarados: readonly string[]; periodoDeclaracoes: PeriodoDeclaracoes | null }) {
  const [inicio, setInicio] = useState("");
  const [fim, setFim] = useState("");
  const [feriado, setFeriado] = useState("");
  const [feriados, setFeriados] = useState<string[]>([...feriadosDeclarados]);
  const [resultado, setResultado] = useState<{
    assinatura: string;
    datas: string[];
    supressoes: string[];
  } | null>(null);
  const [erro, setErro] = useState("");
  const assinatura = JSON.stringify([regra, inicio, fim, feriados]);
  const datas = resultado?.assinatura === assinatura ? resultado.datas : null;
  const supressoes = resultado?.assinatura === assinatura ? resultado.supressoes : [];
  function simular() {
    setErro("");
    try {
      const resultado = projetarVisitasContratuais({
        regra,
        inicio,
        fim,
        feriados,
        visitasProtegidas: [],
      });
      setResultado({
        assinatura,
        datas: resultado.propostas.map((item) => item.data),
        supressoes: resultado.supressoes.map((item) => item.data),
      });
    } catch {
      setResultado(null);
      setErro("Confira o período da simulação; reduza-o se for muito extenso.");
    }
  }
  return (
    <section aria-label="Simulação da regra">
      <p>
        Simulação parcial: não consulta feriados oficiais, exceções, Visitas existentes ou
        reprogramações. Considere somente os feriados hipotéticos informados aqui. Não cria Visitas.
      </p>
      {periodoDeclaracoes && <p>Declarações carregadas para {periodoDeclaracoes.inicio} a {periodoDeclaracoes.fim}; a lista pode estar incompleta e não comprova feriados oficiais.</p>}
      {periodoDeclaracoes && inicio && fim && (inicio < periodoDeclaracoes.inicio || fim > periodoDeclaracoes.fim) && <p role="alert">A simulação excede o período consultado de declarações. Datas fora dele não foram conferidas.</p>}
      <label>
        Início da simulação
        <input
          className="input"
          type="date"
          value={inicio}
          onChange={(e) => {
            setInicio(e.target.value);
            setResultado(null);
            setErro("");
          }}
        />
      </label>
      <label>
        Fim da simulação
        <input
          className="input"
          type="date"
          value={fim}
          onChange={(e) => {
            setFim(e.target.value);
            setResultado(null);
            setErro("");
          }}
        />
      </label>
      <label>
        Feriado hipotético
        <input
          className="input"
          type="date"
          value={feriado}
          onChange={(e) => {
            setFeriado(e.target.value);
            setResultado(null);
            setErro("");
          }}
        />
      </label>
      <Button
        type="button"
        variant="secondary"
        disabled={!feriado}
        onClick={() => {
          if (!feriado) return;
          setFeriados((atuais) => [...new Set([...atuais, feriado])].sort());
          setFeriado("");
          setResultado(null);
          setErro("");
        }}
      >
        Adicionar feriado
      </Button>
      {feriados.length > 0 && (
        <ul aria-label="Feriados hipotéticos informados">
          {feriados.map((data) => (
            <li key={data}>
              {data}{" "}
              <button
                type="button"
                aria-label={`Remover feriado ${data}`}
                onClick={() => {
                  setFeriados((atuais) => atuais.filter((item) => item !== data));
                  setResultado(null);
                  setErro("");
                }}
              >
                Remover
              </button>
            </li>
          ))}
        </ul>
      )}
      {feriado && <p>Adicione ou limpe o feriado digitado antes de simular.</p>}
      <Button type="button" variant="secondary" disabled={Boolean(feriado)} onClick={simular}>
        Simular datas
      </Button>
      {erro && <p role="alert">{erro}</p>}
      {datas !== null && (
        <p>
          Prévia: {datas.length} {datas.length === 1 ? "data proposta" : "datas propostas"} e{" "}
          {supressoes.length} {supressoes.length === 1 ? "data suprimida" : "datas suprimidas"}.
        </p>
      )}
      {datas !== null &&
        (datas.length ? (
          <ul>
            {datas.map((data) => (
              <li key={data}>{data}</li>
            ))}
          </ul>
        ) : (
          <p>Nenhuma data na janela informada.</p>
        ))}
      {supressoes.length > 0 && (
        <ul aria-label="Datas suprimidas">
          {supressoes.map((data) => (
            <li key={data}>{data} — suprimida por feriado hipotético</li>
          ))}
        </ul>
      )}
      {!feriado && (
        <SimulacaoMudancaDia regra={regra} inicio={inicio} fim={fim} feriados={feriados} />
      )}
    </section>
  );
}

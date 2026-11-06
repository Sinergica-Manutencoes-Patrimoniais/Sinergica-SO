import { useState } from "react";
import {
  type ImpactoMudancaDia,
  type PreviaVisitasEntrada,
  preverMudancaDiaContratual,
} from "../../domain/calendario-contratual";

export function SimulacaoMudancaDia(props: {
  regra: PreviaVisitasEntrada["regra"];
  inicio: string;
  fim: string;
  feriados: readonly string[];
}) {
  return <Conteudo key={JSON.stringify(props)} {...props} />;
}

function Conteudo({
  regra,
  inicio,
  fim,
  feriados,
}: {
  regra: PreviaVisitasEntrada["regra"];
  inicio: string;
  fim: string;
  feriados: readonly string[];
}) {
  const [hoje, setHoje] = useState("");
  const [vigencia, setVigencia] = useState("");
  const [dia, setDia] = useState("");
  const [impactos, setImpactos] = useState<ImpactoMudancaDia[] | null>(null);
  const [erro, setErro] = useState("");
  function limpar() {
    setImpactos(null);
    setErro("");
  }
  function comparar() {
    try {
      const resultado = preverMudancaDiaContratual({
        regraAtual: regra,
        novoDiaSemana: Number(dia),
        vigencia,
        hoje,
        inicio,
        fim,
        feriados,
        visitasProtegidas: [],
      });
      setImpactos(resultado.impactos);
      setErro("");
    } catch {
      setImpactos(null);
      setErro(
        "Confira período, data de referência, vigência e novo dia; reduza a janela se necessário.",
      );
    }
  }
  const descricao = (item: { data: string; situacao: string } | null) =>
    item ? `${item.data} — ${item.situacao}` : "sem data na janela";
  return (
    <section aria-label="Comparação hipotética de mudança">
      <p>
        Comparação hipotética: não tem acesso a feriados oficiais, exceções ou Visitas existentes;
        não confirma impacto operacional nem altera a regra.
      </p>
      <label>
        Data de referência hipotética
        <input
          type="date"
          value={hoje}
          onChange={(e) => {
            setHoje(e.target.value);
            limpar();
          }}
        />
      </label>
      <label>
        Início hipotético da mudança
        <input
          type="date"
          value={vigencia}
          onChange={(e) => {
            setVigencia(e.target.value);
            limpar();
          }}
        />
      </label>
      <label>
        Novo dia hipotético
        <select
          value={dia}
          onChange={(e) => {
            setDia(e.target.value);
            limpar();
          }}
        >
          <option value="">Selecione</option>
          {["Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado", "Domingo"].map(
            (nome, indice) => (
              <option key={nome} value={indice + 1}>
                {nome}
              </option>
            ),
          )}
        </select>
      </label>
      <button type="button" onClick={comparar}>
        Comparar mudança hipotética
      </button>
      {erro && <p role="alert">{erro}</p>}
      {impactos &&
        (impactos.length ? (
          <ul>
            {impactos.map((item) => (
              <li key={item.semana}>
                Semana {item.semana} — {item.classificacao}; antes:{" "}
                <span>{descricao(item.antes)}</span>; depois: <span>{descricao(item.depois)}</span>
              </li>
            ))}
          </ul>
        ) : (
          <p>Nenhuma diferença na janela informada.</p>
        ))}
    </section>
  );
}

import { useCallback, useEffect, useState } from "react";
import { listarOpcoesAgenda } from "../application/agenda-tecnico";
import type { OpcaoClienteAgenda, OpcaoFuncionario } from "../application/agenda-tecnico-gateway";
import { listarItensRelatorioPlanejamento } from "../application/relatorio-planejamento";
import {
  type ItemRelatorioPlanejamento,
  type ModoRelatorioPlanejamento,
  formatarTextoRelatorioPlanejamento,
} from "../domain/relatorio-planejamento";
import { supabaseAgendaTecnicoAdapter } from "../infrastructure/supabase-agenda-tecnico-adapter";
import { supabaseHubOsAdapter } from "../infrastructure/supabase-hub-os-adapter";

const hoje = new Date().toISOString().slice(0, 10);

export function RelatorioPlanejamentoPage() {
  const [data, setData] = useState(hoje);
  const [tecnicoId, setTecnicoId] = useState("");
  const [clienteId, setClienteId] = useState("");
  const [modo, setModo] = useState<ModoRelatorioPlanejamento>("planejamento");
  const [itens, setItens] = useState<ItemRelatorioPlanejamento[]>([]);
  const [funcionarios, setFuncionarios] = useState<OpcaoFuncionario[]>([]);
  const [clientes, setClientes] = useState<OpcaoClienteAgenda[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);

  const carregar = useCallback(async () => {
    setCarregando(true);
    setErro(null);
    try {
      const [resultado, opcoes] = await Promise.all([
        listarItensRelatorioPlanejamento(supabaseAgendaTecnicoAdapter, supabaseHubOsAdapter, {
          data,
          tecnicoId: tecnicoId || undefined,
          clienteId: clienteId || undefined,
        }),
        listarOpcoesAgenda(supabaseAgendaTecnicoAdapter),
      ]);
      setItens(resultado);
      setFuncionarios(opcoes[0]);
      setClientes(opcoes[1]);
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Não foi possível gerar o relatório.");
    } finally {
      setCarregando(false);
    }
  }, [data, tecnicoId, clienteId]);
  useEffect(() => {
    void carregar();
  }, [carregar]);
  const texto = formatarTextoRelatorioPlanejamento(modo, itens);

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h2 className="text-base font-semibold text-ink">Relatório de planejamento</h2>
        <p className="text-sm text-ink-3">Agenda e OS planejadas por dia, técnico e cliente</p>
      </div>
      <div className="flex flex-wrap gap-2 rounded-[8px] border border-line bg-card p-3">
        <input
          aria-label="Data"
          type="date"
          value={data}
          onChange={(e) => setData(e.target.value)}
          className="input"
        />
        <select
          aria-label="Técnico"
          value={tecnicoId}
          onChange={(e) => setTecnicoId(e.target.value)}
          className="input"
        >
          <option value="">Todos os técnicos</option>
          {funcionarios.map((x) => (
            <option key={x.id} value={x.id}>
              {x.nome}
            </option>
          ))}
        </select>
        <select
          aria-label="Cliente"
          value={clienteId}
          onChange={(e) => setClienteId(e.target.value)}
          className="input"
        >
          <option value="">Todos os clientes</option>
          {clientes.map((x) => (
            <option key={x.id} value={x.id}>
              {x.nome}
            </option>
          ))}
        </select>
        <button
          type="button"
          onClick={() => setModo("planejamento")}
          className={modo === "planejamento" ? "btn-primary" : "btn-secondary"}
        >
          Planejamento
        </button>
        <button
          type="button"
          onClick={() => setModo("execucao")}
          className={modo === "execucao" ? "btn-primary" : "btn-secondary"}
        >
          Execução
        </button>
      </div>
      {erro ? (
        <p className="text-sm text-[#A12D24]">{erro}</p>
      ) : carregando ? (
        <p className="text-sm text-ink-3">Carregando…</p>
      ) : itens.length === 0 ? (
        <p className="rounded-[8px] border border-line p-5 text-sm text-ink-3">
          Nada planejado para este dia/técnico.
        </p>
      ) : (
        <pre className="whitespace-pre-wrap rounded-[8px] border border-line bg-card p-4 text-sm text-ink">
          {texto}
        </pre>
      )}
    </div>
  );
}

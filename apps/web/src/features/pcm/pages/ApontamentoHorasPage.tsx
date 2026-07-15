import { Clock, RefreshCw } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { usePermissoes } from "../../../app/permissoes-context";
import { buscarValorHoraTecnico, obterApontamentoHoras } from "../application/apontamento-horas";
import type {
  ClienteOpcaoHoras,
  TecnicoOpcaoHoras,
} from "../application/apontamento-horas-gateway";
import { calcularCusto } from "../domain/apontamento-horas";
import type { AgregadoHoras, ApontamentoHorasItem } from "../domain/apontamento-horas";
import { supabaseApontamentoHorasAdapter } from "../infrastructure/supabase-apontamento-horas-adapter";

type Estado =
  | { fase: "carregando" }
  | { fase: "erro"; mensagem: string }
  | {
      fase: "pronto";
      itens: ApontamentoHorasItem[];
      clientes: ClienteOpcaoHoras[];
      tecnicos: TecnicoOpcaoHoras[];
      porCliente: AgregadoHoras[];
      porTecnico: AgregadoHoras[];
    };

function inicioDoMes(): string {
  const agora = new Date();
  return new Date(agora.getFullYear(), agora.getMonth(), 1).toISOString().slice(0, 10);
}

function hoje(): string {
  return new Date().toISOString().slice(0, 10);
}

export function ApontamentoHorasPage({
  onAbrirCliente,
  onAbrirTecnico,
}: {
  /** AC-5 (E01-S75): clique numa linha de "Horas por cliente" abre a visão 360 já filtrada ao
   * mesmo período. `chave === "sem-vinculo"` nunca chama isto (não tem cliente pra abrir). */
  onAbrirCliente?: (clienteId: string, periodo: { inicio: string; fim: string }) => void;
  /** Clique numa linha de "Horas por técnico" abre Ordens de Serviço filtrada por ele+período. */
  onAbrirTecnico?: (tecnicoFuncionarioId: string, periodo: { inicio: string; fim: string }) => void;
}) {
  const { carregando: permissoesCarregando, podeAcessar } = usePermissoes();
  const [estado, setEstado] = useState<Estado>({ fase: "carregando" });
  const [inicio, setInicio] = useState(inicioDoMes());
  const [fim, setFim] = useState(hoje());
  const [tecnicoFuncionarioId, setTecnicoFuncionarioId] = useState("");
  const [clienteId, setClienteId] = useState("");
  const [custosPorTecnico, setCustosPorTecnico] = useState<Map<string, number | null>>(new Map());

  const temLeitura = podeAcessar("pcm", "leitura");

  const carregar = useCallback(async () => {
    setEstado({ fase: "carregando" });
    try {
      const resultado = await obterApontamentoHoras(supabaseApontamentoHorasAdapter, {
        inicio,
        fim,
        tecnicoFuncionarioId: tecnicoFuncionarioId || null,
        clienteId: clienteId || null,
      });
      setEstado({ fase: "pronto", ...resultado });
      const custos = await Promise.all(
        resultado.porTecnico
          .filter((item) => item.chave !== "sem-vinculo")
          .map(
            async (item) =>
              [
                item.chave,
                await buscarValorHoraTecnico(supabaseApontamentoHorasAdapter, item.chave),
              ] as const,
          ),
      );
      setCustosPorTecnico(new Map(custos));
    } catch (error) {
      setEstado({
        fase: "erro",
        mensagem: error instanceof Error ? error.message : "Não foi possível carregar apontamento.",
      });
    }
  }, [inicio, fim, tecnicoFuncionarioId, clienteId]);

  useEffect(() => {
    if (!permissoesCarregando && temLeitura) carregar();
  }, [permissoesCarregando, temLeitura, carregar]);

  const temAlgumCusto = useMemo(
    () => [...custosPorTecnico.values()].some((v) => v != null),
    [custosPorTecnico],
  );

  if (permissoesCarregando)
    return <div className="p-8 text-center text-sm text-ink-3">Carregando...</div>;
  if (!temLeitura) {
    return (
      <div className="p-12 text-center">
        <h2 className="text-lg font-semibold text-ink-2">Acesso restrito</h2>
        <p className="mt-1 text-sm text-ink-3">Você não tem permissão de leitura no módulo PCM.</p>
      </div>
    );
  }
  if (estado.fase === "carregando") {
    return <div className="p-8 text-center text-sm text-ink-3">Carregando...</div>;
  }
  if (estado.fase === "erro") {
    return (
      <div className="p-12 text-center">
        <h2 className="text-lg font-semibold text-ink-2">Algo deu errado</h2>
        <p className="mt-1 text-sm text-ink-3">{estado.mensagem}</p>
        <button
          type="button"
          onClick={carregar}
          className="mt-4 inline-flex items-center gap-2 text-sm font-semibold text-orange hover:text-orange-deep"
        >
          <RefreshCw className="h-4 w-4" />
          Tentar novamente
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <section className="rounded-[8px] border border-line bg-card p-4 shadow-[0_1px_2px_rgba(20,28,54,0.035)]">
        <h3 className="text-base font-semibold text-ink">Apontamento de Horas</h3>
        <p className="mt-0.5 text-sm text-ink-3">
          Horas por OS derivadas do Auvo (check-in/out) — liga tarefa, técnico e cliente
        </p>
        <div className="mt-3 grid grid-cols-1 gap-2 md:grid-cols-4">
          <label className="block">
            <span className="mb-1 block text-xs font-semibold text-ink-3">De</span>
            <input
              type="date"
              value={inicio}
              onChange={(e) => setInicio(e.target.value)}
              className="input h-9 w-full"
            />
          </label>
          <label className="block">
            <span className="mb-1 block text-xs font-semibold text-ink-3">Até</span>
            <input
              type="date"
              value={fim}
              onChange={(e) => setFim(e.target.value)}
              className="input h-9 w-full"
            />
          </label>
          <label className="block">
            <span className="mb-1 block text-xs font-semibold text-ink-3">Técnico</span>
            <select
              value={tecnicoFuncionarioId}
              onChange={(e) => setTecnicoFuncionarioId(e.target.value)}
              className="input h-9 w-full"
            >
              <option value="">Todos</option>
              {estado.tecnicos.map((tecnico) => (
                <option key={tecnico.id} value={tecnico.id}>
                  {tecnico.nome}
                </option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className="mb-1 block text-xs font-semibold text-ink-3">Cliente</span>
            <select
              value={clienteId}
              onChange={(e) => setClienteId(e.target.value)}
              className="input h-9 w-full"
            >
              <option value="">Todos</option>
              {estado.clientes.map((cliente) => (
                <option key={cliente.id} value={cliente.id}>
                  {cliente.nome}
                </option>
              ))}
            </select>
          </label>
        </div>
      </section>

      <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
        <AgregadoPainel
          titulo="Horas por cliente"
          itens={estado.porCliente}
          custosPorChave={null}
          onSelecionar={
            onAbrirCliente ? (chave) => onAbrirCliente(chave, { inicio, fim }) : undefined
          }
        />
        <AgregadoPainel
          titulo="Horas por técnico"
          itens={estado.porTecnico}
          custosPorChave={custosPorTecnico}
          onSelecionar={
            onAbrirTecnico ? (chave) => onAbrirTecnico(chave, { inicio, fim }) : undefined
          }
        />
      </div>
      {!temAlgumCusto && (
        <p className="text-xs text-ink-3">
          Custo disponível quando o módulo Financeiro estiver ativo (E04-S06).
        </p>
      )}

      <section className="rounded-[8px] border border-line bg-card overflow-hidden">
        <div className="border-b border-line-soft px-4 py-3">
          <h4 className="text-sm font-semibold text-ink">OS no período</h4>
          <p className="text-xs text-ink-3">{estado.itens.length} ordem(ns) de serviço</p>
        </div>
        {estado.itens.length === 0 ? (
          <div className="px-5 py-10 text-center">
            <Clock className="mx-auto h-9 w-9 text-ink-3" />
            <p className="mt-3 text-sm text-ink-3">Nenhuma OS com apontamento neste período.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] text-left text-sm">
              <thead className="border-b border-line bg-line-soft text-xs uppercase text-ink-3">
                <tr>
                  <th className="px-4 py-2.5 font-semibold">OS</th>
                  <th className="px-4 py-2.5 font-semibold">Cliente</th>
                  <th className="px-4 py-2.5 font-semibold">Técnico</th>
                  <th className="px-4 py-2.5 font-semibold">Data</th>
                  <th className="px-4 py-2.5 font-semibold">Horas</th>
                </tr>
              </thead>
              <tbody>
                {estado.itens.map((item) => (
                  <tr key={item.osId} className="border-b border-line last:border-b-0">
                    <td className="px-4 py-2.5 font-brand text-xs tabular-nums text-ink-3">
                      {item.osNumero}
                    </td>
                    <td className="px-4 py-2.5 text-ink-2">{item.clienteNome}</td>
                    <td className="px-4 py-2.5 text-ink-2">{item.tecnicoNome}</td>
                    <td className="px-4 py-2.5 text-ink-3">
                      {item.dataAgendada
                        ? new Date(item.dataAgendada).toLocaleDateString("pt-BR")
                        : "—"}
                    </td>
                    <td className="px-4 py-2.5 font-semibold text-ink">
                      {item.horas > 0 ? `${item.horas}h` : "sem apontamento"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}

function AgregadoPainel({
  titulo,
  itens,
  custosPorChave,
  onSelecionar,
}: {
  titulo: string;
  itens: AgregadoHoras[];
  custosPorChave: Map<string, number | null> | null;
  /** AC-5: ausente = linhas não clicáveis (mantém o painel utilizável sem callback de navegação). */
  onSelecionar?: (chave: string) => void;
}) {
  return (
    <section className="rounded-[8px] border border-line bg-card overflow-hidden">
      <div className="border-b border-line-soft px-4 py-3">
        <h4 className="text-sm font-semibold text-ink">{titulo}</h4>
      </div>
      {itens.length === 0 ? (
        <p className="px-4 py-6 text-sm text-ink-3">Sem dados no período.</p>
      ) : (
        <ul className="divide-y divide-line-soft">
          {itens.map((item) => {
            const valorHora = custosPorChave?.get(item.chave) ?? null;
            const custo = calcularCusto(item.totalHoras, valorHora);
            // "sem-vinculo" (OS sem cliente/técnico) não tem destino de navegação nenhum.
            const clicavel = Boolean(onSelecionar) && item.chave !== "sem-vinculo";
            const linha = (
              <>
                <span className="min-w-0 truncate text-ink-2">{item.nome}</span>
                <span className="shrink-0 font-semibold text-ink">
                  {item.totalHoras}h · {item.totalOs} OS
                  {custo != null && (
                    <span className="ml-2 text-xs font-normal text-ink-3">
                      R$ {custo.toFixed(2)}
                    </span>
                  )}
                </span>
              </>
            );
            if (clicavel) {
              return (
                <li key={item.chave}>
                  <button
                    type="button"
                    onClick={() => onSelecionar?.(item.chave)}
                    className="flex w-full items-center justify-between gap-2 px-4 py-2.5 text-left text-sm hover:bg-line-soft/60"
                  >
                    {linha}
                  </button>
                </li>
              );
            }
            return (
              <li
                key={item.chave}
                className="flex items-center justify-between gap-2 px-4 py-2.5 text-sm"
              >
                {linha}
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

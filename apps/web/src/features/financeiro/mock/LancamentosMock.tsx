import { Button, Modal } from "@sinergica/ui";
import { Plus } from "lucide-react";
import { useMemo, useState } from "react";
import { PageHeader, StatusChip, TableShell } from "./MockUi";
import { CLIENTES, LANCAMENTOS, brl, dataCurta } from "./mock-data";

export function LancamentosMock() {
  const [filtroTipo, setFiltroTipo] = useState("todos");
  const [filtroStatus, setFiltroStatus] = useState("todos");
  const [filtroConta, setFiltroConta] = useState("todas");
  const [busca, setBusca] = useState("");
  const [modalAberto, setModalAberto] = useState(false);

  const linhas = useMemo(
    () =>
      LANCAMENTOS.filter((l) => {
        if (filtroTipo !== "todos" && l.tipo !== filtroTipo) return false;
        if (filtroStatus !== "todos" && l.status !== filtroStatus) return false;
        if (filtroConta !== "todas" && l.conta !== filtroConta) return false;
        const alvo = busca.toLowerCase();
        if (alvo && !l.cliente.toLowerCase().includes(alvo) && !l.desc.toLowerCase().includes(alvo))
          return false;
        return true;
      }),
    [filtroTipo, filtroStatus, filtroConta, busca],
  );

  return (
    <div className="page-stack">
      <PageHeader
        title="Lançamentos"
        subtitle="Entradas e saídas — ciclo previsto → realizado → conciliado."
        actions={
          <Button
            variant="accent"
            icon={<Plus className="h-4 w-4" />}
            onClick={() => setModalAberto(true)}
          >
            Novo lançamento
          </Button>
        }
      />
      <div className="surface-card flex flex-wrap gap-2 p-3">
        <select
          className="input w-auto"
          value={filtroTipo}
          onChange={(e) => setFiltroTipo(e.target.value)}
        >
          <option value="todos">Todos os tipos</option>
          <option value="entrada">Entrada</option>
          <option value="saida">Saída</option>
        </select>
        <select
          className="input w-auto"
          value={filtroStatus}
          onChange={(e) => setFiltroStatus(e.target.value)}
        >
          <option value="todos">Todos os status</option>
          <option value="previsto">Previsto</option>
          <option value="realizado">Realizado</option>
        </select>
        <select
          className="input w-auto"
          value={filtroConta}
          onChange={(e) => setFiltroConta(e.target.value)}
        >
          <option value="todas">Todas as contas</option>
          <option value="Itaú PJ">Itaú PJ</option>
          <option value="Nubank PJ">Nubank PJ</option>
        </select>
        <input
          className="input w-auto flex-1 min-w-[160px]"
          type="text"
          placeholder="Buscar cliente ou descrição…"
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
        />
      </div>
      <TableShell
        head={
          <>
            <th className="px-4 py-3">Data</th>
            <th className="px-4 py-3">Descrição</th>
            <th className="px-4 py-3">Categoria</th>
            <th className="px-4 py-3">Cliente</th>
            <th className="px-4 py-3">Status</th>
            <th className="px-4 py-3 text-right">Valor</th>
          </>
        }
      >
        {linhas.length === 0 ? (
          <tr>
            <td colSpan={6} className="px-4 py-8 text-center text-ink-3">
              Nenhum lançamento com esse filtro.
            </td>
          </tr>
        ) : (
          linhas.map((l, i) => (
            <tr key={`${l.data}-${i}`}>
              <td className="px-4 py-3 text-ink-3">{dataCurta(l.data)}</td>
              <td className="px-4 py-3 font-medium text-ink">{l.desc}</td>
              <td className="px-4 py-3 text-ink-3">{l.cat}</td>
              <td className="px-4 py-3 text-ink-3">{l.cliente}</td>
              <td className="px-4 py-3">
                <StatusChip status={l.status} />
              </td>
              <td
                className={`px-4 py-3 text-right tabular-nums font-semibold ${l.tipo === "entrada" ? "text-success" : "text-ink"}`}
              >
                {l.tipo === "entrada" ? "+ " : "− "}
                {brl(l.valor)}
              </td>
            </tr>
          ))
        )}
      </TableShell>

      <NovoLancamentoModal aberto={modalAberto} onFechar={() => setModalAberto(false)} />
    </div>
  );
}

function NovoLancamentoModal({ aberto, onFechar }: { aberto: boolean; onFechar: () => void }) {
  const [tipo, setTipo] = useState<"entrada" | "saida">("entrada");

  return (
    <Modal
      open={aberto}
      onOpenChange={(open) => {
        if (!open) onFechar();
      }}
      titulo="Novo lançamento"
      descricao="Registre uma entrada ou saída manual."
      tamanho="sm"
    >
      <div className="mb-3 flex overflow-hidden rounded-lg border border-line">
        <button
          type="button"
          onClick={() => setTipo("entrada")}
          className={`flex-1 px-3 py-2 text-caption font-semibold ${tipo === "entrada" ? "bg-success-soft text-success" : "bg-card text-ink-2"}`}
        >
          ↓ Entrada
        </button>
        <button
          type="button"
          onClick={() => setTipo("saida")}
          className={`flex-1 px-3 py-2 text-caption font-semibold ${tipo === "saida" ? "bg-orange-soft text-orange-deep" : "bg-card text-ink-2"}`}
        >
          ↑ Saída
        </button>
      </div>

      <label className="mb-3 block">
        <span className="mb-1 block text-micro font-semibold text-ink-2">Descrição</span>
        <input
          className="input"
          type="text"
          placeholder="Ex.: Laudo SPDA — Cond. Jardins do Lago"
        />
      </label>
      <div className="mb-3 grid grid-cols-2 gap-2.5">
        <label className="block">
          <span className="mb-1 block text-micro font-semibold text-ink-2">Valor (R$)</span>
          <input className="input" type="text" placeholder="0,00" />
        </label>
        <label className="block">
          <span className="mb-1 block text-micro font-semibold text-ink-2">Competência</span>
          <input className="input" type="date" />
        </label>
      </div>
      <div className="mb-3 grid grid-cols-2 gap-2.5">
        <label className="block">
          <span className="mb-1 block text-micro font-semibold text-ink-2">Categoria</span>
          <select className="input">
            <option>Serviços avulsos</option>
            <option>Peças e materiais</option>
            <option>Combustível</option>
            <option>Receita de contrato</option>
          </select>
        </label>
        <label className="block">
          <span className="mb-1 block text-micro font-semibold text-ink-2">Cliente (opcional)</span>
          <select className="input">
            <option value="">—</option>
            {CLIENTES.map((c) => (
              <option key={c}>{c}</option>
            ))}
          </select>
        </label>
      </div>
      <label className="mb-4 block">
        <span className="mb-1 block text-micro font-semibold text-ink-2">Status</span>
        <select className="input">
          <option value="previsto">Previsto</option>
          <option value="realizado">Realizado</option>
        </select>
      </label>

      <div className="flex justify-end gap-2">
        <Button variant="secondary" onClick={onFechar}>
          Cancelar
        </Button>
        <Button variant="primary" onClick={onFechar}>
          Salvar lançamento
        </Button>
      </div>
    </Modal>
  );
}

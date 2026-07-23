import { Plus, RefreshCw, Users, X } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { useAuth } from "../../../app/auth-context";
import { usePermissoes } from "../../../app/permissoes-context";
import type { FuncionarioOpcao } from "../application/financeiro-gateway";
import {
  criarCustoFuncionario,
  listarCustosFuncionario,
  listarFuncionariosOpcoes,
} from "../application/rentabilidade";
import { centavosParaReais, reaisParaCentavos } from "../domain/dinheiro";
import { custoHoraDerivado, validarCustoFuncionario } from "../domain/rentabilidade";
import type { CustoFuncionarioFormData, CustoFuncionarioItem } from "../domain/rentabilidade";
import { supabaseFinanceiroAdapter } from "../infrastructure/supabase-financeiro-adapter";

type Estado =
  | { fase: "carregando" }
  | { fase: "erro"; mensagem: string }
  | { fase: "pronto"; custos: CustoFuncionarioItem[]; funcionarios: FuncionarioOpcao[] };

export function CustosPessoalPage() {
  const { user } = useAuth();
  const { carregando: permissoesCarregando, podeAcessar } = usePermissoes();
  const [estado, setEstado] = useState<Estado>({ fase: "carregando" });
  const [modalAberto, setModalAberto] = useState(false);
  const [erroAcao, setErroAcao] = useState<string | null>(null);

  const temLeitura = podeAcessar("financeiro", "leitura");
  const temEscrita = podeAcessar("financeiro", "escrita");

  const carregar = useCallback(async () => {
    setEstado({ fase: "carregando" });
    try {
      const [custos, funcionarios] = await Promise.all([
        listarCustosFuncionario(supabaseFinanceiroAdapter),
        listarFuncionariosOpcoes(supabaseFinanceiroAdapter),
      ]);
      setEstado({ fase: "pronto", custos, funcionarios });
    } catch (error) {
      setEstado({
        fase: "erro",
        mensagem: error instanceof Error ? error.message : "Falha ao carregar custos de pessoal.",
      });
    }
  }, []);

  useEffect(() => {
    if (!permissoesCarregando && temLeitura) carregar();
  }, [permissoesCarregando, temLeitura, carregar]);

  async function salvar(input: CustoFuncionarioFormData) {
    if (!user) return;
    setErroAcao(null);
    await criarCustoFuncionario(supabaseFinanceiroAdapter, { ...input, userId: user.id });
    setModalAberto(false);
    await carregar();
  }

  if (permissoesCarregando || estado.fase === "carregando")
    return <div className="p-8 text-center text-sm text-ink-3">Carregando...</div>;
  if (!temLeitura) {
    return (
      <div className="p-12 text-center">
        <h2 className="text-lg font-semibold text-ink-2">Acesso restrito</h2>
        <p className="mt-1 text-sm text-ink-3">
          Você não tem permissão de leitura no módulo Financeiro.
        </p>
      </div>
    );
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

  const { custos, funcionarios } = estado;
  const funcionarioPorId = new Map(funcionarios.map((f) => [f.id, f.nome]));
  const porFuncionario = new Map<string, CustoFuncionarioItem[]>();
  for (const c of custos) {
    const lista = porFuncionario.get(c.funcionarioId) ?? [];
    lista.push(c);
    porFuncionario.set(c.funcionarioId, lista);
  }

  return (
    <div className="flex flex-col gap-4">
      <section className="rounded-[8px] border border-line bg-card p-4 shadow-[0_1px_2px_rgba(20,28,54,0.035)]">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h3 className="text-base font-semibold text-ink">Custos de pessoal</h3>
            <p className="mt-0.5 text-sm text-ink-3">
              Custo mensal por funcionário → R$/h derivado, com histórico de vigência.
            </p>
          </div>
          {temEscrita && (
            <button
              type="button"
              onClick={() => setModalAberto(true)}
              className="inline-flex h-9 items-center justify-center gap-2 rounded-[6px] bg-orange px-3 text-sm font-semibold text-white hover:bg-orange-deep"
            >
              <Plus className="h-4 w-4" />
              Novo custo
            </button>
          )}
        </div>
        {erroAcao && (
          <div className="mt-3 rounded-[6px] border border-[#F2C0B5] bg-[#FFF4F1] px-3 py-2 text-sm text-[#A23B25]">
            {erroAcao}
          </div>
        )}
      </section>

      {porFuncionario.size === 0 ? (
        <div className="rounded-[8px] border border-line bg-card px-5 py-10 text-center">
          <Users className="mx-auto h-9 w-9 text-ink-3" />
          <p className="mt-3 text-sm text-ink-3">Nenhum custo cadastrado.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-3 xl:grid-cols-2">
          {[...porFuncionario.entries()].map(([funcionarioId, historico]) => {
            const vigente = historico[0]; // já ordenado desc por vigente_desde
            return (
              <div key={funcionarioId} className="rounded-[8px] border border-line bg-card p-4">
                <h4 className="text-sm font-semibold text-ink">
                  {funcionarioPorId.get(funcionarioId) ?? "Funcionário"}
                </h4>
                {vigente && (
                  <p className="mt-1 text-2xl font-semibold text-ink">
                    R${" "}
                    {custoHoraDerivado(vigente.custoMensalCentavos, vigente.horasMesBase)
                      .toFixed(2)
                      .replace(".", ",")}
                    <span className="text-sm font-normal text-ink-3">/hora</span>
                  </p>
                )}
                <ul className="mt-3 flex flex-col gap-1 text-xs text-ink-3">
                  {historico.map((c) => (
                    <li key={c.id}>
                      Desde {new Date(c.vigenteDesde).toLocaleDateString("pt-BR")}: R${" "}
                      {centavosParaReais(c.custoMensalCentavos)}/mês · {c.horasMesBase}h base
                    </li>
                  ))}
                </ul>
              </div>
            );
          })}
        </div>
      )}

      {modalAberto && (
        <CustoModal
          funcionarios={funcionarios}
          onCancel={() => setModalAberto(false)}
          onSalvar={salvar}
        />
      )}
    </div>
  );
}

function CustoModal({
  funcionarios,
  onCancel,
  onSalvar,
}: {
  funcionarios: FuncionarioOpcao[];
  onCancel: () => void;
  onSalvar: (input: CustoFuncionarioFormData) => Promise<void>;
}) {
  const [funcionarioId, setFuncionarioId] = useState("");
  const [custoMensal, setCustoMensal] = useState("");
  const [horasMesBase, setHorasMesBase] = useState(220);
  const [vigenteDesde, setVigenteDesde] = useState(new Date().toISOString().slice(0, 10));
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  async function salvar() {
    try {
      setSalvando(true);
      setErro(null);
      const validado = validarCustoFuncionario({
        funcionarioId,
        custoMensalCentavos: reaisParaCentavos(custoMensal),
        horasMesBase,
        vigenteDesde,
      });
      await onSalvar(validado);
    } catch (error) {
      setErro(error instanceof Error ? error.message : "Não foi possível salvar.");
    } finally {
      setSalvando(false);
    }
  }

  return (
    <div className="modal-backdrop">
      <div className="w-full max-w-xl rounded-[8px] border border-line bg-card shadow-xl">
        <div className="flex items-center justify-between border-b border-line px-4 py-3">
          <h3 className="text-base font-semibold text-ink">Novo custo de funcionário</h3>
          <button type="button" onClick={onCancel} className="text-ink-3 hover:text-ink">
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="grid grid-cols-1 gap-3 p-4 sm:grid-cols-2">
          <label className="block sm:col-span-2">
            <span className="mb-1 block text-xs font-semibold text-ink-3">Funcionário *</span>
            <select
              value={funcionarioId}
              onChange={(e) => setFuncionarioId(e.target.value)}
              className="input w-full"
            >
              <option value="">Selecione...</option>
              {funcionarios.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.nome}
                </option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className="mb-1 block text-xs font-semibold text-ink-3">Custo mensal *</span>
            <input
              value={custoMensal}
              onChange={(e) => setCustoMensal(e.target.value)}
              className="input w-full"
              placeholder="0,00"
            />
          </label>
          <label className="block">
            <span className="mb-1 block text-xs font-semibold text-ink-3">Horas-base do mês *</span>
            <input
              type="number"
              value={horasMesBase}
              onChange={(e) => setHorasMesBase(Number(e.target.value))}
              className="input w-full"
            />
          </label>
          <label className="block sm:col-span-2">
            <span className="mb-1 block text-xs font-semibold text-ink-3">Vigente desde *</span>
            <input
              type="date"
              value={vigenteDesde}
              onChange={(e) => setVigenteDesde(e.target.value)}
              className="input w-full"
            />
          </label>
          {erro && (
            <div className="sm:col-span-2 rounded-[6px] border border-[#F2C0B5] bg-[#FFF4F1] px-3 py-2 text-sm text-[#A23B25]">
              {erro}
            </div>
          )}
        </div>
        <div className="flex justify-end gap-2 border-t border-line px-4 py-3">
          <button
            type="button"
            onClick={onCancel}
            className="h-9 rounded-[6px] border border-line px-3 text-sm font-semibold text-ink-2 hover:bg-line-soft"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={salvar}
            disabled={salvando}
            className="h-9 rounded-[6px] bg-orange px-3 text-sm font-semibold text-white hover:bg-orange-deep disabled:opacity-50"
          >
            {salvando ? "Salvando..." : "Salvar"}
          </button>
        </div>
      </div>
    </div>
  );
}

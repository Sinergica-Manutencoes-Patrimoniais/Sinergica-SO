import { RefreshCw, Save, Wrench } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useAuth } from "../../../app/auth-context";
import { usePermissoes } from "../../../app/permissoes-context";
import { alocarFerramenta, obterFerramentasPorTecnico } from "../application/ferramentas";
import type {
  FerramentaAlocacaoFormData,
  FerramentaAlocacaoItem,
  FerramentaItem,
  FuncionarioFerramentaOpcao,
} from "../domain/ferramentas";
import { supabaseFerramentasAdapter } from "../infrastructure/supabase-ferramentas-adapter";

type Estado =
  | { fase: "carregando" }
  | { fase: "erro"; mensagem: string }
  | {
      fase: "pronto";
      ferramentas: FerramentaItem[];
      funcionarios: FuncionarioFerramentaOpcao[];
      alocacoes: FerramentaAlocacaoItem[];
    };

export function FerramentasPorTecnicoPage() {
  const { user } = useAuth();
  const { carregando: permissoesCarregando, podeAcessar } = usePermissoes();
  const [estado, setEstado] = useState<Estado>({ fase: "carregando" });
  const [form, setForm] = useState<FerramentaAlocacaoFormData>({
    ferramentaId: "",
    funcionarioId: "",
    quantidade: 0,
  });
  const [salvando, setSalvando] = useState(false);
  const [erroAcao, setErroAcao] = useState<string | null>(null);

  const temLeitura = podeAcessar("pcm", "leitura");
  const temEscrita = podeAcessar("pcm", "escrita");

  const carregar = useCallback(async () => {
    setEstado({ fase: "carregando" });
    try {
      const dados = await obterFerramentasPorTecnico(supabaseFerramentasAdapter);
      setEstado({ fase: "pronto", ...dados });
    } catch (error) {
      setEstado({
        fase: "erro",
        mensagem: error instanceof Error ? error.message : "Falha ao carregar alocações.",
      });
    }
  }, []);

  useEffect(() => {
    if (!permissoesCarregando && temLeitura) carregar();
  }, [permissoesCarregando, temLeitura, carregar]);

  const alocacoesPorTecnico = useMemo(() => {
    if (estado.fase !== "pronto") return [];
    return [...estado.alocacoes].sort((a, b) => a.funcionarioNome.localeCompare(b.funcionarioNome));
  }, [estado]);

  async function salvar() {
    if (!user) return;
    try {
      setSalvando(true);
      setErroAcao(null);
      await alocarFerramenta(supabaseFerramentasAdapter, { ...form, userId: user.id });
      setForm((atual) => ({ ...atual, quantidade: 0 }));
      await carregar();
    } catch (error) {
      setErroAcao(error instanceof Error ? error.message : "Não foi possível alocar ferramenta.");
    } finally {
      setSalvando(false);
    }
  }

  if (permissoesCarregando || estado.fase === "carregando")
    return <div className="p-8 text-center text-sm text-ink-3">Carregando...</div>;
  if (!temLeitura) {
    return (
      <div className="p-12 text-center">
        <h2 className="text-lg font-semibold text-ink-2">Acesso restrito</h2>
        <p className="mt-1 text-sm text-ink-3">Você não tem permissão de leitura no módulo PCM.</p>
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

  return (
    <div className="flex flex-col gap-4">
      <section className="rounded-[8px] border border-line bg-card p-4 shadow-[0_1px_2px_rgba(20,28,54,0.035)]">
        <div className="flex flex-col gap-3 xl:flex-row xl:items-end xl:justify-between">
          <div>
            <h3 className="text-base font-semibold text-ink">Ferramentas por Técnico</h3>
            <p className="mt-0.5 text-sm text-ink-3">
              Alocação operacional sincronizada com o estoque por funcionário do Auvo
            </p>
          </div>
          {temEscrita && (
            <div className="grid grid-cols-1 gap-2 md:grid-cols-[minmax(180px,1fr)_minmax(180px,1fr)_120px_auto]">
              <select
                value={form.ferramentaId}
                onChange={(event) => setForm((a) => ({ ...a, ferramentaId: event.target.value }))}
                className="input h-9"
              >
                <option value="">Ferramenta</option>
                {estado.ferramentas.map((ferramenta) => (
                  <option key={ferramenta.id} value={ferramenta.id}>
                    {ferramenta.nome}
                  </option>
                ))}
              </select>
              <select
                value={form.funcionarioId}
                onChange={(event) => setForm((a) => ({ ...a, funcionarioId: event.target.value }))}
                className="input h-9"
              >
                <option value="">Técnico</option>
                {estado.funcionarios.map((funcionario) => (
                  <option key={funcionario.id} value={funcionario.id}>
                    {funcionario.nome}
                  </option>
                ))}
              </select>
              <input
                type="number"
                min={0}
                step={1}
                value={form.quantidade}
                onChange={(event) =>
                  setForm((a) => ({ ...a, quantidade: Number(event.target.value) }))
                }
                className="input h-9"
              />
              <button
                type="button"
                onClick={salvar}
                disabled={salvando}
                className="inline-flex h-9 items-center justify-center gap-2 rounded-[6px] bg-orange px-3 text-sm font-semibold text-white hover:bg-orange-deep disabled:opacity-50"
              >
                <Save className="h-4 w-4" />
                Salvar
              </button>
            </div>
          )}
        </div>
        {erroAcao && (
          <div className="mt-3 rounded-[6px] border border-[#F2C0B5] bg-[#FFF4F1] px-3 py-2 text-sm text-[#A23B25]">
            {erroAcao}
          </div>
        )}
      </section>

      {alocacoesPorTecnico.length === 0 ? (
        <div className="rounded-[8px] border border-line bg-card px-5 py-10 text-center">
          <Wrench className="mx-auto h-9 w-9 text-ink-3" />
          <p className="mt-3 text-sm text-ink-3">Nenhuma ferramenta alocada.</p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-[8px] border border-line bg-card">
          <table className="w-full min-w-[720px] text-left text-sm">
            <thead className="border-b border-line bg-line-soft text-xs uppercase text-ink-3">
              <tr>
                <th className="px-4 py-3 font-semibold">Técnico</th>
                <th className="px-4 py-3 font-semibold">Ferramenta</th>
                <th className="px-4 py-3 font-semibold">Quantidade</th>
                <th className="px-4 py-3 font-semibold">Auvo</th>
              </tr>
            </thead>
            <tbody>
              {alocacoesPorTecnico.map((alocacao) => (
                <tr key={alocacao.id} className="border-b border-line last:border-b-0">
                  <td className="px-4 py-3 text-ink">{alocacao.funcionarioNome}</td>
                  <td className="px-4 py-3 text-ink-2">{alocacao.ferramentaNome}</td>
                  <td className="px-4 py-3 text-ink-2">
                    {alocacao.quantidade} / {alocacao.quantidadeTotal}
                  </td>
                  <td className="px-4 py-3 text-ink-3">
                    Produto {alocacao.ferramentaAuvoId ?? "-"} · Usuário {alocacao.auvoUserId}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

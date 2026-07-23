import { CheckCircle2, EyeOff, Link2, RefreshCw, Upload } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { useAuth } from "../../../app/auth-context";
import { usePermissoes } from "../../../app/permissoes-context";
import { listarCategorias } from "../application/categorias";
import { listarContas } from "../application/contas";
import type { ClienteOpcao } from "../application/financeiro-gateway";
import {
  buscarCandidatosConciliacao,
  conciliarTransacao,
  criarLancamentoDeTransacao,
  ignorarTransacao,
  importarExtrato,
  listarTransacoesPendentes,
  processarArquivoOfx,
  sugerirClassificacao,
} from "../application/import-ofx";
import { listarClientesOpcoes } from "../application/lancamentos";
import type { CategoriaItem } from "../domain/categoria";
import type {
  ExtratoTransacaoItem,
  LancamentoPrevistoCandidato,
  SugestaoClassificacao,
} from "../domain/conciliacao";
import type { ContaBancariaItem } from "../domain/conta-bancaria";
import { centavosParaReais } from "../domain/dinheiro";
import type { TransacaoOfx } from "../domain/ofx";
import { supabaseFinanceiroAdapter } from "../infrastructure/supabase-financeiro-adapter";

type Estado =
  | { fase: "carregando" }
  | { fase: "erro"; mensagem: string }
  | {
      fase: "pronto";
      contas: ContaBancariaItem[];
      categorias: CategoriaItem[];
      clientes: ClienteOpcao[];
      pendentes: ExtratoTransacaoItem[];
    };

export function ImportOfxPage() {
  const { user } = useAuth();
  const { carregando: permissoesCarregando, podeAcessar } = usePermissoes();
  const [estado, setEstado] = useState<Estado>({ fase: "carregando" });
  const [contaSelecionada, setContaSelecionada] = useState("");
  const [previa, setPrevia] = useState<TransacaoOfx[] | null>(null);
  const [erroImport, setErroImport] = useState<string | null>(null);
  const [mensagemImport, setMensagemImport] = useState<string | null>(null);
  const [importando, setImportando] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const temLeitura = podeAcessar("financeiro", "leitura");
  const temEscrita = podeAcessar("financeiro", "escrita");

  const carregar = useCallback(async (contaId?: string) => {
    setEstado((atual) => (atual.fase === "pronto" ? atual : { fase: "carregando" }));
    try {
      const [contas, categorias, clientes, pendentes] = await Promise.all([
        listarContas(supabaseFinanceiroAdapter),
        listarCategorias(supabaseFinanceiroAdapter),
        listarClientesOpcoes(supabaseFinanceiroAdapter),
        listarTransacoesPendentes(supabaseFinanceiroAdapter, contaId || undefined),
      ]);
      setEstado({ fase: "pronto", contas, categorias, clientes, pendentes });
    } catch (error) {
      setEstado({
        fase: "erro",
        mensagem: error instanceof Error ? error.message : "Falha ao carregar import OFX.",
      });
    }
  }, []);

  // biome-ignore lint/correctness/useExhaustiveDependencies: carregar é useCallback([]), referência estável — incluir geraria loop sem mudar comportamento.
  useEffect(() => {
    if (!permissoesCarregando && temLeitura) carregar(contaSelecionada);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [permissoesCarregando, temLeitura, contaSelecionada]);

  async function selecionarArquivo(file: File) {
    setErroImport(null);
    setMensagemImport(null);
    try {
      const texto = await file.text();
      const { transacoes } = processarArquivoOfx(texto);
      setPrevia(transacoes);
    } catch (error) {
      setErroImport(error instanceof Error ? error.message : "Não foi possível ler o arquivo.");
      setPrevia(null);
    }
  }

  async function confirmarImportacao() {
    if (!previa || !contaSelecionada) return;
    setImportando(true);
    setErroImport(null);
    try {
      const texto = await new Promise<string>((resolve, reject) => {
        if (!inputRef.current?.files?.[0]) return reject(new Error("Arquivo não encontrado."));
        inputRef.current.files[0].text().then(resolve).catch(reject);
      });
      const resultado = await importarExtrato(supabaseFinanceiroAdapter, contaSelecionada, texto);
      setMensagemImport(`${resultado.novas} nova(s) · ${resultado.duplicadas} já importada(s).`);
      setPrevia(null);
      if (inputRef.current) inputRef.current.value = "";
      await carregar(contaSelecionada);
    } catch (error) {
      setErroImport(error instanceof Error ? error.message : "Falha ao importar.");
    } finally {
      setImportando(false);
    }
  }

  async function ignorar(transacao: ExtratoTransacaoItem) {
    await ignorarTransacao(supabaseFinanceiroAdapter, transacao.id);
    await carregar(contaSelecionada);
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
          onClick={() => carregar(contaSelecionada)}
          className="mt-4 inline-flex items-center gap-2 text-sm font-semibold text-orange hover:text-orange-deep"
        >
          <RefreshCw className="h-4 w-4" />
          Tentar novamente
        </button>
      </div>
    );
  }

  const { contas, categorias, clientes, pendentes } = estado;

  return (
    <div className="flex flex-col gap-4">
      <section className="rounded-[8px] border border-line bg-card p-4 shadow-[0_1px_2px_rgba(20,28,54,0.035)]">
        <h3 className="text-base font-semibold text-ink">Importar extrato (OFX)</h3>
        <p className="mt-0.5 text-sm text-ink-3">
          Upload → prévia → dedupe por FITID → classificação sugerida → conciliar ou criar
          lançamento.
        </p>

        <div className="mt-3 flex flex-wrap items-end gap-3">
          <label className="block">
            <span className="mb-1 block text-xs font-semibold text-ink-3">Conta *</span>
            <select
              value={contaSelecionada}
              onChange={(e) => setContaSelecionada(e.target.value)}
              className="input"
            >
              <option value="">Selecione a conta...</option>
              {contas.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.nome}
                </option>
              ))}
            </select>
          </label>
          {temEscrita && (
            <label className="inline-flex h-9 cursor-pointer items-center justify-center gap-2 rounded-[6px] border border-line px-3 text-sm font-semibold text-ink-2 hover:bg-line-soft">
              <Upload className="h-4 w-4" />
              Escolher arquivo .ofx
              <input
                ref={inputRef}
                type="file"
                accept=".ofx"
                disabled={!contaSelecionada}
                onChange={(e) => e.target.files?.[0] && selecionarArquivo(e.target.files[0])}
                className="hidden"
              />
            </label>
          )}
        </div>

        {erroImport && (
          <div className="mt-3 rounded-[6px] border border-[#F2C0B5] bg-[#FFF4F1] px-3 py-2 text-sm text-[#A23B25]">
            {erroImport}
          </div>
        )}
        {mensagemImport && <p className="mt-3 text-sm text-ink-3">{mensagemImport}</p>}

        {previa && (
          <div className="mt-3 rounded-[6px] border border-line p-3">
            <p className="text-sm font-semibold text-ink">
              Prévia — {previa.length} transação(ões) lida(s)
            </p>
            <ul className="mt-2 flex max-h-48 flex-col gap-1 overflow-y-auto text-xs text-ink-3">
              {previa.map((t) => (
                <li key={t.fitid} className="flex justify-between gap-2">
                  <span className="truncate">
                    {t.data} · {t.memo}
                  </span>
                  <span className={t.valorCentavos < 0 ? "text-[#A23B25]" : "text-[#1E8E45]"}>
                    R$ {centavosParaReais(t.valorCentavos)}
                  </span>
                </li>
              ))}
            </ul>
            {temEscrita && (
              <button
                type="button"
                onClick={confirmarImportacao}
                disabled={importando}
                className="mt-3 inline-flex h-9 items-center justify-center gap-2 rounded-[6px] bg-orange px-3 text-sm font-semibold text-white hover:bg-orange-deep disabled:opacity-50"
              >
                {importando ? "Importando..." : "Confirmar importação"}
              </button>
            )}
          </div>
        )}
      </section>

      <div className="rounded-[8px] border border-line bg-card p-4">
        <h4 className="mb-3 text-sm font-semibold text-ink">Pendentes ({pendentes.length})</h4>
        {pendentes.length === 0 ? (
          <p className="py-6 text-center text-sm text-ink-3">Nenhuma transação pendente.</p>
        ) : (
          <div className="flex flex-col gap-2">
            {pendentes.map((transacao) => (
              <LinhaPendente
                key={transacao.id}
                transacao={transacao}
                categorias={categorias}
                temEscrita={temEscrita}
                userId={user?.id}
                onIgnorar={() => ignorar(transacao)}
                onAtualizado={() => carregar(contaSelecionada)}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function LinhaPendente({
  transacao,
  categorias,
  temEscrita,
  userId,
  onIgnorar,
  onAtualizado,
}: {
  transacao: ExtratoTransacaoItem;
  categorias: CategoriaItem[];
  temEscrita: boolean;
  userId: string | undefined;
  onIgnorar: () => void;
  onAtualizado: () => void;
}) {
  const [sugestao, setSugestao] = useState<SugestaoClassificacao | null>(null);
  const [candidatos, setCandidatos] = useState<LancamentoPrevistoCandidato[]>([]);
  const [categoriaId, setCategoriaId] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [processando, setProcessando] = useState(false);

  // biome-ignore lint/correctness/useExhaustiveDependencies: roda só quando a transação muda de identidade (transacao.id) — funções importadas são estáveis, incluir o objeto inteiro geraria loop.
  useEffect(() => {
    sugerirClassificacao(supabaseFinanceiroAdapter, transacao).then((s) => {
      setSugestao(s);
      if (s?.categoriaId) setCategoriaId(s.categoriaId);
    });
    buscarCandidatosConciliacao(supabaseFinanceiroAdapter, transacao).then(setCandidatos);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [transacao.id]);

  async function conciliar(lancamentoId: string) {
    if (!userId) return;
    setProcessando(true);
    setErro(null);
    try {
      await conciliarTransacao(supabaseFinanceiroAdapter, {
        transacaoId: transacao.id,
        lancamentoId,
        dataPagamento: transacao.data,
        userId,
      });
      onAtualizado();
    } catch (error) {
      setErro(error instanceof Error ? error.message : "Falha ao conciliar.");
    } finally {
      setProcessando(false);
    }
  }

  async function criarLancamento() {
    if (!userId || !categoriaId) return;
    setProcessando(true);
    setErro(null);
    try {
      await criarLancamentoDeTransacao(supabaseFinanceiroAdapter, {
        transacaoId: transacao.id,
        categoriaId,
        clienteId: sugestao?.clienteId ?? null,
        fornecedorId: sugestao?.fornecedorId ?? null,
        userId,
      });
      onAtualizado();
    } catch (error) {
      setErro(error instanceof Error ? error.message : "Falha ao criar lançamento.");
    } finally {
      setProcessando(false);
    }
  }

  return (
    <div className="rounded-[6px] border border-line p-3">
      <div className="flex items-center justify-between gap-2">
        <div className="min-w-0">
          <p className="truncate text-sm text-ink-2">{transacao.memo ?? "Sem memo"}</p>
          <p className="text-xs text-ink-3">
            {new Date(transacao.data).toLocaleDateString("pt-BR")} · {transacao.tipoOfx ?? "—"}
          </p>
        </div>
        <span
          className={`text-sm font-semibold ${transacao.valorCentavos < 0 ? "text-[#A23B25]" : "text-[#1E8E45]"}`}
        >
          R$ {centavosParaReais(transacao.valorCentavos)}
        </span>
      </div>

      {erro && <p className="mt-2 text-xs text-[#A23B25]">{erro}</p>}

      {temEscrita && (
        <div className="mt-3 flex flex-wrap items-center gap-2">
          {candidatos.length > 0 && (
            <button
              type="button"
              onClick={() => candidatos[0] && conciliar(candidatos[0].id)}
              disabled={processando}
              className="inline-flex items-center gap-1 rounded-[6px] border border-line px-3 py-1.5 text-xs font-semibold text-ink-2 hover:bg-line-soft disabled:opacity-50"
            >
              <Link2 className="h-3.5 w-3.5" />
              Conciliar com previsto ({candidatos.length})
            </button>
          )}
          <select
            value={categoriaId}
            onChange={(e) => setCategoriaId(e.target.value)}
            className="input h-8 text-xs"
          >
            <option value="">Categoria...</option>
            {categorias.map((c) => (
              <option key={c.id} value={c.id}>
                {c.nome}
              </option>
            ))}
          </select>
          <button
            type="button"
            onClick={criarLancamento}
            disabled={processando || !categoriaId}
            className="inline-flex items-center gap-1 rounded-[6px] bg-orange px-3 py-1.5 text-xs font-semibold text-white hover:bg-orange-deep disabled:opacity-50"
          >
            <CheckCircle2 className="h-3.5 w-3.5" />
            Criar lançamento
          </button>
          <button
            type="button"
            onClick={onIgnorar}
            disabled={processando}
            className="inline-flex items-center gap-1 rounded-[6px] px-3 py-1.5 text-xs font-semibold text-ink-3 hover:bg-line-soft disabled:opacity-50"
          >
            <EyeOff className="h-3.5 w-3.5" />
            Ignorar
          </button>
        </div>
      )}
      {sugestao && <p className="mt-1 text-[11px] text-ink-3">Classificação sugerida por regra.</p>}
    </div>
  );
}

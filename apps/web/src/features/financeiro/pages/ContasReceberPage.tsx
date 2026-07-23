import { AlertCircle, Copy, QrCode, RefreshCw, TrendingUp, Wallet, X } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { useAuth } from "../../../app/auth-context";
import { usePermissoes } from "../../../app/permissoes-context";
import { emitirCobranca, listarCobrancasPorLancamento } from "../application/cobranca";
import { listarAgingRecebiveis } from "../application/contratos";
import type { ClienteOpcao } from "../application/financeiro-gateway";
import { baixarLancamento, listarClientesOpcoes } from "../application/lancamentos";
import {
  LABEL_FAIXA,
  ORDEM_FAIXAS,
  agruparInadimplenciaPorCliente,
  agruparPorFaixa,
  ehAlerta,
  percentualCarteiraEmAtraso,
} from "../domain/aging";
import type { FaixaAging, RecebivelAging } from "../domain/aging";
import type { CobrancaItem, CobrancaTipo } from "../domain/cobranca";
import { centavosParaReais } from "../domain/dinheiro";
import { supabaseFinanceiroAdapter } from "../infrastructure/supabase-financeiro-adapter";

type Estado =
  | { fase: "carregando" }
  | { fase: "erro"; mensagem: string }
  | { fase: "pronto"; recebiveis: RecebivelAging[]; clientes: ClienteOpcao[] };

type Visao = "faixa" | "cliente";

export function ContasReceberPage() {
  const { user } = useAuth();
  const { carregando: permissoesCarregando, podeAcessar } = usePermissoes();
  const [estado, setEstado] = useState<Estado>({ fase: "carregando" });
  const [visao, setVisao] = useState<Visao>("faixa");
  const [baixando, setBaixando] = useState<RecebivelAging | null>(null);
  const [cobrandoRecebivel, setCobrandoRecebivel] = useState<RecebivelAging | null>(null);
  const [erroAcao, setErroAcao] = useState<string | null>(null);

  const temLeitura = podeAcessar("financeiro", "leitura");
  const temEscrita = podeAcessar("financeiro", "escrita");

  const carregar = useCallback(async () => {
    setEstado({ fase: "carregando" });
    try {
      const [recebiveis, clientes] = await Promise.all([
        listarAgingRecebiveis(supabaseFinanceiroAdapter),
        listarClientesOpcoes(supabaseFinanceiroAdapter),
      ]);
      setEstado({ fase: "pronto", recebiveis, clientes });
    } catch (error) {
      setEstado({
        fase: "erro",
        mensagem: error instanceof Error ? error.message : "Falha ao carregar contas a receber.",
      });
    }
  }, []);

  useEffect(() => {
    if (!permissoesCarregando && temLeitura) carregar();
  }, [permissoesCarregando, temLeitura, carregar]);

  async function confirmarBaixa(recebivel: RecebivelAging, dataPagamento: string) {
    if (!user) return;
    try {
      setErroAcao(null);
      await baixarLancamento(supabaseFinanceiroAdapter, {
        id: recebivel.lancamentoId,
        dataPagamento,
        userId: user.id,
      });
      setBaixando(null);
      await carregar();
    } catch (error) {
      setErroAcao(error instanceof Error ? error.message : "Não foi possível dar baixa.");
    }
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

  const { recebiveis, clientes } = estado;
  const clientePorId = new Map(clientes.map((c) => [c.id, c.nome]));
  const grupos = agruparPorFaixa(recebiveis);
  const inadimplencia = agruparInadimplenciaPorCliente(recebiveis);
  const percentualAtraso = percentualCarteiraEmAtraso(recebiveis);

  return (
    <div className="flex flex-col gap-4">
      <section className="rounded-[8px] border border-line bg-card p-4 shadow-[0_1px_2px_rgba(20,28,54,0.035)]">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h3 className="text-base font-semibold text-ink">Contas a receber</h3>
            <p className="mt-0.5 text-sm text-ink-3">
              {percentualAtraso.toFixed(0)}% da carteira em atraso (D+3 ou mais)
            </p>
          </div>
          <div className="flex gap-1 rounded-[6px] border border-line p-0.5">
            <button
              type="button"
              onClick={() => setVisao("faixa")}
              className={`rounded-[4px] px-3 py-1 text-xs font-semibold ${visao === "faixa" ? "bg-orange text-white" : "text-ink-2"}`}
            >
              Por faixa
            </button>
            <button
              type="button"
              onClick={() => setVisao("cliente")}
              className={`rounded-[4px] px-3 py-1 text-xs font-semibold ${visao === "cliente" ? "bg-orange text-white" : "text-ink-2"}`}
            >
              Por cliente
            </button>
          </div>
        </div>
        {erroAcao && (
          <div className="mt-3 rounded-[6px] border border-[#F2C0B5] bg-[#FFF4F1] px-3 py-2 text-sm text-[#A23B25]">
            {erroAcao}
          </div>
        )}
      </section>

      {visao === "faixa" ? (
        <div className="flex flex-col gap-4">
          {ORDEM_FAIXAS.map((faixa) => (
            <FaixaSection
              key={faixa}
              faixa={faixa}
              itens={grupos[faixa]}
              clientePorId={clientePorId}
              temEscrita={temEscrita}
              onBaixar={setBaixando}
              onCobrar={setCobrandoRecebivel}
            />
          ))}
        </div>
      ) : (
        <div className="rounded-[8px] border border-line bg-card p-4">
          {inadimplencia.length === 0 ? (
            <p className="py-6 text-center text-sm text-ink-3">Nenhum cliente inadimplente.</p>
          ) : (
            <table className="w-full text-left text-sm">
              <thead className="border-b border-line text-xs font-semibold uppercase tracking-wide text-ink-3">
                <tr>
                  <th className="px-3 py-2">Cliente</th>
                  <th className="px-3 py-2 text-right">Total em atraso</th>
                  <th className="px-3 py-2 text-right">Recebíveis</th>
                  <th className="px-3 py-2 text-right">Dias (mais antigo)</th>
                </tr>
              </thead>
              <tbody>
                {inadimplencia.map((i) => (
                  <tr key={i.clienteId} className="border-b border-line last:border-0">
                    <td className="px-3 py-2 text-ink-2">
                      {clientePorId.get(i.clienteId) ?? "Cliente"}
                    </td>
                    <td className="px-3 py-2 text-right font-semibold text-[#A23B25]">
                      R$ {centavosParaReais(i.totalAtrasoCentavos)}
                    </td>
                    <td className="px-3 py-2 text-right text-ink-2">{i.quantidade}</td>
                    <td className="px-3 py-2 text-right text-ink-2">{i.diasMaisAntigo}d</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {baixando && (
        <BaixaModal
          recebivel={baixando}
          onCancel={() => setBaixando(null)}
          onConfirmar={confirmarBaixa}
        />
      )}

      {cobrandoRecebivel && (
        <CobrancaModal
          recebivel={cobrandoRecebivel}
          onCancel={() => setCobrandoRecebivel(null)}
          onEmitida={carregar}
        />
      )}
    </div>
  );
}

function FaixaSection({
  faixa,
  itens,
  clientePorId,
  temEscrita,
  onBaixar,
  onCobrar,
}: {
  faixa: FaixaAging;
  itens: RecebivelAging[];
  clientePorId: Map<string, string>;
  temEscrita: boolean;
  onBaixar: (r: RecebivelAging) => void;
  onCobrar: (r: RecebivelAging) => void;
}) {
  if (itens.length === 0) return null;
  const total = itens.reduce((soma, i) => soma + i.valorCentavos, 0);

  return (
    <div className="rounded-[8px] border border-line bg-card p-4">
      <div className="mb-3 flex items-center justify-between">
        <h4 className="flex items-center gap-1.5 text-sm font-semibold text-ink">
          {ehAlerta(faixa) && <AlertCircle className="h-3.5 w-3.5 text-[#A23B25]" />}
          {LABEL_FAIXA[faixa]}
          <span className="text-xs font-normal text-ink-3">({itens.length})</span>
        </h4>
        <span className="text-sm font-semibold text-ink">R$ {centavosParaReais(total)}</span>
      </div>
      <div className="flex flex-col gap-2">
        {itens.map((item) => (
          <div
            key={item.lancamentoId}
            className="flex items-center justify-between gap-2 rounded-[6px] border border-line px-3 py-2"
          >
            <div className="min-w-0">
              <p className="truncate text-sm text-ink-2">
                {clientePorId.get(item.clienteId ?? "") ?? "Sem cliente"} —{" "}
                {item.descricao ?? "Recebível"}
              </p>
              <p className="text-xs text-ink-3">
                Vence {new Date(item.dataVencimento).toLocaleDateString("pt-BR")}
                {item.diasAtraso > 0 && ` · ${item.diasAtraso}d de atraso`}
              </p>
            </div>
            <div className="flex shrink-0 items-center gap-3">
              <span className="text-sm font-semibold text-ink">
                R$ {centavosParaReais(item.valorCentavos)}
              </span>
              {temEscrita && (
                <button
                  type="button"
                  onClick={() => onCobrar(item)}
                  className="inline-flex items-center gap-1 text-xs font-semibold text-ink-2 hover:text-ink"
                >
                  <QrCode className="h-3.5 w-3.5" />
                  Cobrança
                </button>
              )}
              {temEscrita && (
                <button
                  type="button"
                  onClick={() => onBaixar(item)}
                  className="inline-flex items-center gap-1 text-xs font-semibold text-orange hover:text-orange-deep"
                >
                  <Wallet className="h-3.5 w-3.5" />
                  Baixar
                </button>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function BaixaModal({
  recebivel,
  onCancel,
  onConfirmar,
}: {
  recebivel: RecebivelAging;
  onCancel: () => void;
  onConfirmar: (recebivel: RecebivelAging, dataPagamento: string) => Promise<void>;
}) {
  const [dataPagamento, setDataPagamento] = useState(new Date().toISOString().slice(0, 10));
  const [confirmando, setConfirmando] = useState(false);

  async function confirmar() {
    setConfirmando(true);
    await onConfirmar(recebivel, dataPagamento);
    setConfirmando(false);
  }

  return (
    <div className="modal-backdrop">
      <div className="w-full max-w-sm rounded-[8px] border border-line bg-card shadow-xl">
        <div className="flex items-center justify-between border-b border-line px-4 py-3">
          <h3 className="flex items-center gap-1.5 text-base font-semibold text-ink">
            <TrendingUp className="h-4 w-4" />
            Dar baixa
          </h3>
          <button type="button" onClick={onCancel} className="text-ink-3 hover:text-ink">
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="p-4">
          <p className="text-sm text-ink-2">
            R$ {centavosParaReais(recebivel.valorCentavos)} — confirme a data de recebimento.
          </p>
          <label className="mt-3 block">
            <span className="mb-1 block text-xs font-semibold text-ink-3">
              Data de recebimento *
            </span>
            <input
              type="date"
              value={dataPagamento}
              onChange={(e) => setDataPagamento(e.target.value)}
              className="input w-full"
            />
          </label>
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
            onClick={confirmar}
            disabled={confirmando}
            className="h-9 rounded-[6px] bg-orange px-3 text-sm font-semibold text-white hover:bg-orange-deep disabled:opacity-50"
          >
            {confirmando ? "Confirmando..." : "Confirmar recebimento"}
          </button>
        </div>
      </div>
    </div>
  );
}

const STATUS_COBRANCA_LABEL: Record<CobrancaItem["status"], string> = {
  pendente: "Aguardando pagamento",
  pago: "Pago",
  cancelado: "Cancelado",
  estornado: "Estornado",
  expirado: "Expirado",
};

function CobrancaModal({
  recebivel,
  onCancel,
  onEmitida,
}: {
  recebivel: RecebivelAging;
  onCancel: () => void;
  onEmitida: () => Promise<void>;
}) {
  const [carregando, setCarregando] = useState(true);
  const [cobrancas, setCobrancas] = useState<CobrancaItem[]>([]);
  const [emitindo, setEmitindo] = useState<CobrancaTipo | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  const carregar = useCallback(async () => {
    setCarregando(true);
    try {
      setCobrancas(
        await listarCobrancasPorLancamento(supabaseFinanceiroAdapter, recebivel.lancamentoId),
      );
    } catch (error) {
      setErro(error instanceof Error ? error.message : "Não foi possível carregar cobranças.");
    } finally {
      setCarregando(false);
    }
  }, [recebivel.lancamentoId]);

  useEffect(() => {
    carregar();
  }, [carregar]);

  async function emitir(tipo: CobrancaTipo) {
    try {
      setEmitindo(tipo);
      setErro(null);
      await emitirCobranca(supabaseFinanceiroAdapter, recebivel.lancamentoId, tipo);
      await carregar();
      await onEmitida();
    } catch (error) {
      setErro(error instanceof Error ? error.message : "Não foi possível emitir a cobrança.");
    } finally {
      setEmitindo(null);
    }
  }

  const cobrancaAtiva = cobrancas.find((c) => c.status === "pendente" || c.status === "pago");

  return (
    <div className="modal-backdrop">
      <div className="w-full max-w-lg rounded-[8px] border border-line bg-card shadow-xl">
        <div className="flex items-center justify-between border-b border-line px-4 py-3">
          <h3 className="flex items-center gap-1.5 text-base font-semibold text-ink">
            <QrCode className="h-4 w-4" />
            Cobrança — R$ {centavosParaReais(recebivel.valorCentavos)}
          </h3>
          <button type="button" onClick={onCancel} className="text-ink-3 hover:text-ink">
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="flex flex-col gap-3 p-4">
          {carregando ? (
            <p className="text-sm text-ink-3">Carregando...</p>
          ) : cobrancaAtiva ? (
            <div className="flex flex-col gap-3">
              <p className="text-sm text-ink-2">
                {cobrancaAtiva.tipo === "pix" ? "PIX" : "Boleto"} emitido —{" "}
                <span className="font-semibold">{STATUS_COBRANCA_LABEL[cobrancaAtiva.status]}</span>
              </p>
              {cobrancaAtiva.qrCodeBase64 && (
                <img
                  src={`data:image/png;base64,${cobrancaAtiva.qrCodeBase64}`}
                  alt="QR Code PIX"
                  className="h-40 w-40 self-center rounded-[6px] border border-line"
                />
              )}
              {cobrancaAtiva.qrCode && (
                <CopiavelField label="Código PIX (copia e cola)" valor={cobrancaAtiva.qrCode} />
              )}
              {cobrancaAtiva.linhaDigitavel && (
                <CopiavelField label="Linha digitável" valor={cobrancaAtiva.linhaDigitavel} />
              )}
              {cobrancaAtiva.linkPagamento && (
                <a
                  href={cobrancaAtiva.linkPagamento}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm font-semibold text-orange hover:text-orange-deep"
                >
                  Abrir boleto
                </a>
              )}
            </div>
          ) : (
            <>
              <p className="text-sm text-ink-3">
                Nenhuma cobrança ativa para este recebível — emitir via Mercado Pago:
              </p>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => emitir("pix")}
                  disabled={emitindo !== null}
                  className="h-9 flex-1 rounded-[6px] bg-orange px-3 text-sm font-semibold text-white hover:bg-orange-deep disabled:opacity-50"
                >
                  {emitindo === "pix" ? "Emitindo..." : "Emitir PIX"}
                </button>
                <button
                  type="button"
                  onClick={() => emitir("boleto")}
                  disabled={emitindo !== null}
                  className="h-9 flex-1 rounded-[6px] border border-line text-sm font-semibold text-ink-2 hover:bg-line-soft disabled:opacity-50"
                >
                  {emitindo === "boleto" ? "Emitindo..." : "Emitir boleto"}
                </button>
              </div>
            </>
          )}
          {erro && (
            <div className="rounded-[6px] border border-[#F2C0B5] bg-[#FFF4F1] px-3 py-2 text-sm text-[#A23B25]">
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
            Fechar
          </button>
        </div>
      </div>
    </div>
  );
}

function CopiavelField({ label, valor }: { label: string; valor: string }) {
  const [copiado, setCopiado] = useState(false);
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-semibold text-ink-3">{label}</span>
      <div className="flex gap-2">
        <input readOnly value={valor} className="input flex-1 truncate" />
        <button
          type="button"
          onClick={async () => {
            await navigator.clipboard.writeText(valor);
            setCopiado(true);
            setTimeout(() => setCopiado(false), 2000);
          }}
          className="inline-flex h-9 shrink-0 items-center gap-1 rounded-[6px] border border-line px-3 text-xs font-semibold text-ink-2 hover:bg-line-soft"
        >
          <Copy className="h-3.5 w-3.5" />
          {copiado ? "Copiado!" : "Copiar"}
        </button>
      </div>
    </label>
  );
}

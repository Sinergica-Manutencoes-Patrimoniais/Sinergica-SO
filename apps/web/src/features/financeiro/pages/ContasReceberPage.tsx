import { Button, DataTable, Modal } from "@sinergica/ui";
import { AlertCircle, Copy, QrCode, RefreshCw, TrendingUp, Wallet } from "lucide-react";
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
    return <div className="p-8 text-center text-body text-ink-3">Carregando…</div>;
  if (!temLeitura) {
    return (
      <div className="p-12 text-center">
        <h2 className="text-lg font-semibold text-ink-2">Acesso restrito</h2>
        <p className="mt-1 text-body text-ink-3">
          Você não tem permissão de leitura no módulo Financeiro.
        </p>
      </div>
    );
  }
  if (estado.fase === "erro") {
    return (
      <div className="p-12 text-center">
        <h2 className="text-lg font-semibold text-ink-2">Algo deu errado</h2>
        <p className="mt-1 text-body text-ink-3">{estado.mensagem}</p>
        <Button
          variant="ghost"
          icon={<RefreshCw className="h-4 w-4" />}
          onClick={carregar}
          className="mt-4"
        >
          Tentar novamente
        </Button>
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
      <section className="rounded-lg border border-line bg-card p-4 shadow-raised">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h3 className="text-heading font-semibold text-ink">Contas a receber</h3>
            <p className="mt-0.5 text-body text-ink-3">
              {percentualAtraso.toFixed(0)}% da carteira em atraso (D+3 ou mais)
            </p>
          </div>
          <div className="flex gap-1 rounded-md border border-line p-0.5">
            <Button
              variant={visao === "faixa" ? "accent" : "ghost"}
              size="sm"
              onClick={() => setVisao("faixa")}
            >
              Por faixa
            </Button>
            <Button
              variant={visao === "cliente" ? "accent" : "ghost"}
              size="sm"
              onClick={() => setVisao("cliente")}
            >
              Por cliente
            </Button>
          </div>
        </div>
        {erroAcao && (
          <div className="mt-3 rounded-md border border-danger-line bg-danger-soft px-3 py-2 text-body text-danger">
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
        <div className="rounded-lg border border-line bg-card p-4">
          <DataTable
            colunas={[
              {
                chave: "cliente",
                cabecalho: "Cliente",
                render: (i) => clientePorId.get(i.clienteId) ?? "Cliente",
              },
              {
                chave: "totalAtraso",
                cabecalho: "Total em atraso",
                numerica: true,
                render: (i) => (
                  <span className="font-semibold text-danger">
                    R$ {centavosParaReais(i.totalAtrasoCentavos)}
                  </span>
                ),
              },
              {
                chave: "quantidade",
                cabecalho: "Recebíveis",
                numerica: true,
                render: (i) => i.quantidade,
              },
              {
                chave: "diasMaisAntigo",
                cabecalho: "Dias (mais antigo)",
                numerica: true,
                render: (i) => `${i.diasMaisAntigo}d`,
              },
            ]}
            itens={inadimplencia}
            chaveLinha={(i) => i.clienteId}
            vazio={<>Nenhum cliente inadimplente.</>}
          />
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
    <div className="rounded-lg border border-line bg-card p-4">
      <div className="mb-3 flex items-center justify-between">
        <h4 className="flex items-center gap-1.5 text-body font-semibold text-ink">
          {ehAlerta(faixa) && <AlertCircle className="h-3.5 w-3.5 text-danger" />}
          {LABEL_FAIXA[faixa]}
          <span className="text-caption font-normal text-ink-3">({itens.length})</span>
        </h4>
        <span className="text-body font-semibold text-ink">R$ {centavosParaReais(total)}</span>
      </div>
      <div className="flex flex-col gap-2">
        {itens.map((item) => (
          <div
            key={item.lancamentoId}
            className="flex items-center justify-between gap-2 rounded-md border border-line px-3 py-2"
          >
            <div className="min-w-0">
              <p className="truncate text-body text-ink-2">
                {clientePorId.get(item.clienteId ?? "") ?? "Sem cliente"} —{" "}
                {item.descricao ?? "Recebível"}
              </p>
              <p className="text-caption text-ink-3">
                Vence {new Date(item.dataVencimento).toLocaleDateString("pt-BR")}
                {item.diasAtraso > 0 && ` · ${item.diasAtraso}d de atraso`}
              </p>
            </div>
            <div className="flex shrink-0 items-center gap-3">
              <span className="text-body font-semibold text-ink">
                R$ {centavosParaReais(item.valorCentavos)}
              </span>
              {temEscrita && (
                <Button
                  variant="ghost"
                  size="sm"
                  icon={<QrCode className="h-3.5 w-3.5" />}
                  onClick={() => onCobrar(item)}
                >
                  Cobrança
                </Button>
              )}
              {temEscrita && (
                <Button
                  variant="ghost"
                  size="sm"
                  icon={<Wallet className="h-3.5 w-3.5" />}
                  onClick={() => onBaixar(item)}
                >
                  Baixar
                </Button>
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
    <Modal
      open
      onOpenChange={(aberto) => {
        if (!aberto) onCancel();
      }}
      titulo={
        <span className="flex items-center gap-1.5">
          <TrendingUp className="h-4 w-4" />
          Dar baixa
        </span>
      }
      tamanho="sm"
    >
      <div className="flex flex-col gap-4">
        <p className="text-body text-ink-2">
          R$ {centavosParaReais(recebivel.valorCentavos)} — confirme a data de recebimento.
        </p>
        <label className="block">
          <span className="mb-1 block text-caption font-semibold text-ink-3">
            Data de recebimento *
          </span>
          <input
            type="date"
            value={dataPagamento}
            onChange={(e) => setDataPagamento(e.target.value)}
            className="input w-full"
          />
        </label>
        <div className="flex justify-end gap-2 border-t border-line-soft pt-4">
          <Button variant="secondary" onClick={onCancel} disabled={confirmando}>
            Cancelar
          </Button>
          <Button
            variant="primary"
            onClick={confirmar}
            disabled={confirmando}
            loading={confirmando}
          >
            Confirmar recebimento
          </Button>
        </div>
      </div>
    </Modal>
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
    <Modal
      open
      onOpenChange={(aberto) => {
        if (!aberto) onCancel();
      }}
      titulo={
        <span className="flex items-center gap-1.5">
          <QrCode className="h-4 w-4" />
          Cobrança — R$ {centavosParaReais(recebivel.valorCentavos)}
        </span>
      }
      tamanho="md"
    >
      <div className="flex flex-col gap-3">
        {carregando ? (
          <p className="text-body text-ink-3">Carregando…</p>
        ) : cobrancaAtiva ? (
          <div className="flex flex-col gap-3">
            <p className="text-body text-ink-2">
              {cobrancaAtiva.tipo === "pix" ? "PIX" : "Boleto"} emitido —{" "}
              <span className="font-semibold">{STATUS_COBRANCA_LABEL[cobrancaAtiva.status]}</span>
            </p>
            {cobrancaAtiva.qrCodeBase64 && (
              <img
                src={`data:image/png;base64,${cobrancaAtiva.qrCodeBase64}`}
                alt="QR Code PIX"
                className="h-40 w-40 self-center rounded-md border border-line"
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
                className="text-body font-semibold text-orange hover:text-orange-deep"
              >
                Abrir boleto
              </a>
            )}
          </div>
        ) : (
          <>
            <p className="text-body text-ink-3">
              Nenhuma cobrança ativa para este recebível — emitir via Mercado Pago:
            </p>
            <div className="flex gap-2">
              <Button
                variant="accent"
                className="flex-1"
                onClick={() => emitir("pix")}
                disabled={emitindo !== null}
                loading={emitindo === "pix"}
              >
                Emitir PIX
              </Button>
              <Button
                variant="secondary"
                className="flex-1"
                onClick={() => emitir("boleto")}
                disabled={emitindo !== null}
                loading={emitindo === "boleto"}
              >
                Emitir boleto
              </Button>
            </div>
          </>
        )}
        {erro && (
          <div className="rounded-md border border-danger-line bg-danger-soft px-3 py-2 text-body text-danger">
            {erro}
          </div>
        )}
      </div>
      <div className="flex justify-end gap-2 border-t border-line-soft pt-4">
        <Button variant="secondary" onClick={onCancel}>
          Fechar
        </Button>
      </div>
    </Modal>
  );
}

function CopiavelField({ label, valor }: { label: string; valor: string }) {
  const [copiado, setCopiado] = useState(false);
  return (
    <label className="block">
      <span className="mb-1 block text-caption font-semibold text-ink-3">{label}</span>
      <div className="flex gap-2">
        <input readOnly value={valor} className="input flex-1 truncate" />
        <Button
          variant="secondary"
          size="sm"
          icon={<Copy className="h-3.5 w-3.5" />}
          onClick={async () => {
            await navigator.clipboard.writeText(valor);
            setCopiado(true);
            setTimeout(() => setCopiado(false), 2000);
          }}
        >
          {copiado ? "Copiado!" : "Copiar"}
        </Button>
      </div>
    </label>
  );
}

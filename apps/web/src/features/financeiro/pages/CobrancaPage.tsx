import { Button, ConfirmDialog, DataTable, Modal as ModalPrimitivo } from "@sinergica/ui";
import { BellRing, Pencil, Plus, RefreshCw, Trash2 } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { useAuth } from "../../../app/auth-context";
import { usePermissoes } from "../../../app/permissoes-context";
import {
  criarPontoRegua,
  desativarPontoRegua,
  editarPontoRegua,
  listarEnviosRegua,
  listarPontosRegua,
} from "../application/regua-cobranca";
import { centavosParaReais } from "../domain/dinheiro";
import { labelDiaOffset, validarPontoRegua } from "../domain/regua-cobranca";
import type {
  CanalCobranca,
  EnvioReguaItem,
  PontoReguaFormData,
  PontoReguaItem,
} from "../domain/regua-cobranca";
import { supabaseFinanceiroAdapter } from "../infrastructure/supabase-financeiro-adapter";

type Estado =
  | { fase: "carregando" }
  | { fase: "erro"; mensagem: string }
  | { fase: "pronto"; pontos: PontoReguaItem[]; envios: EnvioReguaItem[] };

type Modal = { modo: "novo"; ponto?: undefined } | { modo: "editar"; ponto: PontoReguaItem } | null;

const CANAL_LABEL: Record<CanalCobranca, string> = {
  whatsapp: "WhatsApp",
  email: "E-mail",
  ambos: "WhatsApp + E-mail",
};
const STATUS_LABEL: Record<EnvioReguaItem["status"], string> = {
  enviado: "Enviado",
  erro: "Erro",
  sem_canal: "Sem canal",
};

export function CobrancaPage() {
  const { user } = useAuth();
  const { carregando: permissoesCarregando, podeAcessar } = usePermissoes();
  const [estado, setEstado] = useState<Estado>({ fase: "carregando" });
  const [modal, setModal] = useState<Modal>(null);
  const [pontoParaDesativar, setPontoParaDesativar] = useState<PontoReguaItem | null>(null);

  const temLeitura = podeAcessar("financeiro", "leitura");
  const temEscrita = podeAcessar("financeiro", "escrita");

  const carregar = useCallback(async () => {
    setEstado({ fase: "carregando" });
    try {
      const [pontos, envios] = await Promise.all([
        listarPontosRegua(supabaseFinanceiroAdapter),
        listarEnviosRegua(supabaseFinanceiroAdapter),
      ]);
      setEstado({ fase: "pronto", pontos, envios });
    } catch (error) {
      setEstado({
        fase: "erro",
        mensagem: error instanceof Error ? error.message : "Falha ao carregar a régua de cobrança.",
      });
    }
  }, []);

  useEffect(() => {
    if (!permissoesCarregando && temLeitura) carregar();
  }, [permissoesCarregando, temLeitura, carregar]);

  async function salvar(input: PontoReguaFormData) {
    if (!user) return;
    if (modal?.modo === "editar") {
      await editarPontoRegua(supabaseFinanceiroAdapter, {
        ...input,
        id: modal.ponto.id,
        userId: user.id,
      });
    } else {
      await criarPontoRegua(supabaseFinanceiroAdapter, { ...input, userId: user.id });
    }
    setModal(null);
    await carregar();
  }

  async function desativar() {
    if (!user || !pontoParaDesativar) return;
    await desativarPontoRegua(supabaseFinanceiroAdapter, pontoParaDesativar.id, user.id);
    await carregar();
  }

  if (permissoesCarregando || estado.fase === "carregando")
    return <div className="p-8 text-center text-sm text-ink-3">Carregando…</div>;
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
        <Button
          variant="ghost"
          size="sm"
          icon={<RefreshCw className="h-4 w-4" />}
          onClick={carregar}
          className="mt-4"
        >
          Tentar novamente
        </Button>
      </div>
    );
  }

  const { pontos, envios } = estado;

  return (
    <div className="flex flex-col gap-4">
      <section className="rounded-lg border border-line bg-card p-4 shadow-raised">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h3 className="text-base font-semibold text-ink">Régua de cobrança</h3>
            <p className="mt-0.5 text-sm text-ink-3">
              Lembretes automáticos de vencimento — um job diário dispara cada ponto ativo
              (WhatsApp/e-mail).
            </p>
          </div>
          {temEscrita && (
            <Button
              variant="accent"
              icon={<Plus className="h-4 w-4" />}
              onClick={() => setModal({ modo: "novo" })}
            >
              Novo ponto
            </Button>
          )}
        </div>
      </section>

      <div className="rounded-lg border border-line bg-card">
        <DataTable
          colunas={[
            {
              chave: "ponto",
              cabecalho: "Ponto",
              render: (ponto: PontoReguaItem) => (
                <span className="font-semibold text-ink">{labelDiaOffset(ponto.diaOffset)}</span>
              ),
            },
            {
              chave: "canal",
              cabecalho: "Canal",
              render: (ponto: PontoReguaItem) => CANAL_LABEL[ponto.canal],
            },
            {
              chave: "mensagem",
              cabecalho: "Mensagem-modelo",
              render: (ponto: PontoReguaItem) => (
                <span className="block max-w-[360px] truncate">{ponto.mensagemModelo}</span>
              ),
            },
            {
              chave: "status",
              cabecalho: "Status",
              render: (ponto: PontoReguaItem) => (
                <span
                  className={`rounded-full px-2 py-0.5 text-micro font-semibold ${ponto.ativo ? "bg-success-soft text-success" : "bg-line-soft text-ink-2"}`}
                >
                  {ponto.ativo ? "Ativo" : "Inativo"}
                </span>
              ),
            },
            {
              chave: "acoes",
              cabecalho: "Ações",
              render: (ponto: PontoReguaItem) => (
                <div className="flex justify-end gap-2">
                  {temEscrita && (
                    <button
                      type="button"
                      onClick={() => setModal({ modo: "editar", ponto })}
                      className="inline-flex items-center gap-1 text-xs font-semibold text-ink-2 hover:text-ink"
                    >
                      <Pencil className="h-3.5 w-3.5" />
                      Editar
                    </button>
                  )}
                  {temEscrita && ponto.ativo && (
                    <button
                      type="button"
                      onClick={() => setPontoParaDesativar(ponto)}
                      className="inline-flex items-center gap-1 text-xs font-semibold text-danger hover:text-danger"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                      Desativar
                    </button>
                  )}
                </div>
              ),
            },
          ]}
          itens={pontos}
          chaveLinha={(ponto) => ponto.id}
          vazio={
            <span className="inline-flex flex-col items-center gap-2">
              <BellRing className="h-9 w-9 text-ink-3" />
              Nenhum ponto configurado — a régua não envia nada até o primeiro ponto ser criado.
            </span>
          }
        />
      </div>

      <section className="rounded-lg border border-line bg-card p-4">
        <h3 className="text-base font-semibold text-ink">Histórico de envios</h3>
        <p className="mt-0.5 text-sm text-ink-3">
          Registrado pelo job diário — nunca editável pela UI (auditoria).
        </p>
        <div className="mt-3">
          <DataTable
            colunas={[
              {
                chave: "quando",
                cabecalho: "Quando",
                render: (envio: EnvioReguaItem) =>
                  new Date(envio.enviadoEm).toLocaleString("pt-BR"),
              },
              {
                chave: "canal",
                cabecalho: "Canal",
                render: (envio: EnvioReguaItem) =>
                  envio.canalEfetivo ? CANAL_LABEL[envio.canalEfetivo] : "—",
              },
              {
                chave: "status",
                cabecalho: "Status",
                render: (envio: EnvioReguaItem) => STATUS_LABEL[envio.status],
              },
              {
                chave: "motivo",
                cabecalho: "Motivo",
                render: (envio: EnvioReguaItem) => (
                  <span className="block max-w-[320px] truncate text-ink-3">
                    {envio.motivo ?? "—"}
                  </span>
                ),
              },
            ]}
            itens={envios.slice(0, 50)}
            chaveLinha={(envio) => envio.id}
            vazio={<>Nenhum envio registrado ainda.</>}
          />
        </div>
      </section>

      {modal && (
        <PontoModal
          ponto={modal.modo === "editar" ? modal.ponto : undefined}
          onCancel={() => setModal(null)}
          onSalvar={salvar}
        />
      )}

      <ConfirmDialog
        open={pontoParaDesativar !== null}
        onOpenChange={(aberto) => {
          if (!aberto) setPontoParaDesativar(null);
        }}
        titulo={`Desativar o ponto "${pontoParaDesativar ? labelDiaOffset(pontoParaDesativar.diaOffset) : ""}"`}
        descricao="A régua deixa de disparar este ponto."
        rotuloConfirmar="Desativar"
        onConfirmar={desativar}
      />
    </div>
  );
}

function PontoModal({
  ponto,
  onCancel,
  onSalvar,
}: {
  ponto?: PontoReguaItem;
  onCancel: () => void;
  onSalvar: (input: PontoReguaFormData) => Promise<void>;
}) {
  const [diaOffset, setDiaOffset] = useState(ponto?.diaOffset ?? -3);
  const [canal, setCanal] = useState<CanalCobranca>(ponto?.canal ?? "whatsapp");
  const [mensagemModelo, setMensagemModelo] = useState(
    ponto?.mensagemModelo ?? "Olá {{cliente}}, você tem R$ {{valor}} vencendo em {{vencimento}}.",
  );
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  async function salvar() {
    try {
      setSalvando(true);
      setErro(null);
      const validado = validarPontoRegua({ diaOffset, canal, mensagemModelo });
      await onSalvar(validado);
    } catch (error) {
      setErro(error instanceof Error ? error.message : "Não foi possível salvar.");
    } finally {
      setSalvando(false);
    }
  }

  return (
    <ModalPrimitivo
      open
      onOpenChange={(aberto) => {
        if (!aberto) onCancel();
      }}
      titulo={ponto ? "Editar ponto da régua" : "Novo ponto da régua"}
      tamanho="md"
    >
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <label className="block">
          <span className="mb-1 block text-xs font-semibold text-ink-3">
            Dia em relação ao vencimento *
          </span>
          <input
            type="number"
            value={diaOffset}
            onChange={(e) => setDiaOffset(Number(e.target.value))}
            className="input w-full"
            placeholder="-3"
          />
          <span className="mt-1 block text-micro text-ink-3">
            Negativo = antes (D-3), positivo = depois (D+7). Preview: {labelDiaOffset(diaOffset)}
          </span>
        </label>
        <label className="block">
          <span className="mb-1 block text-xs font-semibold text-ink-3">Canal *</span>
          <select
            value={canal}
            onChange={(e) => setCanal(e.target.value as CanalCobranca)}
            className="input w-full"
          >
            <option value="whatsapp">WhatsApp</option>
            <option value="email">E-mail</option>
            <option value="ambos">WhatsApp + E-mail</option>
          </select>
        </label>
        <label className="block sm:col-span-2">
          <span className="mb-1 block text-xs font-semibold text-ink-3">Mensagem-modelo *</span>
          <textarea
            value={mensagemModelo}
            onChange={(e) => setMensagemModelo(e.target.value)}
            className="input min-h-[96px] w-full resize-y"
          />
          <span className="mt-1 block text-micro text-ink-3">
            Placeholders: <code>{"{{cliente}}"}</code>, <code>{"{{valor}}"}</code>,{" "}
            <code>{"{{vencimento}}"}</code>
          </span>
        </label>
        {ponto && (
          <p className="text-xs text-ink-3 sm:col-span-2">
            Exemplo de valor real: R$ {centavosParaReais(15000)} — só ilustrativo, não afeta o
            envio.
          </p>
        )}
        {erro && (
          <div className="sm:col-span-2 rounded-md border border-danger-line bg-danger-soft px-3 py-2 text-sm text-danger">
            {erro}
          </div>
        )}
        <div className="flex justify-end gap-2 pt-2 sm:col-span-2">
          <Button variant="secondary" onClick={onCancel} disabled={salvando}>
            Cancelar
          </Button>
          <Button variant="accent" onClick={salvar} loading={salvando}>
            {salvando ? "Salvando…" : "Salvar"}
          </Button>
        </div>
      </div>
    </ModalPrimitivo>
  );
}

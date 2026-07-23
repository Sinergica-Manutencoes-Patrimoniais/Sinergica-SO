import { BellRing, Pencil, Plus, RefreshCw, Trash2, X } from "lucide-react";
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
  const [erroAcao, setErroAcao] = useState<string | null>(null);

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
    setErroAcao(null);
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

  async function desativar(ponto: PontoReguaItem) {
    if (!user || !confirm(`Desativar o ponto "${labelDiaOffset(ponto.diaOffset)}"?`)) return;
    try {
      setErroAcao(null);
      await desativarPontoRegua(supabaseFinanceiroAdapter, ponto.id, user.id);
      await carregar();
    } catch (error) {
      setErroAcao(error instanceof Error ? error.message : "Não foi possível desativar.");
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

  const { pontos, envios } = estado;

  return (
    <div className="flex flex-col gap-4">
      <section className="rounded-[8px] border border-line bg-card p-4 shadow-[0_1px_2px_rgba(20,28,54,0.035)]">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h3 className="text-base font-semibold text-ink">Régua de cobrança</h3>
            <p className="mt-0.5 text-sm text-ink-3">
              Lembretes automáticos de vencimento — um job diário dispara cada ponto ativo
              (WhatsApp/e-mail).
            </p>
          </div>
          {temEscrita && (
            <button
              type="button"
              onClick={() => setModal({ modo: "novo" })}
              className="inline-flex h-9 items-center justify-center gap-2 rounded-[6px] bg-orange px-3 text-sm font-semibold text-white hover:bg-orange-deep"
            >
              <Plus className="h-4 w-4" />
              Novo ponto
            </button>
          )}
        </div>
        {erroAcao && (
          <div className="mt-3 rounded-[6px] border border-[#F2C0B5] bg-[#FFF4F1] px-3 py-2 text-sm text-[#A23B25]">
            {erroAcao}
          </div>
        )}
      </section>

      {pontos.length === 0 ? (
        <div className="rounded-[8px] border border-line bg-card px-5 py-10 text-center">
          <BellRing className="mx-auto h-9 w-9 text-ink-3" />
          <p className="mt-3 text-sm text-ink-3">
            Nenhum ponto configurado — a régua não envia nada até o primeiro ponto ser criado.
          </p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-[8px] border border-line bg-card">
          <table className="w-full min-w-[560px] text-left text-sm">
            <thead className="border-b border-line text-xs font-semibold uppercase tracking-wide text-ink-3">
              <tr>
                <th className="px-3 py-2">Ponto</th>
                <th className="px-3 py-2">Canal</th>
                <th className="px-3 py-2">Mensagem-modelo</th>
                <th className="px-3 py-2">Status</th>
                <th className="px-3 py-2 text-right">Ações</th>
              </tr>
            </thead>
            <tbody>
              {pontos.map((ponto) => (
                <tr
                  key={ponto.id}
                  className="border-b border-line last:border-0 hover:bg-line-soft"
                >
                  <td className="px-3 py-2 font-semibold text-ink">
                    {labelDiaOffset(ponto.diaOffset)}
                  </td>
                  <td className="px-3 py-2 text-ink-2">{CANAL_LABEL[ponto.canal]}</td>
                  <td className="max-w-[360px] truncate px-3 py-2 text-ink-2">
                    {ponto.mensagemModelo}
                  </td>
                  <td className="px-3 py-2">
                    <span
                      className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${ponto.ativo ? "bg-[#E7F6EC] text-[#1E8E45]" : "bg-[#EFF1F4] text-[#5A6175]"}`}
                    >
                      {ponto.ativo ? "Ativo" : "Inativo"}
                    </span>
                  </td>
                  <td className="px-3 py-2">
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
                          onClick={() => desativar(ponto)}
                          className="inline-flex items-center gap-1 text-xs font-semibold text-[#A23B25] hover:text-[#7A2C1B]"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                          Desativar
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <section className="rounded-[8px] border border-line bg-card p-4">
        <h3 className="text-base font-semibold text-ink">Histórico de envios</h3>
        <p className="mt-0.5 text-sm text-ink-3">
          Registrado pelo job diário — nunca editável pela UI (auditoria).
        </p>
        {envios.length === 0 ? (
          <p className="mt-4 text-sm text-ink-3">Nenhum envio registrado ainda.</p>
        ) : (
          <div className="mt-3 overflow-x-auto">
            <table className="w-full min-w-[480px] text-left text-sm">
              <thead className="border-b border-line text-xs font-semibold uppercase tracking-wide text-ink-3">
                <tr>
                  <th className="px-3 py-2">Quando</th>
                  <th className="px-3 py-2">Canal</th>
                  <th className="px-3 py-2">Status</th>
                  <th className="px-3 py-2">Motivo</th>
                </tr>
              </thead>
              <tbody>
                {envios.slice(0, 50).map((envio) => (
                  <tr key={envio.id} className="border-b border-line last:border-0">
                    <td className="px-3 py-2 text-ink-2">
                      {new Date(envio.enviadoEm).toLocaleString("pt-BR")}
                    </td>
                    <td className="px-3 py-2 text-ink-2">
                      {envio.canalEfetivo ? CANAL_LABEL[envio.canalEfetivo] : "—"}
                    </td>
                    <td className="px-3 py-2 text-ink-2">{STATUS_LABEL[envio.status]}</td>
                    <td className="max-w-[320px] truncate px-3 py-2 text-ink-3">
                      {envio.motivo ?? "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {modal && (
        <PontoModal
          ponto={modal.modo === "editar" ? modal.ponto : undefined}
          onCancel={() => setModal(null)}
          onSalvar={salvar}
        />
      )}
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
    <div className="modal-backdrop">
      <div className="w-full max-w-xl rounded-[8px] border border-line bg-card shadow-xl">
        <div className="flex items-center justify-between border-b border-line px-4 py-3">
          <h3 className="text-base font-semibold text-ink">
            {ponto ? "Editar ponto da régua" : "Novo ponto da régua"}
          </h3>
          <button type="button" onClick={onCancel} className="text-ink-3 hover:text-ink">
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="grid grid-cols-1 gap-3 p-4 sm:grid-cols-2">
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
            <span className="mt-1 block text-[11px] text-ink-3">
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
            <span className="mt-1 block text-[11px] text-ink-3">
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

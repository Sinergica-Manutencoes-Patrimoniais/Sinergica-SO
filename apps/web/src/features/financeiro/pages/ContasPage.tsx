import { Button, ConfirmDialog, Modal as ModalPrimitivo } from "@sinergica/ui";
import { ArrowLeftRight, Building2, Pencil, Plus, RefreshCw, Trash2 } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { useAuth } from "../../../app/auth-context";
import { usePermissoes } from "../../../app/permissoes-context";
import { criarConta, desativarConta, editarConta, listarContas } from "../application/contas";
import { criarTransferencia } from "../application/robustez";
import type { ContaBancariaFormData, ContaBancariaItem } from "../domain/conta-bancaria";
import { centavosParaReais, reaisParaCentavos } from "../domain/dinheiro";
import type { TransferenciaFormData } from "../domain/transferencia";
import { supabaseFinanceiroAdapter } from "../infrastructure/supabase-financeiro-adapter";

type Estado =
  | { fase: "carregando" }
  | { fase: "erro"; mensagem: string }
  | { fase: "pronto"; contas: ContaBancariaItem[] };

type Modal =
  | { modo: "novo"; conta?: undefined }
  | { modo: "editar"; conta: ContaBancariaItem }
  | { modo: "transferencia" }
  | null;

export function ContasPage() {
  const { user } = useAuth();
  const { carregando: permissoesCarregando, podeAcessar } = usePermissoes();
  const [estado, setEstado] = useState<Estado>({ fase: "carregando" });
  const [modal, setModal] = useState<Modal>(null);
  const [contaParaDesativar, setContaParaDesativar] = useState<ContaBancariaItem | null>(null);

  const temLeitura = podeAcessar("financeiro", "leitura");
  const temEscrita = podeAcessar("financeiro", "escrita");

  const carregar = useCallback(async () => {
    setEstado({ fase: "carregando" });
    try {
      setEstado({ fase: "pronto", contas: await listarContas(supabaseFinanceiroAdapter) });
    } catch (error) {
      setEstado({
        fase: "erro",
        mensagem: error instanceof Error ? error.message : "Falha ao carregar contas.",
      });
    }
  }, []);

  useEffect(() => {
    if (!permissoesCarregando && temLeitura) carregar();
  }, [permissoesCarregando, temLeitura, carregar]);

  async function salvar(input: ContaBancariaFormData) {
    if (!user) return;
    if (modal?.modo === "editar") {
      await editarConta(supabaseFinanceiroAdapter, {
        ...input,
        id: modal.conta.id,
        userId: user.id,
      });
    } else {
      await criarConta(supabaseFinanceiroAdapter, { ...input, userId: user.id });
    }
    setModal(null);
    await carregar();
  }

  async function transferir(input: TransferenciaFormData) {
    if (!user) return;
    await criarTransferencia(supabaseFinanceiroAdapter, { ...input, userId: user.id });
    setModal(null);
    await carregar();
  }

  async function desativar() {
    if (!user || !contaParaDesativar) return;
    await desativarConta(supabaseFinanceiroAdapter, { id: contaParaDesativar.id, userId: user.id });
    await carregar();
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

  return (
    <div className="flex flex-col gap-4">
      <section className="rounded-lg border border-line bg-card p-4 shadow-raised">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h3 className="text-heading font-semibold text-ink">Contas bancárias</h3>
            <p className="mt-0.5 text-body text-ink-3">
              Saldo atual = saldo inicial + entradas − saídas realizadas, calculado ao vivo.
            </p>
          </div>
          {temEscrita && (
            <div className="flex gap-2">
              <Button
                variant="secondary"
                icon={<ArrowLeftRight className="h-4 w-4" />}
                onClick={() => setModal({ modo: "transferencia" })}
              >
                Transferência
              </Button>
              <Button
                variant="accent"
                icon={<Plus className="h-4 w-4" />}
                onClick={() => setModal({ modo: "novo" })}
              >
                Nova conta
              </Button>
            </div>
          )}
        </div>
      </section>

      {estado.contas.length === 0 ? (
        <div className="rounded-lg border border-line bg-card px-5 py-10 text-center">
          <Building2 className="mx-auto h-9 w-9 text-ink-3" />
          <p className="mt-3 text-body text-ink-3">Nenhuma conta cadastrada.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-3 xl:grid-cols-2">
          {estado.contas.map((conta) => (
            <div key={conta.id} className="rounded-lg border border-line bg-card p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <h4 className="truncate text-body font-semibold text-ink">{conta.nome}</h4>
                  <p className="mt-1 text-caption text-ink-3">
                    {conta.banco ?? "Sem banco informado"}
                  </p>
                </div>
                <span
                  className={`rounded-full px-2 py-0.5 text-micro font-semibold ${conta.ativo ? "bg-success-soft text-success" : "bg-line-soft text-ink-2"}`}
                >
                  {conta.ativo ? "Ativa" : "Inativa"}
                </span>
              </div>
              <p className="mt-3 text-2xl font-semibold text-ink">
                R${" "}
                {conta.saldoAtualCentavos !== null
                  ? centavosParaReais(conta.saldoAtualCentavos)
                  : "—"}
              </p>
              <p className="mt-1 text-caption text-ink-3">
                Saldo inicial R$ {centavosParaReais(conta.saldoInicialCentavos)} em{" "}
                {new Date(conta.saldoInicialEm).toLocaleDateString("pt-BR")}
              </p>
              <div className="mt-4 flex justify-end gap-2">
                {temEscrita && (
                  <Button
                    variant="secondary"
                    size="sm"
                    icon={<Pencil className="h-3.5 w-3.5" />}
                    onClick={() => setModal({ modo: "editar", conta })}
                  >
                    Editar
                  </Button>
                )}
                {temEscrita && conta.ativo && (
                  <Button
                    variant="danger"
                    size="sm"
                    icon={<Trash2 className="h-3.5 w-3.5" />}
                    onClick={() => setContaParaDesativar(conta)}
                  >
                    Desativar
                  </Button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {(modal?.modo === "novo" || modal?.modo === "editar") && (
        <ContaModal
          conta={modal.modo === "editar" ? modal.conta : undefined}
          onCancel={() => setModal(null)}
          onSalvar={salvar}
        />
      )}

      {modal?.modo === "transferencia" && (
        <TransferenciaModal
          contas={estado.contas.filter((c) => c.ativo)}
          onCancel={() => setModal(null)}
          onSalvar={transferir}
        />
      )}

      <ConfirmDialog
        open={contaParaDesativar !== null}
        onOpenChange={(aberto) => {
          if (!aberto) setContaParaDesativar(null);
        }}
        titulo={`Desativar "${contaParaDesativar?.nome}"`}
        descricao="A conta deixa de aparecer nas opções de lançamento e transferência."
        rotuloConfirmar="Desativar"
        onConfirmar={async () => {
          await desativar();
          setContaParaDesativar(null);
        }}
      />
    </div>
  );
}

function ContaModal({
  conta,
  onCancel,
  onSalvar,
}: {
  conta?: ContaBancariaItem;
  onCancel: () => void;
  onSalvar: (input: ContaBancariaFormData) => Promise<void>;
}) {
  const [nome, setNome] = useState(conta?.nome ?? "");
  const [banco, setBanco] = useState(conta?.banco ?? "");
  const [saldoInicial, setSaldoInicial] = useState(
    conta ? centavosParaReais(conta.saldoInicialCentavos) : "0,00",
  );
  const [saldoInicialEm, setSaldoInicialEm] = useState(
    conta?.saldoInicialEm ?? new Date().toISOString().slice(0, 10),
  );
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  async function salvar() {
    try {
      setSalvando(true);
      setErro(null);
      await onSalvar({
        nome,
        banco,
        saldoInicialCentavos: reaisParaCentavos(saldoInicial),
        saldoInicialEm,
      });
    } catch (error) {
      setErro(error instanceof Error ? error.message : "Não foi possível salvar conta.");
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
      titulo={conta ? "Editar conta" : "Nova conta bancária"}
      tamanho="md"
    >
      <div className="flex flex-col gap-4">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <label className="block sm:col-span-2">
            <span className="mb-1 block text-caption font-semibold text-ink-3">Nome *</span>
            <input
              value={nome}
              onChange={(e) => setNome(e.target.value)}
              className="input w-full"
              placeholder="Itaú PJ"
            />
          </label>
          <label className="block sm:col-span-2">
            <span className="mb-1 block text-caption font-semibold text-ink-3">Banco</span>
            <input
              value={banco}
              onChange={(e) => setBanco(e.target.value)}
              className="input w-full"
            />
          </label>
          <label className="block">
            <span className="mb-1 block text-caption font-semibold text-ink-3">
              Saldo inicial *
            </span>
            <input
              value={saldoInicial}
              onChange={(e) => setSaldoInicial(e.target.value)}
              className="input w-full"
            />
          </label>
          <label className="block">
            <span className="mb-1 block text-caption font-semibold text-ink-3">
              Data de corte *
            </span>
            <input
              type="date"
              value={saldoInicialEm}
              onChange={(e) => setSaldoInicialEm(e.target.value)}
              className="input w-full"
            />
          </label>
          {erro && (
            <div className="sm:col-span-2 rounded-md border border-danger-line bg-danger-soft px-3 py-2 text-body text-danger">
              {erro}
            </div>
          )}
        </div>
        <div className="flex justify-end gap-2 border-t border-line-soft pt-4">
          <Button variant="secondary" onClick={onCancel} disabled={salvando}>
            Cancelar
          </Button>
          <Button variant="primary" onClick={salvar} disabled={salvando} loading={salvando}>
            Salvar
          </Button>
        </div>
      </div>
    </ModalPrimitivo>
  );
}

function TransferenciaModal({
  contas,
  onCancel,
  onSalvar,
}: {
  contas: ContaBancariaItem[];
  onCancel: () => void;
  onSalvar: (input: TransferenciaFormData) => Promise<void>;
}) {
  const [contaOrigemId, setContaOrigemId] = useState("");
  const [contaDestinoId, setContaDestinoId] = useState("");
  const [valor, setValor] = useState("");
  const [data, setData] = useState(new Date().toISOString().slice(0, 10));
  const [descricao, setDescricao] = useState("");
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  async function salvar() {
    try {
      setSalvando(true);
      setErro(null);
      await onSalvar({
        contaOrigemId,
        contaDestinoId,
        valorCentavos: reaisParaCentavos(valor),
        data,
        descricao: descricao || null,
      });
    } catch (error) {
      setErro(
        error instanceof Error ? error.message : "Não foi possível concluir a transferência.",
      );
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
      titulo="Transferência entre contas"
      tamanho="sm"
    >
      <div className="flex flex-col gap-3">
        <label className="block">
          <span className="mb-1 block text-caption font-semibold text-ink-3">
            Conta de origem *
          </span>
          <select
            value={contaOrigemId}
            onChange={(e) => setContaOrigemId(e.target.value)}
            className="input w-full"
          >
            <option value="">Selecione…</option>
            {contas.map((c) => (
              <option key={c.id} value={c.id}>
                {c.nome}
              </option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className="mb-1 block text-caption font-semibold text-ink-3">
            Conta de destino *
          </span>
          <select
            value={contaDestinoId}
            onChange={(e) => setContaDestinoId(e.target.value)}
            className="input w-full"
          >
            <option value="">Selecione…</option>
            {contas.map((c) => (
              <option key={c.id} value={c.id}>
                {c.nome}
              </option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className="mb-1 block text-caption font-semibold text-ink-3">Valor *</span>
          <input
            value={valor}
            onChange={(e) => setValor(e.target.value)}
            className="input w-full"
            placeholder="0,00"
          />
        </label>
        <label className="block">
          <span className="mb-1 block text-caption font-semibold text-ink-3">Data *</span>
          <input
            type="date"
            value={data}
            onChange={(e) => setData(e.target.value)}
            className="input w-full"
          />
        </label>
        <label className="block">
          <span className="mb-1 block text-caption font-semibold text-ink-3">Descrição</span>
          <input
            value={descricao}
            onChange={(e) => setDescricao(e.target.value)}
            className="input w-full"
          />
        </label>
        {erro && (
          <div className="rounded-md border border-danger-line bg-danger-soft px-3 py-2 text-body text-danger">
            {erro}
          </div>
        )}
        <div className="flex justify-end gap-2 border-t border-line-soft pt-4">
          <Button variant="secondary" onClick={onCancel} disabled={salvando}>
            Cancelar
          </Button>
          <Button variant="primary" onClick={salvar} disabled={salvando} loading={salvando}>
            Transferir
          </Button>
        </div>
      </div>
    </ModalPrimitivo>
  );
}

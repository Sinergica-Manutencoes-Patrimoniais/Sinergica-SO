/** Lista de contratos comerciais (E03-S07, task 7). Ativar/encerrar passam pelas RPCs atômicas —
 * esta página só oferece os botões; a guarda real (piso, vigência, unicidade) está no banco. */

import { Badge, Button, Card, EmptyState, Field, Input } from "@sinergica/ui";
import { useState } from "react";
import { usePermissoes } from "../../../app/permissoes-context";
import { useContas } from "../application/comercial-queries";
import {
  useAtivarContrato,
  useContratos,
  useEncerrarContrato,
} from "../application/contrato-queries";
import {
  type Contrato,
  type ContratoStatus,
  motivoNaoPodeAtivar,
  podeAtivar,
  podeEncerrar,
  reajusteDevido,
} from "../domain/contrato";
import { supabaseComercialAdapter } from "../infrastructure/supabase-comercial-adapter";
import { supabaseContratoAdapter } from "../infrastructure/supabase-contrato-adapter";

const TIPO_LABEL: Record<Contrato["tipo"], string> = {
  residente: "Residente",
  volante: "Volante",
  avulso: "Avulso",
};

const STATUS_LABEL: Record<ContratoStatus, string> = {
  rascunho: "Rascunho",
  ativo: "Ativo",
  suspenso: "Suspenso",
  encerrado: "Encerrado",
};

const STATUS_TOM: Record<ContratoStatus, "neutral" | "info" | "success" | "danger" | "warning"> = {
  rascunho: "neutral",
  ativo: "success",
  suspenso: "warning",
  encerrado: "danger",
};

function formatarValor(centavos: number | null): string {
  if (centavos === null) return "—";
  return (centavos / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function formatarData(iso: string | null): string {
  if (!iso) return "indeterminado";
  const [ano, mes, dia] = iso.slice(0, 10).split("-");
  return `${dia}/${mes}/${ano}`;
}

export function ContratosPage() {
  const { podeAcessar } = usePermissoes();
  const temEscrita = podeAcessar("comercial", "escrita");
  const temLeitura = podeAcessar("comercial", "leitura");

  const contratosQuery = useContratos(supabaseContratoAdapter, temLeitura);
  // Conta é lida via `relacionamento.contas` (ADR-0019 R2) — mesma fonte já usada pelo resto do
  // Comercial (FunilPage, ContasPage); aqui só pra mostrar o nome ao lado do contrato.
  const contasQuery = useContas(supabaseComercialAdapter, {}, temLeitura);
  const ativar = useAtivarContrato(supabaseContratoAdapter);
  const encerrar = useEncerrarContrato(supabaseContratoAdapter);

  const [erro, setErro] = useState<string | null>(null);
  const [encerrandoId, setEncerrandoId] = useState<string | null>(null);
  const [motivoEncerramento, setMotivoEncerramento] = useState("");

  if (!temLeitura) {
    return (
      <EmptyState titulo="Sem acesso ao Comercial">
        Seu usuário não tem permissão no módulo Comercial.
      </EmptyState>
    );
  }

  if (contratosQuery.isPending) {
    return <p className="text-body text-ink-2">Carregando contratos…</p>;
  }
  if (contratosQuery.error) {
    return (
      <Card>
        <p className="p-4 text-body text-danger">
          {contratosQuery.error instanceof Error
            ? contratosQuery.error.message
            : "Falha ao carregar contratos."}
        </p>
      </Card>
    );
  }

  const contratos = contratosQuery.data ?? [];
  const nomePorConta = new Map((contasQuery.data ?? []).map((c) => [c.id, c.nome]));

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-heading font-semibold text-ink">Contratos</h1>
        <p className="text-body text-ink-3">
          Gerados a partir de propostas aceitas. Ativar cria o plano de faturamento no Financeiro.
        </p>
      </div>

      {erro && (
        <Card>
          <p className="p-3 text-body text-danger">{erro}</p>
        </Card>
      )}

      {contratos.length === 0 ? (
        <EmptyState titulo="Nenhum contrato ainda">
          Contratos nascem de uma proposta aceita — vá até o editor de proposta da oportunidade e
          clique em "Gerar contrato".
        </EmptyState>
      ) : (
        <Card>
          <ul className="divide-y divide-line/60">
            {contratos.map((contrato) => {
              const bloqueio = motivoNaoPodeAtivar(contrato);
              return (
                <li key={contrato.id} className="flex flex-wrap items-center gap-3 p-3">
                  <div className="min-w-56 flex-1">
                    <p className="font-semibold text-ink">
                      {nomePorConta.get(contrato.clienteId) ?? "Conta"} ·{" "}
                      {TIPO_LABEL[contrato.tipo]}
                    </p>
                    <p className="text-caption text-ink-2">
                      Vigência: {formatarData(contrato.vigenciaInicio)} até{" "}
                      {formatarData(contrato.vigenciaFim)}
                      {reajusteDevido(contrato.reajusteMes) && contrato.status === "ativo" && (
                        <span className="ml-2 font-semibold text-orange">reajuste devido</span>
                      )}
                    </p>
                    {contrato.status === "encerrado" && contrato.encerradoMotivo && (
                      <p className="text-caption text-ink-3">
                        Encerrado em {formatarData(contrato.encerradoEm)} —{" "}
                        {contrato.encerradoMotivo}
                      </p>
                    )}
                  </div>
                  <span className="tabular-nums text-body text-ink">
                    {formatarValor(contrato.valorMensalCentavos)}
                    {contrato.valorMensalCentavos !== null && "/mês"}
                  </span>
                  <Badge tone={STATUS_TOM[contrato.status]}>{STATUS_LABEL[contrato.status]}</Badge>

                  {temEscrita && podeAtivar(contrato.status) && (
                    <Button
                      size="sm"
                      disabled={!!bloqueio || ativar.isPending}
                      title={bloqueio ?? undefined}
                      onClick={async () => {
                        setErro(null);
                        try {
                          await ativar.mutateAsync(contrato.id);
                        } catch (e) {
                          setErro(e instanceof Error ? e.message : "Falha ao ativar contrato.");
                        }
                      }}
                    >
                      Ativar
                    </Button>
                  )}

                  {temEscrita && podeEncerrar(contrato.status) && encerrandoId !== contrato.id && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        setEncerrandoId(contrato.id);
                        setMotivoEncerramento("");
                      }}
                    >
                      Encerrar
                    </Button>
                  )}

                  {encerrandoId === contrato.id && (
                    <div className="flex w-full items-end gap-2 pt-2">
                      <div className="flex-1">
                        <Field label="Motivo do encerramento">
                          {(props) => (
                            <Input
                              {...props}
                              value={motivoEncerramento}
                              onChange={(e) => setMotivoEncerramento(e.target.value)}
                            />
                          )}
                        </Field>
                      </div>
                      <Button
                        size="sm"
                        disabled={!motivoEncerramento.trim() || encerrar.isPending}
                        onClick={async () => {
                          setErro(null);
                          try {
                            await encerrar.mutateAsync({
                              contratoId: contrato.id,
                              motivo: motivoEncerramento,
                            });
                            setEncerrandoId(null);
                          } catch (e) {
                            setErro(e instanceof Error ? e.message : "Falha ao encerrar contrato.");
                          }
                        }}
                      >
                        Confirmar
                      </Button>
                      <Button variant="ghost" size="sm" onClick={() => setEncerrandoId(null)}>
                        Cancelar
                      </Button>
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        </Card>
      )}
    </div>
  );
}

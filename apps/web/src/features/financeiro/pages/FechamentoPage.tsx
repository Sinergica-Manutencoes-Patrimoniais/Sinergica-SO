import { Button, DataTable, Field, Modal, Textarea } from "@sinergica/ui";
import { Lock, LockOpen, RefreshCw } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { useAuth } from "../../../app/auth-context";
import { usePermissoes } from "../../../app/permissoes-context";
import { fecharMes, listarFechamentos, reabrirMes } from "../application/fechamento";
import type { FechamentoMensal, StatusFechamento } from "../domain/fechamento";
import { supabaseFinanceiroAdapter } from "../infrastructure/supabase-financeiro-adapter";

type Estado =
  | { fase: "carregando" }
  | { fase: "erro"; mensagem: string }
  | { fase: "pronto"; fechamentos: FechamentoMensal[] };

function ultimasCompetencias(qtd: number): string[] {
  const hoje = new Date();
  return Array.from({ length: qtd }, (_, i) => {
    const ano = hoje.getUTCFullYear();
    const mes = hoje.getUTCMonth() - i;
    const data = new Date(Date.UTC(ano, mes, 1));
    return data.toISOString().slice(0, 10);
  });
}

export function FechamentoPage() {
  const { user } = useAuth();
  const { carregando: permissoesCarregando, podeAcessar } = usePermissoes();
  const [estado, setEstado] = useState<Estado>({ fase: "carregando" });
  const [erroAcao, setErroAcao] = useState<string | null>(null);
  const [processando, setProcessando] = useState<string | null>(null);
  const [competenciaParaReabrir, setCompetenciaParaReabrir] = useState<string | null>(null);
  const [motivoReabertura, setMotivoReabertura] = useState("");

  const temLeitura = podeAcessar("financeiro", "leitura");
  const temEscrita = podeAcessar("financeiro", "escrita");
  const ehSuperadmin = user?.papel === "superadmin";

  const carregar = useCallback(async () => {
    setEstado({ fase: "carregando" });
    try {
      const fechamentos = await listarFechamentos(supabaseFinanceiroAdapter);
      setEstado({ fase: "pronto", fechamentos });
    } catch (error) {
      setEstado({
        fase: "erro",
        mensagem: error instanceof Error ? error.message : "Falha ao carregar fechamentos.",
      });
    }
  }, []);

  useEffect(() => {
    if (!permissoesCarregando && temLeitura) carregar();
  }, [permissoesCarregando, temLeitura, carregar]);

  async function fechar(competencia: string) {
    if (!user) return;
    setProcessando(competencia);
    setErroAcao(null);
    try {
      await fecharMes(supabaseFinanceiroAdapter, competencia);
      await carregar();
    } catch (error) {
      setErroAcao(error instanceof Error ? error.message : "Não foi possível fechar o mês.");
    } finally {
      setProcessando(null);
    }
  }

  async function reabrir() {
    if (!user || !competenciaParaReabrir || !motivoReabertura.trim()) return;
    const competencia = competenciaParaReabrir;
    setProcessando(competencia);
    setErroAcao(null);
    try {
      await reabrirMes(supabaseFinanceiroAdapter, competencia, motivoReabertura.trim());
      await carregar();
      setCompetenciaParaReabrir(null);
      setMotivoReabertura("");
    } catch (error) {
      setErroAcao(error instanceof Error ? error.message : "Não foi possível reabrir o mês.");
    } finally {
      setProcessando(null);
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
        <button
          type="button"
          onClick={carregar}
          className="mt-4 inline-flex items-center gap-2 text-body font-semibold text-orange hover:text-orange-deep"
        >
          <RefreshCw className="h-4 w-4" />
          Tentar novamente
        </button>
      </div>
    );
  }

  const statusPorCompetencia = new Map(estado.fechamentos.map((f) => [f.competencia, f.status]));
  const competencias = ultimasCompetencias(12);

  return (
    <div className="flex flex-col gap-4">
      <section className="rounded-lg border border-line bg-card p-4 shadow-raised">
        <h1 className="text-heading font-semibold text-ink">Fechamento mensal</h1>
        <p className="mt-0.5 text-body text-ink-3">
          Mês fechado trava novos lançamentos/edições naquela competência. Reabertura exige motivo e
          fica auditada.
        </p>
        {erroAcao && (
          <div className="mt-3 rounded-md border border-danger-line bg-danger-soft px-3 py-2 text-body text-danger">
            {erroAcao}
          </div>
        )}
      </section>

      <DataTable
        colunas={[
          {
            chave: "competencia",
            cabecalho: "Competência",
            render: (competencia: string) => {
              const [ano, mes] = competencia.split("-");
              return <span className="font-semibold text-ink">{`${mes}/${ano}`}</span>;
            },
          },
          {
            chave: "status",
            cabecalho: "Status",
            render: (competencia: string) => {
              const status: StatusFechamento = statusPorCompetencia.get(competencia) ?? "aberto";
              return (
                <span
                  className={`rounded-full px-2 py-0.5 text-micro font-semibold ${status === "fechado" ? "bg-line-soft text-ink-2" : "bg-success-soft text-success"}`}
                >
                  {status === "fechado" ? "Fechado" : "Aberto"}
                </span>
              );
            },
          },
          {
            chave: "acoes",
            cabecalho: "Ações",
            render: (competencia: string) => {
              const status: StatusFechamento = statusPorCompetencia.get(competencia) ?? "aberto";
              return (
                <div className="flex justify-end gap-2">
                  {status === "aberto" && temEscrita && (
                    <Button
                      variant="ghost"
                      size="sm"
                      icon={<Lock className="h-3.5 w-3.5" />}
                      onClick={() => fechar(competencia)}
                      disabled={processando === competencia}
                    >
                      Fechar mês
                    </Button>
                  )}
                  {status === "fechado" && ehSuperadmin && (
                    <Button
                      variant="ghost"
                      size="sm"
                      icon={<LockOpen className="h-3.5 w-3.5" />}
                      onClick={() => setCompetenciaParaReabrir(competencia)}
                      disabled={processando === competencia}
                    >
                      Reabrir
                    </Button>
                  )}
                </div>
              );
            },
          },
        ]}
        itens={competencias}
        chaveLinha={(competencia) => competencia}
        vazio={<>Nenhuma competência.</>}
      />

      {competenciaParaReabrir && (
        <Modal
          open
          onOpenChange={(aberto) => {
            if (!aberto) {
              setCompetenciaParaReabrir(null);
              setMotivoReabertura("");
            }
          }}
          titulo="Reabrir mês"
          descricao="O motivo fica registrado na auditoria de fechamento."
          tamanho="sm"
        >
          <div className="flex flex-col gap-4">
            <Field label="Motivo da reabertura" required>
              {(props) => (
                <Textarea
                  {...props}
                  value={motivoReabertura}
                  onChange={(e) => setMotivoReabertura(e.target.value)}
                  className="min-h-24"
                  placeholder="Ex.: lançamento duplicado identificado após o fechamento."
                />
              )}
            </Field>
            <div className="flex justify-end gap-2 border-t border-line-soft pt-4">
              <Button
                variant="secondary"
                onClick={() => {
                  setCompetenciaParaReabrir(null);
                  setMotivoReabertura("");
                }}
              >
                Cancelar
              </Button>
              <Button
                variant="primary"
                onClick={reabrir}
                disabled={!motivoReabertura.trim() || processando === competenciaParaReabrir}
                loading={processando === competenciaParaReabrir}
              >
                Reabrir mês
              </Button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}

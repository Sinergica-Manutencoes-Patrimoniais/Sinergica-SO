// E02-S26 AC-1 — administração do roteiro de perguntas do agente entrevistador de cadastro.
//
// Esta tela é o AC-1 inteiro e SÓ ele: o roteiro passa a ser configurável de verdade, em vez de
// existir apenas como tabela (migration 0160) que nenhuma tela alcançava. O motor conversacional
// (AC-2 a AC-5, AC-7) continua bloqueado por ADR-0016, que está **Proposto** e não aceito — ver
// `specs/E02-S26-agente-entrevistador-cadastro/tasks.md`. O aviso no topo diz isso para quem
// abrir a tela, em vez de deixar a pessoa configurar perguntas e nunca entender por que nenhuma
// entrevista acontece.
import { RecursoNaoAtivado, Skeleton } from "@sinergica/ui";
import { useState } from "react";
import { useAuth } from "../../../app/auth-context";
import { usePermissoes } from "../../../app/permissoes-context";
import { flagLigada } from "../../../config/flags-sso";
import {
  useAlternarRoteiroEntrevista,
  useRoteirosEntrevista,
  useSalvarRoteiroEntrevista,
} from "../application/roteiro-entrevista-queries";
import type { PerguntaRoteiro } from "../domain/roteiro-entrevista";
import { supabaseRoteiroEntrevistaAdapter } from "../infrastructure/supabase-roteiro-entrevista-adapter";

/** Pergunta ainda não gravada não tem id no banco. `chave` é a identidade LOCAL enquanto se
 * edita — usar o índice como key faria o React remontar o campo errado ao remover uma pergunta
 * do meio da lista, e o texto digitado iria parar na linha de baixo. */
interface PerguntaEmEdicao extends PerguntaRoteiro {
  chave: string;
}

function perguntaVazia(): PerguntaEmEdicao {
  return { chave: crypto.randomUUID(), campo: "", pergunta: "", obrigatorio: true };
}

export function RoteirosEntrevistaPage() {
  if (!flagLigada("VITE_SSO_ROTEIRO_ENTREVISTA_ENABLED")) {
    return (
      <RecursoNaoAtivado
        recurso="Roteiros de entrevista de cadastro"
        podeAdministrar={false}
        faltando={["VITE_SSO_ROTEIRO_ENTREVISTA_ENABLED"]}
      />
    );
  }
  return <Conteudo />;
}

function Conteudo() {
  const { user } = useAuth();
  const { podeAcessar } = usePermissoes();
  const temEscrita = podeAcessar("pcm", "escrita");
  const roteiros = useRoteirosEntrevista(supabaseRoteiroEntrevistaAdapter);
  const salvar = useSalvarRoteiroEntrevista(supabaseRoteiroEntrevistaAdapter);
  const alternar = useAlternarRoteiroEntrevista(supabaseRoteiroEntrevistaAdapter);

  const [editandoId, setEditandoId] = useState<string | null>(null);
  const [nome, setNome] = useState("");
  const [perguntas, setPerguntas] = useState<PerguntaEmEdicao[]>([perguntaVazia()]);
  const [erro, setErro] = useState<string | null>(null);

  function abrirNovo() {
    setEditandoId("novo");
    setNome("");
    setPerguntas([perguntaVazia()]);
    setErro(null);
  }

  function abrirEdicao(id: string) {
    const roteiro = roteiros.data?.find((r) => r.id === id);
    if (!roteiro) return;
    setEditandoId(id);
    setNome(roteiro.nome);
    setPerguntas(
      roteiro.perguntas.length > 0
        ? roteiro.perguntas.map((p) => ({ ...p, chave: crypto.randomUUID() }))
        : [perguntaVazia()],
    );
    setErro(null);
  }

  async function submeter() {
    if (!user || !editandoId) return;
    setErro(null);
    try {
      await salvar.mutateAsync({
        id: editandoId === "novo" ? undefined : editandoId,
        nome,
        perguntas,
        userId: user.id,
      });
      setEditandoId(null);
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Não foi possível salvar o roteiro.");
    }
  }

  return (
    <div className="page-stack">
      <h1 className="text-heading font-semibold text-ink">Roteiros de entrevista de cadastro</h1>
      <p className="text-caption text-ink-3">
        As perguntas que o agente entrevistador faz ao cadastrar um cliente e a estrutura de locais.
        O roteiro já fica salvo e versionado aqui; a condução da entrevista por IA ainda não está
        disponível — depende da aceitação da ADR-0016. Enquanto isso, o roteiro serve como checklist
        do cadastro manual, que continua sendo o caminho soberano.
      </p>

      {roteiros.isPending ? (
        <Skeleton className="h-32 w-full" />
      ) : roteiros.isError ? (
        <section className="rounded-lg border border-line bg-card p-4 shadow-raised">
          <p className="text-body text-red-600">Não foi possível carregar os roteiros.</p>
          <button type="button" className="btn-secondary mt-2" onClick={() => roteiros.refetch()}>
            Tentar novamente
          </button>
        </section>
      ) : (
        <section className="rounded-lg border border-line bg-card p-4 shadow-raised">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-body font-semibold text-ink">
              {roteiros.data.length} roteiro(s) cadastrado(s)
            </h2>
            {temEscrita && (
              <button type="button" className="btn-secondary" onClick={abrirNovo}>
                Novo roteiro
              </button>
            )}
          </div>
          <ul className="mt-3 flex flex-col gap-2">
            {roteiros.data.length === 0 && (
              <li className="text-body text-ink-2">
                Nenhum roteiro ainda. Crie o primeiro com as perguntas do cadastro de prédio.
              </li>
            )}
            {roteiros.data.map((roteiro) => (
              <li
                key={roteiro.id}
                className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-line p-3"
              >
                <div>
                  <p className="text-body text-ink">{roteiro.nome}</p>
                  <p className="text-caption text-ink-3">
                    {roteiro.perguntas.length} pergunta(s) · {roteiro.ativo ? "ativo" : "inativo"}
                  </p>
                </div>
                {temEscrita && (
                  <div className="flex gap-2">
                    <button
                      type="button"
                      className="btn-secondary"
                      onClick={() => abrirEdicao(roteiro.id)}
                    >
                      Editar
                    </button>
                    <button
                      type="button"
                      className="btn-secondary"
                      disabled={alternar.isPending}
                      onClick={() =>
                        user &&
                        alternar.mutate({
                          id: roteiro.id,
                          ativo: !roteiro.ativo,
                          userId: user.id,
                        })
                      }
                    >
                      {roteiro.ativo ? "Desativar" : "Ativar"}
                    </button>
                  </div>
                )}
              </li>
            ))}
          </ul>
        </section>
      )}

      {editandoId && (
        <section className="rounded-lg border border-line bg-card p-4 shadow-raised">
          <h2 className="text-body font-semibold text-ink">
            {editandoId === "novo" ? "Novo roteiro" : "Editar roteiro"}
          </h2>
          <label className="mt-3 block text-body text-ink">
            Nome do roteiro
            <input
              className="input mt-1 w-full"
              value={nome}
              onChange={(e) => setNome(e.target.value)}
              placeholder="Ex.: Cadastro de prédio residencial"
            />
          </label>

          <div className="mt-3 flex flex-col gap-2">
            {perguntas.map((pergunta, indice) => (
              <div
                key={pergunta.chave}
                className="flex flex-wrap items-center gap-2 rounded-md border border-line p-2"
              >
                <input
                  className="input w-40"
                  value={pergunta.campo}
                  aria-label={`Campo da pergunta ${indice + 1}`}
                  placeholder="campo (ex.: cnpj)"
                  onChange={(e) =>
                    setPerguntas(
                      perguntas.map((p, i) => (i === indice ? { ...p, campo: e.target.value } : p)),
                    )
                  }
                />
                <input
                  className="input min-w-56 flex-1"
                  value={pergunta.pergunta}
                  aria-label={`Texto da pergunta ${indice + 1}`}
                  placeholder="Pergunta que o agente faz"
                  onChange={(e) =>
                    setPerguntas(
                      perguntas.map((p, i) =>
                        i === indice ? { ...p, pergunta: e.target.value } : p,
                      ),
                    )
                  }
                />
                <label className="flex items-center gap-1 text-caption text-ink-2">
                  <input
                    type="checkbox"
                    checked={pergunta.obrigatorio}
                    onChange={(e) =>
                      setPerguntas(
                        perguntas.map((p, i) =>
                          i === indice ? { ...p, obrigatorio: e.target.checked } : p,
                        ),
                      )
                    }
                  />
                  obrigatória
                </label>
                {perguntas.length > 1 && (
                  <button
                    type="button"
                    className="btn-secondary"
                    onClick={() => setPerguntas(perguntas.filter((_, i) => i !== indice))}
                  >
                    Remover
                  </button>
                )}
              </div>
            ))}
          </div>

          <button
            type="button"
            className="btn-secondary mt-2"
            onClick={() => setPerguntas([...perguntas, perguntaVazia()])}
          >
            Adicionar pergunta
          </button>

          {erro && <p className="mt-2 text-body text-red-600">{erro}</p>}

          <div className="mt-3 flex justify-end gap-2">
            <button type="button" className="btn-secondary" onClick={() => setEditandoId(null)}>
              Cancelar
            </button>
            <button
              type="button"
              disabled={salvar.isPending}
              onClick={submeter}
              className="h-9 rounded-md bg-navy px-3 text-body font-semibold text-white hover:bg-navy-deep disabled:opacity-50"
            >
              {salvar.isPending ? "Salvando…" : "Salvar roteiro"}
            </button>
          </div>
        </section>
      )}
    </div>
  );
}

import { Button, Field, Modal, Textarea } from "@sinergica/ui";
import { UsersRound } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { z } from "zod";
import { useAuth } from "../../../app/auth-context";
import { TEXTO_FALHA_ATIVACAO, mensagemFalhaAtivacao } from "../../../lib/mensagem-ativacao";
import { criarGrupo } from "../application/criar-grupo";
import { editarGrupo } from "../application/editar-grupo";
import { listarGrupos } from "../application/listar-grupos";
import { ModuloPermissaoGrid } from "../components/ModuloPermissaoGrid";
import type { Grupo, PermissaoModulo } from "../domain/grupo";
import type { ModuloId, NivelAcesso } from "../domain/modulo";
import { supabaseConfigAdapter } from "../infrastructure/supabase-config-adapter";

type PermissoesMap = Partial<Record<ModuloId, NivelAcesso>>;

function paraMapa(permissoes: PermissaoModulo[]): PermissoesMap {
  const mapa: PermissoesMap = {};
  for (const p of permissoes) mapa[p.modulo] = p.nivel;
  return mapa;
}

function paraLista(mapa: PermissoesMap): PermissaoModulo[] {
  return (Object.entries(mapa) as Array<[ModuloId, NivelAcesso | undefined]>)
    .filter((entry): entry is [ModuloId, NivelAcesso] => entry[1] !== undefined)
    .map(([modulo, nivel]) => ({ modulo, nivel }));
}

interface FormState {
  nome: string;
  descricao: string;
  ativo: boolean;
  permissoes: PermissoesMap;
}

const FORM_VAZIO: FormState = { nome: "", descricao: "", ativo: true, permissoes: {} };
const criacaoGuardadaSchema = z
  .object({
    id: z.string().guid(),
    nome: z.string().min(1),
    descricao: z.string().nullable(),
    permissoes: z
      .array(
        z
          .object({
            modulo: z.enum([
              "pcm",
              "atendimento",
              "comercial",
              "financeiro",
              "operacao",
              "marketing",
              "growth",
              "gestao",
              "area-cliente",
            ]),
            nivel: z.enum(["leitura", "escrita"]),
          })
          .strict(),
      )
      .max(9),
  })
  .strict()
  .refine((v) => new Set(v.permissoes.map((p) => p.modulo)).size === v.permissoes.length);
const permissoesGuardadasSchema = z
  .array(
    z
      .object({
        modulo: z.enum([
          "pcm",
          "atendimento",
          "comercial",
          "financeiro",
          "operacao",
          "marketing",
          "growth",
          "gestao",
          "area-cliente",
        ]),
        nivel: z.enum(["leitura", "escrita"]),
      })
      .strict(),
  )
  .max(9)
  .refine((v) => new Set(v.map((p) => p.modulo)).size === v.length);
const edicaoGuardadaSchema = z
  .object({
    requestId: z.string().guid(),
    id: z.string().guid(),
    ator: z.string().guid(),
    campos: z
      .object({ nome: z.string().min(1), descricao: z.string().nullable(), ativo: z.boolean() })
      .strict(),
    permissoes: permissoesGuardadasSchema,
    estado: z
      .object({
        nome: z.string(),
        descricao: z.string().nullable(),
        ativo: z.boolean(),
        permissoes: permissoesGuardadasSchema,
      })
      .strict(),
  })
  .strict();
type EdicaoGuardada = z.infer<typeof edicaoGuardadaSchema>;

export function GruposPage() {
  const { user } = useAuth();
  const [grupos, setGrupos] = useState<Grupo[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);

  const [criando, setCriando] = useState(false);
  const [editandoId, setEditandoId] = useState<string | null>(null);
  const [estadoAnterior, setEstadoAnterior] = useState<Grupo | null>(null);
  const [atorFormulario, setAtorFormulario] = useState<string | null>(null);
  const [conflito, setConflito] = useState(false);
  const [conflitoAtualizado, setConflitoAtualizado] = useState(false);
  const [form, setForm] = useState<FormState>(FORM_VAZIO);
  const [salvando, setSalvando] = useState(false);
  const [erroForm, setErroForm] = useState<string | null>(null);
  const [criacaoGuardada, setCriacaoGuardada] = useState<
    z.infer<typeof criacaoGuardadaSchema> | "invalida" | null
  >(null);
  const [edicoesGuardadas, setEdicoesGuardadas] = useState<{
    ator: string;
    itens: EdicaoGuardada[];
    invalidas: number;
  } | null>(null);

  const verificarCriacaoGuardada = useCallback(() => {
    if (import.meta.env.VITE_SSO_GRUPO_ATOMICO_ENABLED !== "true" || !user?.id) {
      setCriacaoGuardada(null);
      return;
    }
    try {
      const texto = sessionStorage.getItem(`sso-criacao-grupo:${user.id}`);
      setCriacaoGuardada(texto ? criacaoGuardadaSchema.parse(JSON.parse(texto)) : null);
    } catch {
      setCriacaoGuardada("invalida");
    }
  }, [user?.id]);

  useEffect(() => {
    verificarCriacaoGuardada();
  }, [verificarCriacaoGuardada]);

  const verificarEdicoesGuardadas = useCallback(() => {
    if (import.meta.env.VITE_SSO_GRUPO_ATOMICO_ENABLED !== "true" || !user?.id) {
      setEdicoesGuardadas(null);
      return;
    }
    const ator = user.id;
    const prefixo = `sso-edicao-grupo:${ator}:`;
    const itens: EdicaoGuardada[] = [];
    let invalidas = 0;
    try {
      for (let i = 0; i < sessionStorage.length; i++) {
        const chave = sessionStorage.key(i);
        if (!chave?.startsWith(prefixo)) continue;
        try {
          const texto = sessionStorage.getItem(chave);
          if (texto === null) throw new Error("Tentativa indisponível");
          const tentativa = edicaoGuardadaSchema.parse(JSON.parse(texto));
          if (tentativa.ator !== ator || chave !== `${prefixo}${tentativa.id}`)
            throw new Error("Identidade divergente");
          itens.push(tentativa);
        } catch {
          invalidas++;
        }
      }
    } catch {
      invalidas++;
    }
    setEdicoesGuardadas({ ator, itens, invalidas });
  }, [user?.id]);

  useEffect(() => {
    verificarEdicoesGuardadas();
  }, [verificarEdicoesGuardadas]);

  const carregar = useCallback(async () => {
    setCarregando(true);
    setErro(null);
    try {
      setGrupos(await listarGrupos(supabaseConfigAdapter));
      return true;
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Não foi possível carregar os grupos.");
      return false;
    } finally {
      setCarregando(false);
    }
  }, []);

  useEffect(() => {
    carregar();
  }, [carregar]);

  function abrirCriacao() {
    setAtorFormulario(user?.id ?? null);
    setConflito(false);
    setConflitoAtualizado(false);
    setForm(FORM_VAZIO);
    setErroForm(null);
    setEditandoId(null);
    setCriando(true);
  }

  function abrirEdicao(grupo: Grupo) {
    setAtorFormulario(user?.id ?? null);
    setConflito(false);
    setConflitoAtualizado(false);
    setEstadoAnterior({
      ...grupo,
      permissoes: grupo.permissoes.map((permissao) => ({ ...permissao })),
    });
    setForm({
      nome: grupo.nome,
      descricao: grupo.descricao ?? "",
      ativo: grupo.ativo,
      permissoes: paraMapa(grupo.permissoes),
    });
    setErroForm(null);
    setCriando(false);
    setEditandoId(grupo.id);
  }

  function fechar() {
    setCriando(false);
    setEditandoId(null);
    setEstadoAnterior(null);
    setAtorFormulario(null);
    setConflito(false);
    setConflitoAtualizado(false);
  }

  function alterarPermissao(modulo: ModuloId, nivel: NivelAcesso | null) {
    setForm((atual) => {
      const permissoes = { ...atual.permissoes };
      if (nivel === null) delete permissoes[modulo];
      else permissoes[modulo] = nivel;
      return { ...atual, permissoes };
    });
  }

  async function salvar() {
    if (conflito) return;
    if (!atorFormulario || user?.id !== atorFormulario) {
      setErroForm("A sessão mudou. Feche e abra o formulário novamente.");
      return;
    }
    setSalvando(true);
    setErroForm(null);
    try {
      const permissoes = paraLista(form.permissoes);
      if (editandoId) {
        await editarGrupo(supabaseConfigAdapter, editandoId, {
          nome: form.nome,
          descricao: form.descricao || null,
          ativo: form.ativo,
          permissoes,
          estadoEsperado: estadoAnterior ?? undefined,
          atorEsperado: atorFormulario,
        });
      } else {
        await criarGrupo(
          supabaseConfigAdapter,
          form.nome,
          form.descricao || null,
          permissoes,
          atorFormulario,
        );
      }
      fechar();
      verificarCriacaoGuardada();
      verificarEdicoesGuardadas();
      await carregar();
    } catch (e) {
      verificarCriacaoGuardada();
      verificarEdicoesGuardadas();
      if (typeof e === "object" && e !== null && "code" in e && e.code === "40001") {
        setConflito(true);
        setConflitoAtualizado(false);
        setErroForm(
          "O grupo mudou durante a edição. Seus dados foram preservados; recarregue e compare antes de salvar.",
        );
      } else if (typeof e === "object" && e !== null && "code" in e && e.code === "55P03") {
        setErroForm(
          "Outra alteração de permissões está em andamento. Confira o grupo e tente novamente quando terminar.",
        );
      } else {
        // E01-S189 AC-5: "não liberado"/"sem permissão" não se resolvem repetindo a tentativa.
        const falha = mensagemFalhaAtivacao(e);
        setErroForm(
          falha
            ? TEXTO_FALHA_ATIVACAO[falha]
            : e instanceof Error
              ? e.message
              : "Não foi possível salvar o grupo. Confira o resultado antes de repetir.",
        );
      }
    } finally {
      setSalvando(false);
    }
  }

  const editandoGrupo = editandoId ? grupos.find((g) => g.id === editandoId) : null;
  const formAberto = criando || editandoId !== null;

  return (
    <div className="page-stack">
      <div className="page-header">
        <div>
          <h1 className="page-title">Grupos</h1>
          <p className="page-subtitle">Conjuntos reutilizáveis de permissão por módulo.</p>
        </div>
        <Button variant="accent" onClick={abrirCriacao}>
          Novo grupo
        </Button>
      </div>

      {erro && <p className="status-error">{erro}</p>}
      {criacaoGuardada === "invalida" && (
        <p role="alert">
          Tentativa de criação ilegível. Consulte suporte antes de criar outro grupo.
        </p>
      )}
      {criacaoGuardada && criacaoGuardada !== "invalida" && (
        <section aria-label="Criação de grupo pendente">
          <p>
            Há uma criação sem confirmação nesta aba. Confira os dados antes de repetir a mesma
            tentativa.
          </p>
          <button
            type="button"
            onClick={() => {
              setAtorFormulario(user?.id ?? null);
              setEditandoId(null);
              setConflito(false);
              setConflitoAtualizado(false);
              setErroForm(null);
              setForm({
                nome: criacaoGuardada.nome,
                descricao: criacaoGuardada.descricao ?? "",
                ativo: true,
                permissoes: paraMapa(criacaoGuardada.permissoes),
              });
              setCriando(true);
            }}
          >
            Recuperar tentativa
          </button>
        </section>
      )}
      {edicoesGuardadas &&
        user?.id &&
        edicoesGuardadas.ator === user.id &&
        edicoesGuardadas.invalidas > 0 && (
          <p role="alert">
            Há edição de grupo ilegível nesta aba. Consulte suporte antes de alterá-la.
          </p>
        )}
      {edicoesGuardadas &&
        user?.id &&
        edicoesGuardadas.ator === user.id &&
        edicoesGuardadas.itens.map((tentativa) => (
          <section key={tentativa.requestId} aria-label="Edição de grupo pendente">
            <p>
              Edição de {tentativa.campos.nome} sem confirmação nesta aba. Recupere e confira os
              dados; só a mesma tentativa poderá ser repetida.
            </p>
            <button
              type="button"
              onClick={() => {
                if (user?.id !== tentativa.ator) return;
                setAtorFormulario(tentativa.ator);
                setCriando(false);
                setEditandoId(tentativa.id);
                setEstadoAnterior({ id: tentativa.id, ...tentativa.estado });
                setForm({
                  nome: tentativa.campos.nome,
                  descricao: tentativa.campos.descricao ?? "",
                  ativo: tentativa.campos.ativo,
                  permissoes: paraMapa(tentativa.permissoes),
                });
                setConflito(false);
                setConflitoAtualizado(false);
                setErroForm(null);
              }}
            >
              Recuperar edição
            </button>
          </section>
        ))}

      {carregando ? (
        <div
          className="surface-card h-24 animate-pulse bg-line-soft"
          aria-label="Carregando grupos"
        />
      ) : grupos.length === 0 ? (
        <div className="empty-state">
          <span className="mb-3 inline-flex h-10 w-10 items-center justify-center rounded-full bg-line-soft text-ink-3">
            <UsersRound className="h-5 w-5" />
          </span>
          <p className="font-semibold text-ink-2">Nenhum grupo criado</p>
          <p className="mt-1 max-w-sm">
            Crie um grupo para reutilizar o mesmo conjunto de permissões.
          </p>
        </div>
      ) : (
        <div className="surface-card divide-y divide-line-soft">
          {grupos.map((grupo) => (
            <div key={grupo.id} className="flex items-center gap-3 px-4 py-3">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <p className="text-body font-medium text-ink truncate">{grupo.nome}</p>
                  {!grupo.ativo && (
                    <span className="text-micro font-medium px-2 py-0.5 rounded-full bg-line-soft text-ink-2">
                      Inativo
                    </span>
                  )}
                </div>
                {grupo.descricao && (
                  <p className="text-caption text-ink-3 truncate mt-0.5">{grupo.descricao}</p>
                )}
              </div>
              <span className="text-caption text-ink-3 shrink-0">
                {grupo.permissoes.length} módulo{grupo.permissoes.length === 1 ? "" : "s"}
              </span>
              <Button variant="ghost" size="sm" onClick={() => abrirEdicao(grupo)}>
                Editar
              </Button>
            </div>
          ))}
        </div>
      )}

      {formAberto && (
        <Modal
          open
          onOpenChange={(aberto) => {
            if (!aberto) fechar();
          }}
          titulo={editandoId ? `Editar grupo — ${editandoGrupo?.nome ?? ""}` : "Novo grupo"}
          tamanho="md"
        >
          <div className="flex flex-col gap-4">
            <Field label="Nome">
              {(props) => (
                <input
                  {...props}
                  value={form.nome}
                  onChange={(e) => setForm((f) => ({ ...f, nome: e.target.value }))}
                  className="input"
                />
              )}
            </Field>

            <Field label="Descrição">
              {(props) => (
                <Textarea
                  {...props}
                  value={form.descricao}
                  onChange={(e) => setForm((f) => ({ ...f, descricao: e.target.value }))}
                  rows={2}
                />
              )}
            </Field>

            <div>
              <p className="block text-body font-medium text-ink-2 mb-1.5">Permissões por módulo</p>
              <ModuloPermissaoGrid permissoes={form.permissoes} onChange={alterarPermissao} />
            </div>

            {editandoId && (
              <label className="flex items-center gap-2 text-body text-ink-2">
                <input
                  type="checkbox"
                  checked={form.ativo}
                  onChange={(e) => setForm((f) => ({ ...f, ativo: e.target.checked }))}
                  className="rounded border-line"
                />
                Grupo ativo
              </label>
            )}

            {erroForm && <p className="status-error">{erroForm}</p>}
            {conflito && (
              <section aria-label="Conflito de edição do grupo">
                <button
                  type="button"
                  disabled={carregando}
                  onClick={() => void carregar().then((ok) => setConflitoAtualizado(ok))}
                >
                  Recarregar grupo atual
                </button>
                {conflitoAtualizado && editandoGrupo && (
                  <>
                    <p>
                      Atual: {editandoGrupo.nome} · {editandoGrupo.ativo ? "ativo" : "inativo"} ·{" "}
                      {editandoGrupo.descricao || "sem descrição"}.
                    </p>
                    <ul>
                      {editandoGrupo.permissoes.map((p) => (
                        <li key={p.modulo}>
                          {p.modulo}: {p.nivel}
                        </li>
                      ))}
                    </ul>
                    <p>
                      Os campos acima continuam com seus valores. Ao confirmar, eles poderão
                      substituir a versão atual.
                    </p>
                    <button
                      type="button"
                      onClick={() => {
                        setEstadoAnterior({
                          ...editandoGrupo,
                          permissoes: editandoGrupo.permissoes.map((p) => ({ ...p })),
                        });
                        setConflito(false);
                        setConflitoAtualizado(false);
                        setErroForm(null);
                      }}
                    >
                      Conferi e quero usar a versão atual como base
                    </button>
                  </>
                )}
                {conflitoAtualizado && !editandoGrupo && (
                  <p role="alert">Grupo indisponível; não é possível continuar esta edição.</p>
                )}
              </section>
            )}

            <div className="flex items-center justify-end gap-2 border-t border-line-soft pt-4">
              <Button variant="secondary" onClick={fechar}>
                Cancelar
              </Button>
              <Button
                variant="accent"
                onClick={salvar}
                disabled={salvando || conflito}
                loading={salvando}
              >
                Salvar
              </Button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}

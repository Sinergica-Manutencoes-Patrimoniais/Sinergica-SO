// Implementa ConfigGateway usando @supabase/supabase-js (único ponto da feature config que
// conhece o SDK do Supabase — ver docs/ARCHITECTURE.md, regra de dependência da infrastructure/).
import { supabase } from "../../../lib/supabase-client";
import type {
  ConfigGateway,
  CriarUsuarioInput,
  ModoPermissaoInput,
  ModoPermissaoUsuario,
  PatchGrupo,
  UsuarioConfig,
} from "../application/config-gateway";
import type { Grupo, PermissaoModulo } from "../domain/grupo";
import type { NivelAcesso } from "../domain/modulo";

function permissoesParaObjeto(permissoes: readonly PermissaoModulo[]): Record<string, NivelAcesso> {
  return Object.fromEntries(permissoes.map((p) => [p.modulo, p.nivel]));
}

// FunctionsHttpError expõe a Response original em `.context` — sem isso, o erro repassado à UI
// seria só "Edge Function returned a non-2xx status code", sem a mensagem real (RFC7807 `detail`)
// que a config-gerenciar-usuario devolve (ex.: "Supervisor não pode criar superadmin").
async function extrairDetalheErro(error: unknown): Promise<string | null> {
  if (!error || typeof error !== "object" || !("context" in error)) return null;
  const context = (error as { context?: Response }).context;
  if (!context || typeof context.json !== "function") return null;
  try {
    const body = await context.json();
    return typeof body?.detail === "string" ? body.detail : null;
  } catch {
    return null;
  }
}

export const supabaseConfigAdapter: ConfigGateway = {
  async minhasPermissoes() {
    const { data, error } = await supabase
      .schema("config")
      .from("minhas_permissoes")
      .select("modulo, nivel");
    if (error) throw error;
    return (data ?? []) as PermissaoModulo[];
  },

  async listarGrupos(): Promise<Grupo[]> {
    const { data: grupos, error } = await supabase
      .schema("config")
      .from("grupos")
      .select("id, nome, descricao, ativo")
      .order("nome");
    if (error) throw error;

    const { data: modulos, error: modulosError } = await supabase
      .schema("config")
      .from("grupo_modulos")
      .select("grupo_id, modulo, nivel");
    if (modulosError) throw modulosError;

    return (grupos ?? []).map((g) => ({
      id: g.id,
      nome: g.nome,
      descricao: g.descricao,
      ativo: g.ativo,
      permissoes: (modulos ?? [])
        .filter((m) => m.grupo_id === g.id)
        .map((m) => ({ modulo: m.modulo, nivel: m.nivel }) as PermissaoModulo),
    }));
  },

  async criarGrupo(nome, descricao, permissoes, atorEsperado): Promise<Grupo> {
    if (import.meta.env.VITE_SSO_GRUPO_ATOMICO_ENABLED === "true") {
      const identidade = await supabase.auth.getUser();
      if (identidade.error || !identidade.data.user?.id || identidade.data.user.id !== atorEsperado) throw new Error("Sessão alterada. Nenhum grupo foi enviado.");
      const usuarioId = identidade.data.user.id;
      const chave = `sso-criacao-grupo:${usuarioId}`;
      const salvo = sessionStorage.getItem(chave);
      let id: string;
      if (salvo !== null) {
        let anterior: unknown;
        try { anterior = JSON.parse(salvo); } catch { throw new Error("Tentativa anterior ilegível. Consulte suporte antes de criar outro grupo."); }
        if (!anterior || typeof anterior !== "object" || Array.isArray(anterior) || !("id" in anterior) || typeof anterior.id !== "string" ||
          !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(anterior.id) ||
          JSON.stringify(anterior) !== JSON.stringify({ id: anterior.id, nome, descricao, permissoes }))
          throw new Error("Há outra criação pendente nesta sessão. Confira o resultado e consulte suporte.");
        id = anterior.id;
      } else {
        id = crypto.randomUUID();
      }
      const tentativa = JSON.stringify({ id, nome, descricao, permissoes });
      if (salvo === null) sessionStorage.setItem(chave, tentativa);
      const antes = await supabase.auth.getUser();
      if (antes.error || antes.data.user?.id !== usuarioId || sessionStorage.getItem(chave) !== tentativa)
        throw new Error("Sessão ou tentativa alterada. Confira o grupo antes de continuar.");
      const { error } = await supabase.schema("config").rpc("sso_criar_grupo_atomico", {
        p_id: id, p_nome: nome, p_descricao: descricao, p_permissoes: permissoes, p_ator_esperado: usuarioId,
      });
      if (error) throw new Error("Criação não confirmada. Repita com os mesmos dados ou consulte suporte.");
      const depois = await supabase.auth.getUser();
      if (depois.error || depois.data.user?.id !== usuarioId || sessionStorage.getItem(chave) !== tentativa)
        throw new Error("Grupo enviado, mas sessão ou tentativa mudou. Confira o resultado antes de continuar.");
      sessionStorage.removeItem(chave);
      return { id, nome, descricao, ativo: true, permissoes };
    }
    const { data: grupo, error } = await supabase
      .schema("config")
      .from("grupos")
      .insert({ nome, descricao })
      .select("id, nome, descricao, ativo")
      .single();
    if (error) throw error;

    if (permissoes.length > 0) {
      const { error: modulosError } = await supabase
        .schema("config")
        .from("grupo_modulos")
        .insert(permissoes.map((p) => ({ grupo_id: grupo.id, modulo: p.modulo, nivel: p.nivel })));
      if (modulosError) {
        // Sem RPC atômica para grupo+módulos (ver design da E00-S09) — desfaz manualmente para
        // não deixar um grupo órfão sem nenhuma permissão gravada.
        await supabase.schema("config").from("grupos").delete().eq("id", grupo.id);
        throw modulosError;
      }
    }

    return {
      id: grupo.id,
      nome: grupo.nome,
      descricao: grupo.descricao,
      ativo: grupo.ativo,
      permissoes,
    };
  },

  async editarGrupo(id, patch: PatchGrupo): Promise<Grupo> {
    const campos: Record<string, unknown> = {};
    if (patch.nome !== undefined) campos.nome = patch.nome;
    if (patch.descricao !== undefined) campos.descricao = patch.descricao;
    if (patch.ativo !== undefined) campos.ativo = patch.ativo;

    if (import.meta.env.VITE_SSO_GRUPO_ATOMICO_ENABLED === "true") {
      if (!patch.estadoEsperado || patch.estadoEsperado.id !== id || !patch.atorEsperado) throw new Error("Estado anterior ou sessão do grupo indisponível; recarregue antes de editar.");
      const anterior = patch.estadoEsperado;
      const ator = patch.atorEsperado;
      const identidade = await supabase.auth.getUser();
      if (identidade.error || identidade.data.user?.id !== ator) throw new Error("Sessão alterada. Nenhuma edição foi enviada.");
      const estado = { nome: anterior.nome, descricao: anterior.descricao, ativo: anterior.ativo,
        permissoes: [...anterior.permissoes].sort((a, b) => a.modulo < b.modulo ? -1 : a.modulo > b.modulo ? 1 : 0) };
      const conteudo = { id, campos, permissoes: patch.permissoes ?? null, estado, ator };
      const chave = `sso-edicao-grupo:${ator}:${id}`;
      const salvo = sessionStorage.getItem(chave);
      let requestId: string;
      if (salvo !== null) {
        let tentativaAnterior: unknown;
        try { tentativaAnterior = JSON.parse(salvo); } catch { throw new Error("Edição anterior ilegível. Consulte suporte antes de continuar."); }
        if (!tentativaAnterior || typeof tentativaAnterior !== "object" || Array.isArray(tentativaAnterior) ||
          !("requestId" in tentativaAnterior) || typeof tentativaAnterior.requestId !== "string" ||
          !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(tentativaAnterior.requestId) ||
          JSON.stringify(tentativaAnterior) !== JSON.stringify({ requestId: tentativaAnterior.requestId, ...conteudo }))
          throw new Error("Há outra edição pendente nesta sessão. Confira o resultado e consulte suporte.");
        requestId = tentativaAnterior.requestId;
      } else requestId = crypto.randomUUID();
      const tentativa = JSON.stringify({ requestId, ...conteudo });
      if (salvo === null) sessionStorage.setItem(chave, tentativa);
      const antes = await supabase.auth.getUser();
      if (antes.error || antes.data.user?.id !== ator || sessionStorage.getItem(chave) !== tentativa)
        throw new Error("Sessão ou tentativa alterada. Confira o grupo antes de continuar.");
      const { error } = await supabase.schema("config").rpc("sso_editar_grupo_idempotente", {
        p_request_id: requestId, p_id: id, p_patch: campos, p_permissoes: conteudo.permissoes,
        p_ator_esperado: ator, p_estado_esperado: estado,
      });
      const depois = await supabase.auth.getUser();
      if (depois.error || depois.data.user?.id !== ator || sessionStorage.getItem(chave) !== tentativa)
        throw new Error("Resultado não confirmado para esta sessão. Confira o grupo antes de continuar.");
      if (error) {
        if (error.code === "40001") sessionStorage.removeItem(chave);
        throw error;
      }
      sessionStorage.removeItem(chave);
    } else {
    if (Object.keys(campos).length > 0) {
      const { error } = await supabase.schema("config").from("grupos").update(campos).eq("id", id);
      if (error) throw error;
    }

    if (patch.permissoes !== undefined) {
      const { error: deleteError } = await supabase
        .schema("config")
        .from("grupo_modulos")
        .delete()
        .eq("grupo_id", id);
      if (deleteError) throw deleteError;

      if (patch.permissoes.length > 0) {
        const { error: insertError } = await supabase
          .schema("config")
          .from("grupo_modulos")
          .insert(
            patch.permissoes.map((p) => ({ grupo_id: id, modulo: p.modulo, nivel: p.nivel })),
          );
        if (insertError) throw insertError;
      }
    }
    }

    const { data: grupo, error: fetchError } = await supabase
      .schema("config")
      .from("grupos")
      .select("id, nome, descricao, ativo")
      .eq("id", id)
      .single();
    if (fetchError) throw fetchError;

    const { data: modulos, error: modulosError } = await supabase
      .schema("config")
      .from("grupo_modulos")
      .select("modulo, nivel")
      .eq("grupo_id", id);
    if (modulosError) throw modulosError;

    return {
      id: grupo.id,
      nome: grupo.nome,
      descricao: grupo.descricao,
      ativo: grupo.ativo,
      permissoes: (modulos ?? []) as PermissaoModulo[],
    };
  },

  async listarUsuarios(): Promise<UsuarioConfig[]> {
    const { data: usuarios, error } = await supabase
      .schema("config")
      .from("usuarios")
      .select("user_id, nome, papel, ativo, grupo_id")
      .order("nome");
    if (error) throw error;

    const { data: grupos, error: gruposError } = await supabase
      .schema("config")
      .from("grupos")
      .select("id, nome");
    if (gruposError) throw gruposError;

    const { data: modulos, error: modulosError } = await supabase
      .schema("config")
      .from("usuario_modulos")
      .select("user_id, modulo, nivel");
    if (modulosError) throw modulosError;

    return (usuarios ?? []).map((u) => {
      const modo: ModoPermissaoUsuario = u.grupo_id
        ? {
            tipo: "grupo",
            grupoId: u.grupo_id,
            grupoNome: (grupos ?? []).find((g) => g.id === u.grupo_id)?.nome ?? null,
          }
        : {
            tipo: "individual",
            permissoes: (modulos ?? [])
              .filter((m) => m.user_id === u.user_id)
              .map((m) => ({ modulo: m.modulo, nivel: m.nivel }) as PermissaoModulo),
          };
      return { userId: u.user_id, nome: u.nome, papel: u.papel, ativo: u.ativo, modo };
    });
  },

  async criarUsuario(input: CriarUsuarioInput) {
    const { data, error } = await supabase.functions.invoke<{ userId: string }>(
      "config-gerenciar-usuario",
      {
        body: {
          email: input.email,
          senha: input.senha,
          nome: input.nome,
          papel: input.papel,
          clienteId: input.clienteId,
          modo:
            input.modo.tipo === "grupo"
              ? { tipo: "grupo", grupoId: input.modo.grupoId }
              : { tipo: "individual", permissoes: permissoesParaObjeto(input.modo.permissoes) },
        },
      },
    );

    if (error) {
      const detalhe = await extrairDetalheErro(error);
      throw new Error(detalhe ?? error.message);
    }
    if (!data) throw new Error("Resposta vazia da função de criação de usuário.");

    return { userId: data.userId };
  },

  async definirPermissaoUsuario(userId: string, modo: ModoPermissaoInput) {
    const { error } = await supabase.schema("config").rpc("definir_permissao_usuario", {
      p_user_id: userId,
      p_grupo_id: modo.tipo === "grupo" ? modo.grupoId : null,
      p_permissoes: modo.tipo === "individual" ? permissoesParaObjeto(modo.permissoes) : null,
    });
    if (error) throw error;
  },

  async resolverPermissoesDe(userId) {
    const { data, error } = await supabase.schema("config").rpc("resolver_permissoes_modulo", {
      p_user_id: userId,
    });
    if (error) throw error;
    return (data ?? []) as PermissaoModulo[];
  },
};

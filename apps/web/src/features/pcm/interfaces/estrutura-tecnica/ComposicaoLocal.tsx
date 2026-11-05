import { useInfiniteQuery, useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { z } from "zod";
import { supabase } from "../../../../lib/supabase-client";
import { supabaseCapacidadesSsoAdapter } from "../../infrastructure/supabase-capacidades-sso-adapter";
import { HistoricoGrupo } from "./HistoricoGrupo";
import { FotosGrupo } from "./FotosGrupo";
import { FotosStagingGrupo } from "./FotosStagingGrupo";
import { FotosVerificadasGrupo } from "./FotosVerificadasGrupo";
import { FotosStagingAtivo } from "./FotosStagingAtivo";
import { ResultadosDoAlvo } from "../pendencias-tecnicas/ResultadosAtivo";
import { PendenciasDoAlvo } from "../pendencias-tecnicas/PendenciasDoAlvo";
import { BreadcrumbGrupo } from "./BreadcrumbGrupo";
import { AtivoLocalLeitura } from "./AtivoLocalLeitura";
import { PlanosDoAlvo } from "./PlanosDoAlvo";
import { BreadcrumbAtivo } from "./BreadcrumbAtivo";

type Props = { userId: string; clienteId: string; localId: string; caminho: string[] };
const item = z.object({ id: z.string().uuid(), nome: z.string(), tipo: z.enum(["equipamento", "componente"]),
  identificador: z.string().nullish(), parent_item_id: z.string().uuid().nullish(), categoria: z.string().nullish() });
const grupo = z.object({ id: z.string().uuid(), nome: z.string(), quantidade: z.number().int().positive().safe(), categoria_id: z.string().uuid(), sistema_id: z.string().uuid().nullable() });
const vinculo = z.object({ item_id: z.string().uuid(), sistema_id: z.string().uuid(), sistemas: z.object({ nome: z.string(), ativo: z.boolean() }) });

export function ComposicaoLocal(props: Props) {
  if (import.meta.env.VITE_SSO_COMPOSICAO_LOCAL_ENABLED !== "true") return null;
  return <Abrir key={JSON.stringify([props.userId, props.clienteId, props.localId])} {...props}/>;
}
function Abrir(props: Props) {
  const [aberto, setAberto] = useState(false);
  return <section><button type="button" aria-expanded={aberto} onClick={() => setAberto(v => !v)}>{aberto ? "Ocultar composição do Local" : "Ver composição do Local"}</button>{aberto && <Conteudo {...props}/>}</section>;
}
function Conteudo({ userId, clienteId, localId, caminho }: Props) {
  const permissao = useQuery({ queryKey: ["estrutura-tecnica", userId, clienteId, "local-composicao-permissao"], gcTime: 0, refetchOnWindowFocus: true,
    queryFn: async () => (await supabaseCapacidadesSsoAdapter.autorizarAcao("cadastro.ler", clienteId)) || (await supabaseCapacidadesSsoAdapter.autorizarAcao("cadastro.gerir", clienteId)) });
  const permitido = permissao.data === true && !permissao.isFetching && !permissao.isError;
  const itens = useInfiniteQuery({ queryKey: ["estrutura-tecnica", userId, clienteId, localId, "composicao-itens"], enabled: permitido, gcTime: 0, initialPageParam: 0,
    queryFn: async ({ pageParam, signal }) => { const { data, error } = await supabase.schema("pcm").from("equipamentos").select("id,nome,tipo,identificador,parent_item_id,categoria").eq("client_id", clienteId).eq("local_id", localId).eq("ativo", true).is("deleted_at", null).order("id").range(pageParam, pageParam + 49).abortSignal(signal); if (error) throw error; return z.array(item).max(50).parse(data); },
    getNextPageParam: (pagina, paginas) => pagina.length === 50 ? paginas.length * 50 : undefined });
  const grupos = useInfiniteQuery({ queryKey: ["estrutura-tecnica", userId, clienteId, localId, "composicao-grupos"], enabled: permitido, gcTime: 0, initialPageParam: 0,
    queryFn: async ({ pageParam, signal }) => { const { data, error } = await supabase.schema("pcm").from("grupos_quantitativos").select("id,nome,quantidade,categoria_id,sistema_id").eq("cliente_id", clienteId).eq("local_id", localId).eq("ativo", true).is("deleted_at", null).order("id").range(pageParam, pageParam + 49).abortSignal(signal); if (error) throw error; return z.array(grupo).max(50).parse(data); },
    getNextPageParam: (pagina, paginas) => pagina.length === 50 ? paginas.length * 50 : undefined });
  const vinculos = useInfiniteQuery({ queryKey: ["estrutura-tecnica", userId, clienteId, localId, "composicao-vinculos"], enabled: permitido, gcTime: 0, initialPageParam: 0,
    queryFn: async ({ pageParam, signal }) => { const { data, error } = await supabase.schema("pcm").from("sistema_itens").select("item_id,sistema_id,sistemas!inner(nome,ativo,cliente_id),equipamentos!inner(client_id,local_id)").eq("sistemas.cliente_id", clienteId).eq("equipamentos.client_id", clienteId).eq("equipamentos.local_id", localId).order("sistema_id").order("item_id").range(pageParam, pageParam + 49).abortSignal(signal); if (error) throw error; return z.array(vinculo).max(50).parse(data); },
    getNextPageParam: (pagina, paginas) => pagina.length === 50 ? paginas.length * 50 : undefined });
  const sistemas = useInfiniteQuery({ queryKey: ["estrutura-tecnica", userId, clienteId, localId, "composicao-sistemas"], enabled: permitido, gcTime: 0, initialPageParam: 0,
    queryFn: async ({ pageParam, signal }) => { const { data, error } = await supabase.schema("pcm").from("sistemas").select("id,nome,ativo").eq("cliente_id", clienteId).is("deleted_at", null).order("id").range(pageParam, pageParam + 49).abortSignal(signal); if (error) throw error; return z.array(z.object({ id: z.string().uuid(), nome: z.string(), ativo: z.boolean() })).max(50).parse(data); },
    getNextPageParam: (pagina, paginas) => pagina.length === 50 ? paginas.length * 50 : undefined });
  const categorias = useInfiniteQuery({ queryKey: ["estrutura-tecnica", userId, clienteId, localId, "composicao-categorias"], enabled: permitido, gcTime: 0, initialPageParam: 0,
    queryFn: async ({ pageParam, signal }) => { const { data, error } = await supabase.schema("pcm").from("equipamento_categorias").select("id,nome").is("deleted_at", null).order("id").range(pageParam, pageParam + 49).abortSignal(signal); if (error) throw error; return z.array(z.object({ id: z.string().uuid(), nome: z.string() })).max(50).parse(data); },
    getNextPageParam: (pagina, paginas) => pagina.length === 50 ? paginas.length * 50 : undefined });
  if (permissao.isPending || permissao.isFetching) return <output>Verificando acesso à composição…</output>;
  if (permissao.isError) return <p role="alert">Não foi possível verificar acesso. <button type="button" onClick={() => void permissao.refetch()}>Tentar novamente</button></p>;
  if (!permitido) return null;
  const consultas = [itens, grupos, vinculos, sistemas, categorias];
  const disponivel = (q: { isPending: boolean; isFetching: boolean; isError: boolean }) => !q.isPending && !q.isFetching && !q.isError;
  const itensCarregados = disponivel(itens) ? itens.data?.pages.flat() ?? [] : [];
  const gruposCarregados = disponivel(grupos) ? grupos.data?.pages.flat() ?? [] : [];
  const relacoes = disponivel(vinculos) ? vinculos.data?.pages.flat() ?? [] : [];
  const sistemasCarregados = disponivel(sistemas) ? sistemas.data?.pages.flat() ?? [] : [];
  const categoriasCarregadas = disponivel(categorias) ? categorias.data?.pages.flat() ?? [] : [];
  const incompleta = consultas.some(q => q.hasNextPage || !disponivel(q));
  const secoes = new Map<string, { id: string; nome: string; descricao: string; grupoId?: string; tipoItem?: "equipamento" | "componente" }[]>();
  function adicionar(secao: string, entrada: { id: string; nome: string; descricao: string; grupoId?: string; tipoItem?: "equipamento" | "componente" }) { const anterior = secoes.get(secao) ?? []; anterior.push(entrada); secoes.set(secao, anterior); }
  for (const i of itensCarregados) {
    const sistemas = relacoes.filter(r => r.item_id === i.id);
    const unico = sistemas.length === 1 ? sistemas[0] : undefined;
    const secao = unico ? `Sistema ${unico.sistemas.nome}${unico.sistemas.ativo ? "" : " (inativo)"} · ${unico.sistema_id}` : sistemas.length > 1 ? "Múltiplos vínculos — revisar" : "Sistema não identificado nas páginas carregadas";
    const pai = i.parent_item_id ? itensCarregados.find(item => item.id === i.parent_item_id) : null;
    const referenciaPai = i.parent_item_id ? pai ? `${pai.nome} (${pai.id})` : `${i.parent_item_id} (nome fora dos itens carregados)` : "não informado";
    adicionar(secao, { id: i.id, nome: i.nome, tipoItem: i.tipo, descricao: `${i.tipo === "componente" ? "Componente" : "Equipamento"} · ${i.nome} · identificador ${i.identificador || "não informado"} · categoria ${i.categoria || "não informada"} · item superior ${referenciaPai}` });
  }
  for (const g of gruposCarregados) {
    const sistema = sistemasCarregados.find(s => s.id === g.sistema_id);
    const categoria = categoriasCarregadas.find(c => c.id === g.categoria_id);
    const secao = g.sistema_id ? sistema ? `Sistema ${sistema.nome}${sistema.ativo ? "" : " (inativo)"} · ${g.sistema_id}` : `Sistema ${g.sistema_id} · nome indisponível nas páginas carregadas` : "Sistema não informado";
    adicionar(secao, { id: g.id, nome: g.nome, grupoId: g.id, descricao: `Grupo Quantitativo · ${g.nome} · quantidade ${g.quantidade} · categoria ${categoria ? categoria.nome : `${g.categoria_id} (nome indisponível nas páginas carregadas)`}` });
  }
  return <section aria-label="Composição do Local"><p>Caminho na árvore carregada: {caminho.join(" › ")}. Não verifica ancestrais ausentes ou inconsistentes fora desta árvore.</p><p>Dados consultados por Cliente e Local; categorias são cadastro compartilhado. A paginação não é um retrato transacional.</p>
    {consultas.some(q => q.isPending || q.isFetching) && <output>Carregando fontes da composição…</output>}
    {consultas.some(q => q.isError) && <p role="alert">Uma ou mais fontes estão indisponíveis. As demais continuam visíveis, mas a composição está incompleta. <button type="button" onClick={() => { for (const q of consultas) if (q.isError) void q.refetch(); }}>Tentar fontes indisponíveis</button></p>}
    {incompleta && <p role="alert">Há fontes ou páginas não carregadas. Vínculos ausentes podem estar em outra página ou fonte indisponível.</p>}
    {disponivel(itens) && disponivel(grupos) && itensCarregados.length === 0 && gruposCarregados.length === 0 && <p>Nenhum ativo carregado; isso não comprova ausência física.</p>}
    {Array.from(secoes.entries()).map(([nome, linhas]) => <section key={nome}><h5>{nome}</h5>{(["componente", "equipamento", "grupo"] as const).map(tipo => {
      const itensDoTipo = linhas.filter(linha => tipo === "grupo" ? !!linha.grupoId : linha.tipoItem === tipo);
      if (!itensDoTipo.length) return null;
      return <section key={tipo}><h6>{tipo === "grupo" ? "Grupos Quantitativos" : tipo === "componente" ? "Componentes" : "Equipamentos"}</h6><ul>{itensDoTipo.map(linha => <li key={`${tipo}:${linha.id}`}>{linha.descricao}{linha.grupoId && <DetalhesGrupo userId={userId} clienteId={clienteId} grupoId={linha.grupoId} nome={linha.nome}/>} {linha.tipoItem && <><DetalhesItem userId={userId} clienteId={clienteId} itemId={linha.id} localId={localId} tipo={linha.tipoItem} nome={linha.nome}/><AtivoLocalLeitura userId={userId} clienteId={clienteId} localId={localId} itemId={linha.id}/></>}</li>)}</ul></section>;
    })}</section>)}
    {itens.hasNextPage && <button type="button" disabled={itens.isFetching} onClick={() => void itens.fetchNextPage()}>Mais Componentes e Equipamentos</button>}
    {grupos.hasNextPage && <button type="button" disabled={grupos.isFetching} onClick={() => void grupos.fetchNextPage()}>Mais Grupos</button>}
    {vinculos.hasNextPage && <button type="button" disabled={vinculos.isFetching} onClick={() => void vinculos.fetchNextPage()}>Mais vínculos de Sistema</button>}
    {sistemas.hasNextPage && <button type="button" disabled={sistemas.isFetching} onClick={() => void sistemas.fetchNextPage()}>Mais Sistemas</button>}
    {categorias.hasNextPage && <button type="button" disabled={categorias.isFetching} onClick={() => void categorias.fetchNextPage()}>Mais categorias</button>}
  </section>;
}

function DetalhesGrupo({ userId, clienteId, grupoId, nome }: { userId: string; clienteId: string; grupoId: string; nome: string }) {
  const [aberto, setAberto] = useState(false);
  return <section><button type="button" aria-expanded={aberto} aria-label={`${aberto ? "Ocultar" : "Ver"} detalhes do Grupo ${nome}`} onClick={() => setAberto(v => !v)}>{aberto ? "Ocultar detalhes do Grupo" : "Ver detalhes do Grupo"}</button>
    {aberto && <><p>Verificação da localização: {import.meta.env.VITE_SSO_BREADCRUMB_GRUPO_ENABLED === "true" ? <BreadcrumbGrupo userId={userId} clienteId={clienteId} grupoId={grupoId}/> : "consulta de hierarquia não habilitada; confira o caminho acima."}</p><HistoricoGrupo userId={userId} clienteId={clienteId} grupoId={grupoId}/><ResultadosDoAlvo userId={userId} clienteId={clienteId} tipo="grupo" id={grupoId} nome={nome}/><PendenciasDoAlvo userId={userId} clienteId={clienteId} tipo="grupo" id={grupoId}/><PlanosDoAlvo userId={userId} clienteId={clienteId} tipo="grupo" id={grupoId}/>{import.meta.env.VITE_SSO_FOTOS_GRUPO_ENABLED !== "true" && <p>Fotos do Grupo não habilitadas nesta visão.</p>}<FotosGrupo userId={userId} clienteId={clienteId} grupoId={grupoId} podeEditar={false}/><FotosStagingGrupo userId={userId} clienteId={clienteId} grupoId={grupoId}/><FotosVerificadasGrupo userId={userId} clienteId={clienteId} grupoId={grupoId}/></>}
  </section>;
}

function DetalhesItem({ userId, clienteId, itemId, localId, tipo, nome }: { userId: string; clienteId: string; itemId: string; localId: string; tipo: "equipamento" | "componente"; nome: string }) {
  const [aberto, setAberto] = useState(false);
  return <section><button type="button" aria-expanded={aberto} aria-label={`${aberto ? "Ocultar" : "Ver"} detalhes do ${tipo} ${nome}`} onClick={() => setAberto(v => !v)}>{aberto ? "Ocultar detalhes do item" : "Ver detalhes do item"}</button>
    {aberto && <><BreadcrumbAtivo userId={userId} clienteId={clienteId} ativoId={itemId} localId={localId}/><HistoricoGrupo tipo="componente" userId={userId} clienteId={clienteId} grupoId={itemId}/><ResultadosDoAlvo userId={userId} clienteId={clienteId} tipo="componente" id={itemId} nome={nome}/><PendenciasDoAlvo userId={userId} clienteId={clienteId} tipo="componente" id={itemId}/><PlanosDoAlvo userId={userId} clienteId={clienteId} tipo="componente" id={itemId}/><p>Somente fotos de levantamento com vínculo temporário e acesso mediado; outras fontes não são apresentadas aqui.</p>{(import.meta.env.VITE_SSO_FOTOS_STAGING_ATIVO_ENABLED !== "true" || (tipo === "equipamento" && import.meta.env.VITE_SSO_FOTOS_EQUIPAMENTO_ENABLED !== "true")) && <p>Fotos de levantamento não habilitadas nesta visão.</p>}<FotosStagingAtivo userId={userId} clienteId={clienteId} tipo={tipo} entidadeId={itemId}/></>}
  </section>;
}

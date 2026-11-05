import { useInfiniteQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { z } from "zod";
import { supabase } from "../../../../lib/supabase-client";

const pedidoSchema = z
  .object({
    requestId: z.string().uuid(),
    grupoId: z.string().uuid(),
    clienteId: z.string().uuid(),
    nome: z.string(),
    hash: z.string().regex(/^[a-f0-9]{64}$/),
    tipo: z.enum(["image/jpeg", "image/png"]),
  })
  .strict();
type Pedido = z.infer<typeof pedidoSchema>;
const fotosSchema = z
  .array(
    z
      .object({
        id: z.string().uuid(),
        criado_em: z.string().datetime({ offset: true }),
        verificada: z.boolean(),
      })
      .strict(),
  )
  .max(20);

export function FotosGrupo(props: {
  userId: string;
  clienteId: string;
  grupoId: string;
  podeEditar: boolean;
}) {
  if (import.meta.env.VITE_SSO_FOTOS_GRUPO_ENABLED !== "true") return null;
  return <Fotos key={JSON.stringify([props.userId, props.clienteId, props.grupoId])} {...props} />;
}
function Fotos({
  userId,
  clienteId,
  grupoId,
  podeEditar,
}: { userId: string; clienteId: string; grupoId: string; podeEditar: boolean }) {
  const chave = `sso-foto-grupo-v2:${JSON.stringify([userId, clienteId, grupoId])}`;
  const [pendente, setPendente] = useState<Pedido | "invalido" | null>(() => {
    try {
      if (sessionStorage.getItem(`sso-foto-grupo:${JSON.stringify([userId, clienteId, grupoId])}`))
        return "invalido";
      const valor = sessionStorage.getItem(chave);
      if (!valor) return null;
      const p = pedidoSchema.parse(JSON.parse(valor));
      return p.grupoId === grupoId &&
        p.clienteId === clienteId &&
        p.nome.startsWith(`${clienteId}/${grupoId}/`)
        ? p
        : "invalido";
    } catch {
      return "invalido";
    }
  });
  const [arquivo, setArquivo] = useState<File | null>(null);
  const [aviso, setAviso] = useState("");
  const trava = useRef(false);
  const montado = useRef(false);
  useEffect(() => {
    montado.current = true;
    return () => {
      montado.current = false;
    };
  }, []);
  const client = useQueryClient();
  const fotos = useInfiniteQuery({
    queryKey: ["fotos-grupo", userId, clienteId, grupoId],
    gcTime: 0,
    initialPageParam: null as string | null,
    queryFn: async ({ pageParam, signal }) => {
      const sessao = await supabase.auth.getUser();
      if (sessao.error || sessao.data.user?.id !== userId || signal.aborted)
        throw new Error("Sessão alterada");
      const { data, error } = await supabase
        .schema("pcm")
        .rpc("sso_listar_fotos_cadastrais_grupo_v2", {
          p_ator: userId,
          p_cliente: clienteId,
          p_grupo: grupoId,
          p_apos: pageParam,
          p_limite: 20,
        })
        .abortSignal(signal);
      const atual = await supabase.auth.getUser();
      if (atual.error || atual.data.user?.id !== userId || signal.aborted)
        throw new Error("Sessão alterada");
      if (error) throw error;
      return fotosSchema.parse(data);
    },
    getNextPageParam: (pagina) => (pagina.length === 20 ? pagina.at(-1)?.id : undefined),
  });
  const envio = useMutation({
    mutationFn: async ({ p, arquivo }: { p: Pedido; arquivo: File }) => {
      if (arquivo.size > 10485760 || arquivo.type !== p.tipo || arquivo.size === 0)
        throw new Error("Arquivo inválido");
      const digest = new Uint8Array(
        await crypto.subtle.digest("SHA-256", await arquivo.arrayBuffer()),
      );
      if (Array.from(digest, (v) => v.toString(16).padStart(2, "0")).join("") !== p.hash)
        throw new Error("Arquivo diferente da tentativa");
      const antes = await supabase.auth.getUser();
      if (antes.error || antes.data.user?.id !== userId || !montado.current)
        throw new Error("Sessão alterada");
      if (sessionStorage.getItem(chave) !== JSON.stringify(p))
        throw new Error("Tentativa alterada.");
      const { data, error } = await supabase.functions.invoke("pcm-ingestao-foto-cadastral-grupo", {
        body: arquivo,
        headers: {
          "x-request-id": p.requestId,
          "x-cliente-id": clienteId,
          "x-grupo-id": grupoId,
          "Content-Type": p.tipo,
        },
      });
      if (error) throw error;
      const resposta = z
        .object({
          fotoId: z.string().uuid(),
          requestId: z.string().uuid(),
        })
        .strict()
        .parse(data);
      if (resposta.requestId !== p.requestId) throw new Error("Resposta divergente");
      const depois = await supabase.auth.getUser();
      if (depois.error || depois.data.user?.id !== userId) throw new Error("Sessão alterada");
    },
    onSuccess: async (_r, { p }) => {
      try {
        const atual = await supabase.auth.getUser();
        if (atual.error || atual.data.user?.id !== userId || !montado.current)
          throw new Error("Sessão alterada");
        if (sessionStorage.getItem(chave) !== JSON.stringify(p))
          throw new Error("Tentativa divergente");
        sessionStorage.removeItem(chave);
      } catch {
        if (montado.current)
          setAviso("Foto vinculada; tentativa local não foi limpa. Consulte suporte.");
        return;
      }
      setPendente(null);
      setArquivo(null);
      setAviso("Foto vinculada.");
      await client.invalidateQueries({ queryKey: ["fotos-grupo", userId, clienteId, grupoId] });
    },
    onError: () => {
      if (montado.current)
        setAviso(
          "Não foi possível confirmar. Selecione o mesmo arquivo e repita a tentativa ou consulte suporte.",
        );
    },
    onSettled: () => {
      trava.current = false;
    },
  });
  async function enviar() {
    if (!podeEditar || !arquivo || trava.current || pendente === "invalido") return;
    trava.current = true;
    setAviso("");
    try {
      if (
        arquivo.size === 0 ||
        arquivo.size > 10485760 ||
        !["image/jpeg", "image/png"].includes(arquivo.type)
      )
        throw new Error("Arquivo inválido");
      const digest = new Uint8Array(
        await crypto.subtle.digest("SHA-256", await arquivo.arrayBuffer()),
      );
      const hash = Array.from(digest, (v) => v.toString(16).padStart(2, "0")).join("");
      const p =
        pendente ??
        pedidoSchema.parse({
          requestId: crypto.randomUUID(),
          clienteId,
          grupoId,
          nome: `${clienteId}/${grupoId}/${crypto.randomUUID()}`,
          hash,
          tipo: arquivo.type,
        });
      if (p.hash !== hash || p.tipo !== arquivo.type) throw new Error("Arquivo divergente");
      if (!pendente) {
        if (sessionStorage.getItem(chave) !== null) throw new Error("Tentativa existente");
        sessionStorage.setItem(chave, JSON.stringify(p));
        setPendente(p);
      }
      envio.mutate({ p, arquivo });
    } catch {
      trava.current = false;
      setAviso(
        "Selecione imagem JPEG/PNG de até 10 MiB; para recuperar, use exatamente o mesmo arquivo.",
      );
    }
  }
  return (
    <section aria-label="Fotos do Grupo">
      <h4>Fotos</h4>
      {fotos.isPending && <output>Carregando fotos…</output>}
      {fotos.isError && (
        <p role="alert">
          Não foi possível consultar fotos.{" "}
          <button type="button" onClick={() => void fotos.refetch()}>
            Tentar novamente
          </button>
        </p>
      )}
      {!fotos.isError && fotos.data?.pages.flat().length === 0 && <p>Nenhuma foto vinculada.</p>}
      {!fotos.isError &&
        !fotos.isFetching &&
        fotos.data?.pages
          .flat()
          .map((foto) => (
            <Foto
              key={foto.id}
              userId={userId}
              clienteId={clienteId}
              grupoId={grupoId}
              fotoId={foto.id}
              verificada={foto.verificada}
            />
          ))}
      {fotos.hasNextPage && (
        <button
          type="button"
          disabled={fotos.isFetchingNextPage}
          onClick={() => void fotos.fetchNextPage()}
        >
          Mais fotos
        </button>
      )}
      {podeEditar && (
        <>
          <label>
            Imagem JPEG ou PNG{" "}
            <input
              type="file"
              accept="image/jpeg,image/png"
              onChange={(e) => setArquivo(e.target.files?.[0] ?? null)}
            />
          </label>
          <button
            type="button"
            disabled={!arquivo || envio.isPending || pendente === "invalido"}
            onClick={() => void enviar()}
          >
            {pendente ? "Repetir envio" : "Adicionar foto"}
          </button>
        </>
      )}
      {pendente === "invalido" && <p role="alert">Tentativa local ilegível. Consulte suporte.</p>}
      {aviso && <output>{aviso}</output>}
    </section>
  );
}
function Foto({
  userId,
  clienteId,
  grupoId,
  fotoId,
  verificada,
}: { userId: string; clienteId: string; grupoId: string; fotoId: string; verificada: boolean }) {
  const [url, setUrl] = useState<string | null>(null);
  const [erro, setErro] = useState(false);
  const [abrindo, setAbrindo] = useState(false);
  const montado = useRef(false);
  const urlAtual = useRef<string | null>(null);
  useEffect(() => {
    montado.current = true;
    return () => {
      montado.current = false;
      if (urlAtual.current) URL.revokeObjectURL(urlAtual.current);
      urlAtual.current = null;
    };
  }, []);
  async function abrir() {
    setAbrindo(true);
    setErro(false);
    try {
      const antes = await supabase.auth.getUser();
      if (antes.error || antes.data.user?.id !== userId) throw new Error("Sessão alterada");
      const { data, error, response } = await supabase.functions.invoke(
        "pcm-foto-cadastral-grupo-segura",
        {
          body: { clienteId, grupoId, fotoId },
        },
      );
      if (
        error ||
        !(data instanceof Blob) ||
        !["image/jpeg", "image/png"].includes(data.type) ||
        data.size > 10485760 ||
        response?.headers.get("X-SSO-Foto-Verificacao") !==
          (verificada ? "sha256" : "historica-sem-digest")
      )
        throw new Error("Foto inválida");
      const depois = await supabase.auth.getUser();
      if (depois.error || depois.data.user?.id !== userId) throw new Error("Sessão alterada");
      if (!montado.current) return;
      const endereco = URL.createObjectURL(data);
      urlAtual.current = endereco;
      setUrl(endereco);
    } catch {
      if (montado.current) setErro(true);
    } finally {
      if (montado.current) setAbrindo(false);
    }
  }
  return (
    <div>
      {!verificada && <p>Foto histórica sem verificação de integridade.</p>}
      {url ? (
        <>
          <img src={url} alt="Foto do Grupo Quantitativo" />
          <button
            type="button"
            onClick={() => {
              if (urlAtual.current) URL.revokeObjectURL(urlAtual.current);
              urlAtual.current = null;
              setUrl(null);
            }}
          >
            Ocultar foto
          </button>
        </>
      ) : (
        <button type="button" disabled={abrindo} onClick={() => void abrir()}>
          Ver foto
        </button>
      )}
      {erro && <p role="alert">Foto indisponível ou acesso não autorizado.</p>}
    </div>
  );
}

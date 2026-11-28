import { Button, DataTable, Modal, RecursosNaoAtivadosGrupo } from "@sinergica/ui";
import { useState } from "react";
import type {
  PesquisaEstruturaGateway,
  ResultadoEstrutura,
  TipoEstrutura,
} from "../../application/pesquisa-estrutura-gateway";
import {
  usePesquisaEstrutura,
  useResumoGrupoEstrutura,
} from "../../application/pesquisa-estrutura-queries";
import { DrawerDetalheAtivo } from "../../components/DrawerDetalheAtivo";
import { DrawerDetalheSistema } from "../../components/DrawerDetalheSistema";
import { supabasePesquisaEstruturaAdapter } from "../../infrastructure/supabase-pesquisa-estrutura-adapter";
import { ComposicaoLocal } from "../estrutura-tecnica/ComposicaoLocal";
import { HistoricoGrupo } from "../estrutura-tecnica/HistoricoGrupo";
import { PlanosDoAlvo } from "../estrutura-tecnica/PlanosDoAlvo";
import { PendenciasDoAlvo } from "../pendencias-tecnicas/PendenciasDoAlvo";

// DEF-28: "Equipamento" é o nome da entidade no Auvo — ADR-0022/glossário proíbem usá-lo para o
// ativo do cliente na UI do SO ("use Componente"). pcm.equipamentos.tipo segue 'equipamento' para
// o Componente raiz (Principal) e 'componente' para o filho legado (mesma rotulagem de
// EquipamentosPage.tsx: "Principais" / "Subcomponentes (legado)"), nunca "Equipamento" cru.
const nomes: Record<TipoEstrutura, string> = {
  area: "Área",
  local: "Local",
  sistema: "Sistema",
  equipamento: "Componente (Principal)",
  componente: "Componente (Subcomponente)",
  grupo_quantitativo: "Grupo Quantitativo",
};
type Props = {
  usuario: string;
  clienteId: string;
  gateway?: PesquisaEstruturaGateway;
  onAbrirOs?: (id: string) => void;
};
export function PesquisaGlobalEstrutura(props: Props) {
  return <Conteudo key={JSON.stringify([props.usuario, props.clienteId])} {...props} />;
}
function Conteudo({
  usuario,
  clienteId,
  gateway = supabasePesquisaEstruturaAdapter,
  onAbrirOs,
}: Props) {
  const [entrada, setEntrada] = useState("");
  const [busca, setBusca] = useState("");
  const [tipo, setTipo] = useState<TipoEstrutura | "">("");
  const [caminho, setCaminho] = useState<ResultadoEstrutura[]>([]);
  const [detalhe, setDetalhe] = useState<ResultadoEstrutura | null>(null);
  const contexto = caminho.at(-1) ?? null;
  const resumoGrupo = useResumoGrupoEstrutura(
    gateway,
    usuario,
    clienteId,
    detalhe?.tipo === "grupo_quantitativo" ? detalhe.id : null,
  );
  const consulta = usePesquisaEstrutura(gateway, { usuario, clienteId, busca, tipo, contexto });
  const indisponivel = consulta.isError || (consulta.isFetching && !consulta.isFetchingNextPage);
  const itens = indisponivel ? [] : (consulta.data?.pages.flat() ?? []);
  const recusado =
    consulta.error &&
    typeof consulta.error === "object" &&
    "code" in consulta.error &&
    consulta.error.code === "42501";
  function navegar(item: ResultadoEstrutura) {
    setCaminho([...caminho, item]);
    setBusca("");
    setEntrada("");
    setTipo("");
    setDetalhe(null);
  }
  function voltar(indice: number) {
    setCaminho(caminho.slice(0, indice));
    setBusca("");
    setEntrada("");
    setTipo("");
    setDetalhe(null);
  }
  return (
    <section
      className="space-y-4 rounded-lg border border-line bg-card p-4"
      aria-label="Pesquisa e navegação da estrutura"
    >
      <h2 className="text-heading-sm font-semibold text-ink">Clientes e Estrutura</h2>
      <p className="text-body text-ink-3">
        Pesquise por nome, código ou TAG. Localização física e pertencimento a Sistema são
        preservados.
      </p>
      <form
        className="flex flex-wrap items-end gap-3"
        onSubmit={(e) => {
          e.preventDefault();
          setCaminho([]);
          setDetalhe(null);
          if (busca === entrada.trim()) void consulta.refetch();
          else setBusca(entrada.trim());
        }}
      >
        <label className="flex flex-col gap-1 text-body">
          Pesquisar estrutura
          <input
            name="buscaEstrutura"
            placeholder="Nome, código ou TAG"
            className="input"
            maxLength={200}
            value={entrada}
            onChange={(e) => setEntrada(e.target.value)}
          />
        </label>
        <label className="flex flex-col gap-1 text-body">
          Tipo
          <select
            className="input"
            value={tipo}
            onChange={(e) => {
              setTipo(e.target.value as TipoEstrutura | "");
              setDetalhe(null);
            }}
          >
            <option value="">Todos os tipos</option>
            {Object.entries(nomes).map(([id, nome]) => (
              <option key={id} value={id}>
                {nome}
              </option>
            ))}
          </select>
        </label>
        <Button type="submit">Pesquisar estrutura</Button>
      </form>
      <nav className="flex flex-wrap gap-2" aria-label="Caminho da estrutura">
        <Button size="sm" variant="secondary" onClick={() => voltar(0)}>
          Voltar ao Cliente
        </Button>
        {caminho.map((item, i) =>
          item === contexto ? (
            <span
              key={item.chave}
              aria-current="location"
              className="self-center text-body font-semibold text-ink"
            >
              {nomes[item.tipo]}: {item.nome}
            </span>
          ) : (
            <Button key={item.chave} size="sm" variant="secondary" onClick={() => voltar(i + 1)}>
              {nomes[item.tipo]}: {item.nome}
            </Button>
          ),
        )}
      </nav>
      {consulta.isError && (
        <p role="alert">
          {recusado
            ? "Sem permissão para consultar a estrutura deste Cliente."
            : "Não foi possível consultar a estrutura."}{" "}
          <Button size="sm" onClick={() => void consulta.refetch()}>
            Tentar novamente
          </Button>
        </p>
      )}
      <DataTable
        legenda="Resultados tipados da estrutura do Cliente"
        itens={itens}
        chaveLinha={(r) => r.chave}
        carregando={consulta.isPending || (indisponivel && !consulta.isError)}
        vazio="Nenhum resultado neste contexto ou filtro."
        colunas={[
          { chave: "tipo", cabecalho: "Tipo", render: (r) => nomes[r.tipo] },
          { chave: "nome", cabecalho: "Nome", cabecalhoLinha: true, render: (r) => r.nome },
          { chave: "codigo", cabecalho: "Código / TAG", render: (r) => r.codigo || "—" },
          {
            chave: "acoes",
            cabecalho: "Ações",
            render: (r) => (
              <div className="flex flex-wrap gap-2">
                <Button
                  size="sm"
                  aria-label={`Navegar em ${nomes[r.tipo]} ${r.nome}`}
                  onClick={() => navegar(r)}
                >
                  Navegar
                </Button>
                <Button
                  size="sm"
                  variant="secondary"
                  aria-label={`Ver ${nomes[r.tipo]} ${r.nome}`}
                  onClick={() => setDetalhe(r)}
                >
                  Ver detalhes
                </Button>
              </div>
            ),
          },
        ]}
      />
      {consulta.hasNextPage && (
        <Button disabled={consulta.isFetching} onClick={() => void consulta.fetchNextPage()}>
          Carregar mais resultados
        </Button>
      )}
      {detalhe &&
        !indisponivel &&
        (detalhe.tipo === "sistema" ? (
          <DrawerDetalheSistema
            sistemaId={detalhe.id}
            clienteEsperadoId={clienteId}
            onClose={() => setDetalhe(null)}
            onAbrirOs={onAbrirOs}
          />
        ) : detalhe.tipo === "equipamento" || detalhe.tipo === "componente" ? (
          <DrawerDetalheAtivo
            itemId={detalhe.id}
            onClose={() => setDetalhe(null)}
            onAtualizado={() => void consulta.refetch()}
          />
        ) : (
          <Modal
            open
            onOpenChange={(aberto) => {
              if (!aberto) setDetalhe(null);
            }}
            titulo={`${nomes[detalhe.tipo]}: ${detalhe.nome}`}
          >
            <div className="space-y-4 wrap-anywhere text-body text-ink">
              <RecursosNaoAtivadosGrupo compacto>
                <p className="text-caption text-ink-3">
                  Código / TAG: {detalhe.codigo || "não informado"}
                </p>
                {detalhe.tipo === "local" && (
                  <ComposicaoLocal
                    userId={usuario}
                    clienteId={clienteId}
                    localId={detalhe.id}
                    caminho={[...caminho.map((r) => r.nome), detalhe.nome]}
                  />
                )}
                {detalhe.tipo === "grupo_quantitativo" && (
                  <>
                    {resumoGrupo.isPending ? (
                      <p>Carregando dados do grupo…</p>
                    ) : resumoGrupo.isError || !resumoGrupo.data ? (
                      <p role="alert">Os dados do grupo estão indisponíveis.</p>
                    ) : (
                      <dl className="grid gap-3 rounded-lg border border-line bg-paper p-3 sm:grid-cols-3">
                        <div>
                          <dt className="text-caption text-ink-3">Quantidade</dt>
                          <dd>
                            {resumoGrupo.data.quantidade}{" "}
                            {resumoGrupo.data.quantidade === 1 ? "unidade" : "unidades"}
                          </dd>
                        </div>
                        <div>
                          <dt className="text-caption text-ink-3">Local</dt>
                          <dd>{resumoGrupo.data.local ?? "Indisponível"}</dd>
                        </div>
                        <div>
                          <dt className="text-caption text-ink-3">Sistema</dt>
                          <dd>
                            {resumoGrupo.data.sistema ??
                              (resumoGrupo.data.temSistema ? "Indisponível" : "Não vinculado")}
                          </dd>
                        </div>
                      </dl>
                    )}
                    <section className="rounded-lg border border-line bg-paper p-3">
                      <h3 className="mb-2 text-body font-semibold text-ink">Histórico do Grupo</h3>
                      <HistoricoGrupo userId={usuario} clienteId={clienteId} grupoId={detalhe.id} />
                    </section>
                    <PlanosDoAlvo
                      userId={usuario}
                      clienteId={clienteId}
                      tipo="grupo"
                      id={detalhe.id}
                    />
                    <PendenciasDoAlvo
                      userId={usuario}
                      clienteId={clienteId}
                      tipo="grupo"
                      id={detalhe.id}
                    />
                  </>
                )}
                <Button
                  onClick={() => {
                    navegar(detalhe);
                  }}
                >
                  Navegar neste contexto
                </Button>
              </RecursosNaoAtivadosGrupo>
            </div>
          </Modal>
        ))}
    </section>
  );
}

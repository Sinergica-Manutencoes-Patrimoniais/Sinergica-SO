import { ConfirmDialog, Modal as ModalPrimitivo } from "@sinergica/ui";
import { Boxes, Layers, Link2, Pencil, Plus, RefreshCw, Trash2, Wrench } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { useAuth } from "../../../app/auth-context";
import { usePermissoes } from "../../../app/permissoes-context";
import {
  criarEquipamento,
  desativarEquipamento,
  editarEquipamento,
  listarClientesEquipamento,
  listarEquipamentos,
  obterContextoItem,
} from "../application/equipamentos";
import { EquipamentoModal } from "../components/EquipamentoModal";
import type {
  EquipamentoClienteOpcao,
  EquipamentoFormData,
  EquipamentoItem,
  ItemContexto,
  ItemTipo,
} from "../domain/equipamentos";
import { supabaseEquipamentosAdapter } from "../infrastructure/supabase-equipamentos-adapter";

type Estado =
  | { fase: "carregando" }
  | { fase: "erro"; mensagem: string }
  | { fase: "pronto"; equipamentos: EquipamentoItem[]; clientes: EquipamentoClienteOpcao[] };

type Modal =
  | { modo: "novo"; equipamento?: undefined }
  | { modo: "editar"; equipamento: EquipamentoItem }
  | null;

type FiltroTipo = "todos" | ItemTipo;

export function EquipamentosPage() {
  const { user } = useAuth();
  const { carregando: permissoesCarregando, podeAcessar } = usePermissoes();
  const [estado, setEstado] = useState<Estado>({ fase: "carregando" });
  const [modal, setModal] = useState<Modal>(null);
  const [erroAcao, setErroAcao] = useState<string | null>(null);
  const [imagemAmpliada, setImagemAmpliada] = useState<string | null>(null);
  const [filtroTipo, setFiltroTipo] = useState<FiltroTipo>("todos");
  const [itemDetalheId, setItemDetalheId] = useState<string | null>(null);
  const [desativarInfo, setDesativarInfo] = useState<{
    equipamento: EquipamentoItem;
    possuiOs: boolean;
  } | null>(null);

  const temLeitura = podeAcessar("pcm", "leitura");
  const temEscrita = podeAcessar("pcm", "escrita");

  const carregar = useCallback(async () => {
    setEstado({ fase: "carregando" });
    try {
      const [equipamentos, clientes] = await Promise.all([
        listarEquipamentos(supabaseEquipamentosAdapter),
        listarClientesEquipamento(supabaseEquipamentosAdapter),
      ]);
      setEstado({ fase: "pronto", equipamentos, clientes });
    } catch (error) {
      setEstado({
        fase: "erro",
        mensagem:
          error instanceof Error ? error.message : "Não foi possível carregar equipamentos.",
      });
    }
  }, []);

  useEffect(() => {
    if (!permissoesCarregando && temLeitura) carregar();
  }, [permissoesCarregando, temLeitura, carregar]);

  async function salvar(input: EquipamentoFormData) {
    if (!user) return;
    setErroAcao(null);
    if (modal?.modo === "editar") {
      await editarEquipamento(supabaseEquipamentosAdapter, {
        ...input,
        id: modal.equipamento.id,
        userId: user.id,
      });
    } else {
      await criarEquipamento(supabaseEquipamentosAdapter, { ...input, userId: user.id });
    }
    setModal(null);
    await carregar();
  }

  async function abrirConfirmacaoDesativar(equipamento: EquipamentoItem) {
    if (!user) return;
    setErroAcao(null);
    try {
      const possuiOs = await supabaseEquipamentosAdapter.possuiOsAberta(equipamento.id);
      setDesativarInfo({ equipamento, possuiOs });
    } catch (error) {
      setErroAcao(
        error instanceof Error ? error.message : "Não foi possível verificar OS vinculadas.",
      );
    }
  }

  async function desativar() {
    if (!user || !desativarInfo) return;
    await desativarEquipamento(supabaseEquipamentosAdapter, {
      id: desativarInfo.equipamento.id,
      userId: user.id,
    });
    await carregar();
  }

  if (permissoesCarregando)
    return <div className="p-8 text-center text-body text-ink-3">Carregando…</div>;
  if (!temLeitura) {
    return (
      <div className="p-12 text-center">
        <h2 className="text-lg font-semibold text-ink-2">Acesso restrito</h2>
        <p className="mt-1 text-body text-ink-3">
          Você não tem permissão de leitura no módulo PCM.
        </p>
      </div>
    );
  }
  if (estado.fase === "carregando")
    return <div className="p-8 text-center text-body text-ink-3">Carregando…</div>;
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

  return (
    <div className="flex flex-col gap-4">
      <section className="rounded-lg border border-line bg-card p-4 shadow-raised">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h1 className="text-heading font-semibold text-ink">Equipamentos</h1>
            <p className="mt-0.5 text-body text-ink-3">
              Cadastro PCM sincronizado com equipamentos operacionais do Auvo
            </p>
          </div>
          {temEscrita && (
            <button
              type="button"
              onClick={() => setModal({ modo: "novo" })}
              className="inline-flex h-9 items-center justify-center gap-2 rounded-md bg-orange px-3 text-body font-semibold text-white hover:bg-orange-deep"
            >
              <Plus className="h-4 w-4" />
              Novo equipamento
            </button>
          )}
        </div>
        {erroAcao && (
          <div className="mt-3 rounded-md border border-danger-line bg-danger-soft px-3 py-2 text-body text-danger">
            {erroAcao}
          </div>
        )}
        {/* AC-4: filtro por tipo (equipamento|componente) */}
        <div className="mt-3 flex gap-1.5">
          {(["todos", "equipamento", "componente"] as FiltroTipo[]).map((tipo) => (
            <button
              key={tipo}
              type="button"
              onClick={() => setFiltroTipo(tipo)}
              className={`rounded-full px-3 py-1 text-caption font-semibold ${
                filtroTipo === tipo
                  ? "bg-navy text-white"
                  : "border border-line text-ink-2 hover:bg-line-soft"
              }`}
            >
              {tipo === "todos" ? "Todos" : tipo === "equipamento" ? "Equipamentos" : "Componentes"}
            </button>
          ))}
        </div>
      </section>

      {estado.equipamentos.length === 0 ? (
        <div className="rounded-lg border border-line bg-card px-5 py-10 text-center">
          <Wrench className="mx-auto h-9 w-9 text-ink-3" />
          <p className="mt-3 text-body text-ink-3">Nenhum equipamento cadastrado.</p>
        </div>
      ) : (
        <section className="rounded-lg border border-line bg-card overflow-hidden">
          <div className="divide-y divide-line-soft">
            {estado.equipamentos
              .filter((equipamento) => filtroTipo === "todos" || equipamento.tipo === filtroTipo)
              .map((equipamento) => (
                <EquipamentoLinha
                  key={equipamento.id}
                  equipamento={equipamento}
                  onEditar={
                    temEscrita ? () => setModal({ modo: "editar", equipamento }) : undefined
                  }
                  onDesativar={
                    temEscrita && equipamento.ativo
                      ? () => abrirConfirmacaoDesativar(equipamento)
                      : undefined
                  }
                  onAmpliarImagem={setImagemAmpliada}
                  onVerDetalhe={() => setItemDetalheId(equipamento.id)}
                />
              ))}
          </div>
        </section>
      )}

      {modal && (
        <EquipamentoModal
          equipamento={modal.modo === "editar" ? modal.equipamento : undefined}
          clientes={estado.clientes}
          equipamentosDisponiveis={estado.equipamentos}
          onCancel={() => setModal(null)}
          onSalvar={salvar}
        />
      )}

      {itemDetalheId && (
        <ItemDetalheModal itemId={itemDetalheId} onFechar={() => setItemDetalheId(null)} />
      )}

      <ModalPrimitivo
        open={imagemAmpliada !== null}
        onOpenChange={(aberto) => {
          if (!aberto) setImagemAmpliada(null);
        }}
        titulo="Imagem do equipamento"
        tamanho="lg"
      >
        {imagemAmpliada && (
          <img
            src={imagemAmpliada}
            alt="Equipamento ampliado"
            className="max-h-[75vh] w-full rounded-lg object-contain"
          />
        )}
      </ModalPrimitivo>

      <ConfirmDialog
        open={desativarInfo !== null}
        onOpenChange={(aberto) => {
          if (!aberto) setDesativarInfo(null);
        }}
        titulo={`Desativar "${desativarInfo?.equipamento.nome}"`}
        descricao={
          desativarInfo?.possuiOs
            ? "Há vínculo com OS; o histórico será preservado."
            : "Esta ação não pode ser desfeita."
        }
        rotuloConfirmar="Desativar"
        onConfirmar={desativar}
      />
    </div>
  );
}

function EquipamentoLinha({
  equipamento,
  onEditar,
  onDesativar,
  onAmpliarImagem,
  onVerDetalhe,
}: {
  equipamento: EquipamentoItem;
  onEditar?: () => void;
  onDesativar?: () => void;
  onAmpliarImagem: (url: string) => void;
  onVerDetalhe: () => void;
}) {
  return (
    <div className="flex items-center gap-3 px-3 py-2.5">
      {equipamento.urlImagem ? (
        <button
          type="button"
          onClick={() => onAmpliarImagem(equipamento.urlImagem as string)}
          className="h-9 w-9 shrink-0 overflow-hidden rounded-md border border-line"
        >
          <img
            src={equipamento.urlImagem}
            alt={equipamento.nome}
            className="h-full w-full object-cover"
          />
        </button>
      ) : (
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md border border-line bg-line-soft">
          <Wrench className="h-4 w-4 text-ink-3" />
        </div>
      )}

      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
          <span className="truncate text-body font-semibold text-ink">{equipamento.nome}</span>
          <span
            className={`shrink-0 rounded-full px-1.5 py-0.5 text-micro font-semibold ${equipamento.ativo ? "bg-success-soft text-success" : "bg-line-soft text-ink-2"}`}
          >
            {equipamento.ativo ? "Ativo" : "Inativo"}
          </span>
          <span className="shrink-0 rounded-full bg-line-soft px-1.5 py-0.5 text-micro font-semibold text-ink-2">
            {equipamento.tipo === "componente" ? "Componente" : "Equipamento"}
          </span>
        </div>
        <p className="truncate text-caption text-ink-3">
          {equipamento.categoria ?? "Sem categoria"} · {equipamento.clienteNome ?? "sem vínculo"}
          {equipamento.localizacao ? ` · ${equipamento.localizacao}` : ""}
          {equipamento.auvoSyncError ? ` · erro: ${equipamento.auvoSyncError}` : ""}
        </p>
      </div>

      <button
        type="button"
        onClick={onVerDetalhe}
        className="inline-flex h-8 shrink-0 items-center justify-center gap-1.5 rounded-md border border-line px-2.5 text-caption font-semibold text-ink-2 hover:bg-line-soft"
      >
        <Layers className="h-3.5 w-3.5" />
        Detalhe
      </button>

      {onEditar && (
        <button
          type="button"
          onClick={onEditar}
          className="inline-flex h-8 shrink-0 items-center justify-center gap-1.5 rounded-md border border-line px-2.5 text-caption font-semibold text-ink-2 hover:bg-line-soft"
        >
          <Pencil className="h-3.5 w-3.5" />
          Editar
        </button>
      )}
      {onDesativar && (
        <button
          type="button"
          onClick={onDesativar}
          className="inline-flex h-8 shrink-0 items-center justify-center gap-1.5 rounded-md border border-danger-line px-2.5 text-caption font-semibold text-danger hover:bg-danger-soft"
        >
          <Trash2 className="h-3.5 w-3.5" />
          Desativar
        </button>
      )}
    </div>
  );
}

/** AC-6 — Detalhe do Item: breadcrumb Cliente>Área>Local + chips de Sistema + componentes
 * filhos aninhados sob o Equipamento pai. */
function ItemDetalheModal({ itemId, onFechar }: { itemId: string; onFechar: () => void }) {
  const [contexto, setContexto] = useState<ItemContexto | null | "carregando">("carregando");

  useEffect(() => {
    setContexto("carregando");
    obterContextoItem(supabaseEquipamentosAdapter, itemId).then(setContexto);
  }, [itemId]);

  return (
    <ModalPrimitivo
      open
      onOpenChange={(aberto) => {
        if (!aberto) onFechar();
      }}
      titulo="Detalhe do Item"
    >
      <div className="flex max-h-[70vh] flex-col gap-4 overflow-y-auto">
        {contexto === "carregando" ? (
          <p className="text-body text-ink-3">Carregando…</p>
        ) : contexto === null ? (
          <p className="text-body text-ink-3">Item não encontrado.</p>
        ) : (
          <>
            <div>
              <h4 className="text-lg font-semibold text-ink">{contexto.item.nome}</h4>
              {/* AC-6: breadcrumb Cliente > Área > Local */}
              <p className="mt-1 text-body text-ink-3" data-testid="item-breadcrumb">
                {contexto.breadcrumb
                  ? [
                      contexto.breadcrumb.clienteNome,
                      contexto.breadcrumb.areaNome,
                      contexto.breadcrumb.localNome,
                    ]
                      .filter(Boolean)
                      .join(" > ")
                  : "Sem instalação definida (Local não atribuído)."}
              </p>
            </div>

            <div>
              <h5 className="mb-1.5 text-caption font-semibold uppercase tracking-wider text-ink-3">
                Faz parte de
              </h5>
              {contexto.sistemas.length === 0 ? (
                <p className="text-body text-ink-3">Nenhum Sistema.</p>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {contexto.sistemas.map((sistema) => (
                    <span
                      key={sistema.id}
                      className="inline-flex items-center gap-1.5 rounded-full bg-orange-soft px-3 py-1 text-caption font-semibold text-orange-deep"
                    >
                      <Link2 className="h-3 w-3" />
                      {sistema.nome}
                      {sistema.codigo ? ` · ${sistema.codigo}` : ""}
                    </span>
                  ))}
                </div>
              )}
            </div>

            {contexto.componentesFilhos.length > 0 && (
              <div>
                <h5 className="mb-1.5 text-caption font-semibold uppercase tracking-wider text-ink-3">
                  Componentes
                </h5>
                <div className="flex flex-col gap-1.5">
                  {contexto.componentesFilhos.map((componente) => (
                    <div
                      key={componente.id}
                      className="flex items-center gap-2 rounded-md border border-line px-3 py-2 text-body text-ink-2"
                    >
                      <Boxes className="h-3.5 w-3.5 text-ink-3" />
                      {componente.nome}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </ModalPrimitivo>
  );
}

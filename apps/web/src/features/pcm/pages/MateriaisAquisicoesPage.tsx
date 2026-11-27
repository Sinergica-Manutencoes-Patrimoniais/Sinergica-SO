import { Button, ConfirmDialog } from "@sinergica/ui";
import { useState } from "react";
import {
  type MateriaisClientesGateway,
  useClientesMateriais,
} from "../application/materiais-clientes-queries";
import { supabaseMateriaisClientesAdapter } from "../infrastructure/supabase-materiais-clientes-adapter";
import { CentralMateriais } from "../interfaces/listas-materiais/Central";
type Props = {
  usuario: string;
  gateway?: MateriaisClientesGateway;
  onAbrirOs?: (cliente: string, os: string) => void;
};
export function MateriaisAquisicoesPage(props: Props) {
  return <Conteudo key={props.usuario} {...props} />;
}
function Conteudo({ usuario, gateway = supabaseMateriaisClientesAdapter, onAbrirOs }: Props) {
  const [cliente, setCliente] = useState("");
  const [temRascunho, setTemRascunho] = useState(false);
  const [proximoCliente, setProximoCliente] = useState<string | null>(null);
  const consulta = useClientesMateriais(gateway, usuario);
  const disponivel = !consulta.isFetching && !consulta.isError;
  const selecionado = consulta.data?.some((c) => c.id === cliente);
  return (
    <section className="space-y-4">
      <header>
        <h1 className="text-heading font-semibold text-ink">Materiais e Aquisições</h1>
        <p className="text-body text-ink-3">
          Listas, disponibilidade, exceções e orçamentos das OS, reunidos por Cliente.
        </p>
      </header>
      <label className="flex max-w-lg flex-col gap-1 text-body">
        Cliente dos materiais
        <select
          className="input"
          value={cliente}
          onChange={(e) => {
            if (selecionado && temRascunho) setProximoCliente(e.target.value);
            else {
              setTemRascunho(false);
              setCliente(e.target.value);
            }
          }}
          disabled={!disponivel}
        >
          <option value="">Selecione um Cliente</option>
          {consulta.data?.map((c) => (
            <option key={c.id} value={c.id}>
              {c.nome}
            </option>
          ))}
        </select>
      </label>
      {consulta.isPending && <output>Carregando Clientes…</output>}
      {consulta.isError && (
        <p role="alert">
          Não foi possível consultar Clientes.{" "}
          <Button onClick={() => void consulta.refetch()}>Tentar novamente</Button>
        </p>
      )}
      {disponivel && consulta.data?.length === 0 && (
        <p>Nenhum Cliente disponível para este acesso.</p>
      )}
      {disponivel && !selecionado && Boolean(consulta.data?.length) && (
        <p>Selecione um Cliente para consultar materiais e aquisições.</p>
      )}
      {selecionado && (
        <CentralMateriais
          key={`${usuario}:${cliente}`}
          usuario={usuario}
          cliente={cliente}
          onRascunhoAlterado={setTemRascunho}
          onAbrirOs={onAbrirOs ? (os) => onAbrirOs(cliente, os) : undefined}
        />
      )}
      <ConfirmDialog
        open={proximoCliente !== null}
        onOpenChange={(open) => {
          if (!open) setProximoCliente(null);
        }}
        titulo="Descartar rascunho de materiais?"
        descricao="O texto de materiais ainda não foi salvo. Ao trocar de Cliente, você perderá este rascunho."
        rotuloConfirmar="Descartar e trocar cliente"
        onConfirmar={async () => {
          if (proximoCliente === null) return;
          setTemRascunho(false);
          setCliente(proximoCliente);
        }}
      />
    </section>
  );
}

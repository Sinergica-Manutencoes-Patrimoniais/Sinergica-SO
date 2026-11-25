import { Button } from "@sinergica/ui";
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
  const consulta = useClientesMateriais(gateway, usuario);
  const disponivel = !consulta.isFetching && !consulta.isError;
  const selecionado = disponivel && consulta.data?.some((c) => c.id === cliente);
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
          onChange={(e) => setCliente(e.target.value)}
          disabled={!disponivel}
        >
          <option value="">Selecione um Cliente</option>
          {disponivel &&
            consulta.data?.map((c) => (
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
          onAbrirOs={onAbrirOs ? (os) => onAbrirOs(cliente, os) : undefined}
        />
      )}
    </section>
  );
}

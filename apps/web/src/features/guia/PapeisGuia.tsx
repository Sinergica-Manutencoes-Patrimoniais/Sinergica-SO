import { GuiaTitulo, ListaFuncoes, Secao } from "./GuiaUi";

export function PapeisGuia() {
  return (
    <div className="page-stack">
      <GuiaTitulo
        titulo="Papéis e permissões"
        subtitulo="Quem vê o quê, e quem pode editar o quê."
      />

      <Secao titulo="Os 4 papéis do sistema">
        <ListaFuncoes
          itens={[
            {
              nome: "Superadmin",
              descricao:
                "Acesso total — todos os módulos, mais Configurações (gerenciar grupos de permissão e usuários). É quem decide o que cada colaborador enxerga.",
            },
            {
              nome: "Supervisor",
              descricao:
                "Acesso operacional amplo, também pode gerenciar grupos e usuários em Configurações.",
            },
            {
              nome: "Colaborador",
              descricao:
                "Acesso módulo por módulo, conforme o grupo de permissão atribuído — pode ter só leitura (consulta) ou leitura + escrita (também cria/edita) em cada módulo.",
            },
            {
              nome: "Cliente-síndico",
              descricao:
                "Papel de fora da empresa — só acessa o portal da Área do Cliente, e só vê o próprio condomínio. Nunca enxerga custo interno, margem ou dado de outro cliente.",
            },
          ]}
        />
      </Secao>

      <Secao titulo="Grupos de permissão">
        <p>
          Em vez de configurar permissão pessoa por pessoa, o superadmin/supervisor cria{" "}
          <strong className="text-ink">grupos</strong> (ex.: "Técnico de campo", "Financeiro") com o
          nível de acesso certo em cada módulo, e atribui os usuários ao grupo. Isso fica em{" "}
          <strong className="text-ink">Configurações → Grupos</strong>.
        </p>
        <p>
          Se um módulo não aparece na sua barra de navegação, é porque seu usuário/grupo não tem
          permissão nele — não é bug, é o sistema funcionando como deveria.
        </p>
      </Secao>
    </div>
  );
}

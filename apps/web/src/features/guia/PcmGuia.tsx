import { Callout, GuiaTitulo, ListaFuncoes, Secao, StatusModulo } from "./GuiaUi";

export function PcmGuia() {
  return (
    <div className="page-stack">
      <GuiaTitulo
        titulo="PCM · Operação"
        subtitulo="Planejamento e Controle de Manutenção — o núcleo do sistema."
      />
      <StatusModulo status="real" />

      <Secao titulo="Pra que serve">
        <p>
          É onde toda manutenção nasce, é priorizada, planejada e acompanhada até o fim. Se existe
          um problema num condomínio, uma visita preventiva pra fazer ou um laudo pra emitir, o
          registro mora aqui — o PCM decide o quê, quando e pra quem; o técnico executa em campo
          pelo aplicativo Auvo, e o resultado volta pro PCM automaticamente.
        </p>
      </Secao>

      <Secao titulo="Como ajuda no dia a dia">
        <p>
          Sem o PCM, saber quantas manutenções estão pendentes, quais são urgentes e qual técnico
          está livre dependia de perguntar ou olhar planilha. Com ele, o dashboard mostra na hora
          quantas Ordens de Serviço estão abertas, em execução, atrasadas ou críticas — e o Backlog
          GUT já ordena o que resolver primeiro, sem depender de achismo.
        </p>
      </Secao>

      <Secao titulo="Principais telas">
        <ListaFuncoes
          itens={[
            {
              nome: "Operação — Chamados e OS",
              descricao:
                "É o board único do trabalho: um Chamado nasce na Solicitação e evolui para OS, backlog ou planejamento. Use Lista, Kanban, linha do tempo e calendário para decidir o próximo passo; o card concentra cliente, local, técnico, histórico e Anotações internas.",
            },
            {
              nome: "Aba Backlog GUT",
              descricao:
                "Dentro de Operação, ordena o que aguarda decisão pela prioridade GUT. Use para promover primeiro os itens que têm maior impacto, em vez de tratar a fila por ordem de chegada.",
            },
            {
              nome: "Inspeções e Laudo SPDA",
              descricao:
                "Vistorias técnicas completas de um condomínio — cada item vira automaticamente um item de backlog se achar problema. O Laudo SPDA (proteção contra descarga atmosférica, exigido por norma) é gerado com apoio de IA a partir da inspeção.",
            },
            {
              nome: "Ferramentas",
              descricao:
                "Controle por unidade, código e estado, com histórico de movimentações, reservas, kits e visão de quais ferramentas estão com cada técnico.",
            },
            {
              nome: "Chamados",
              descricao:
                "Solicitações recebidas pelo Atendimento, Portal ou cadastro interno. Registre contexto e Anotações; depois mova para backlog ou gere a OS sem perder o histórico do Chamado.",
            },
            {
              nome: "Saúde Auvo",
              descricao:
                "Mostra se a troca com o aplicativo de campo está saudável. Abra o detalhamento quando houver erro de sync para decidir se reprocessa ou corrige o vínculo local antes de afetar a execução.",
            },
            {
              nome: "Cadastros",
              descricao:
                "A base de tudo: Clientes, Equipamentos, Sistemas, Tipos de Tarefa, Equipes, Funcionários, grupos, marcações e tipos de inspeção. Cadastro correto evita OS sem contexto e relatório incompleto.",
            },
          ]}
        />
      </Secao>

      <Callout titulo="Roteiro rápido de decisão">
        <p>
          Comece pelo cockpit para enxergar OS de hoje, pessoas livres e pendências. Trate Chamados
          na Solicitação, priorize a aba Backlog GUT, planeje técnico e data, e acompanhe a execução
          pelo Auvo. Antes de encerrar o dia, consulte os relatórios para validar o que foi
          entregue.
        </p>
      </Callout>

      <Secao titulo="Como se conecta com o resto">
        <p>
          O PCM alimenta o <strong className="text-ink">Financeiro</strong> (custo real de cada OS
          vira insumo de rentabilidade), o <strong className="text-ink">Atendimento</strong> (o Zé
          abre OS a partir de uma conversa de WhatsApp) e a{" "}
          <strong className="text-ink">Área do Cliente</strong> (o síndico vê o andamento das OS do
          próprio condomínio).
        </p>
      </Secao>
    </div>
  );
}

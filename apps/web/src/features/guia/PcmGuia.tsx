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
              nome: "Ordens de Serviço (OS)",
              descricao:
                "O trabalho em si — corretiva, preventiva, inspeção. Nasce de um chamado do cliente (via Zé no WhatsApp), de um cadastro manual, de uma inspeção que achou problema, ou automaticamente do preventivo. Tem 4 formas de visualizar: lista, Kanban (arrasta o card entre colunas pra mudar o status), linha do tempo e calendário.",
            },
            {
              nome: "Backlog GUT",
              descricao:
                "Lista de tudo que está pendente, ordenada por um cálculo de prioridade (Gravidade × Urgência × Tendência). Mostra o que precisa de atenção primeiro sem precisar adivinhar.",
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
                "Solicitações do cliente recebidas pelo Atendimento, portal ou cadastro interno. O chamado concentra contexto antes de virar backlog ou Ordem de Serviço.",
            },
            {
              nome: "Cadastros",
              descricao:
                "A base de tudo: Clientes, Equipamentos, Sistemas, Tipos de Tarefa, Equipes, Funcionários, grupos, marcações e tipos de inspeção. Cadastro correto evita OS sem contexto e relatório incompleto.",
            },
          ]}
        />
      </Secao>

      <Callout titulo="Próxima evolução — histórico automático de contato do cliente">
        <p>
          Ideia registrada pra evoluir os Chamados: hoje o histórico de um cliente com a Sinérgica
          fica espalhado — e-mail, WhatsApp, ligação. A visão é que, quando um cliente mandar um
          e-mail pra um canal da empresa ou uma mensagem no WhatsApp, o sistema registre
          automaticamente um chamado pra aquele contato — mesmo que ainda não vire uma OS. Assim
          existe um histórico completo de tudo que o cliente já falou com a Sinérgica, buscável e
          nunca perdido, mesmo antes de uma OS ser aberta.
        </p>
        <p className="text-xs text-ink-3">
          Ainda não implementado — fica registrado aqui como próximo passo de produto pro módulo de
          Chamados/Atendimento.
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

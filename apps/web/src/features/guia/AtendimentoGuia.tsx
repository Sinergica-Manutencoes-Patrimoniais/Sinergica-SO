import { Callout, GuiaTitulo, ListaFuncoes, Secao, StatusModulo } from "./GuiaUi";

export function AtendimentoGuia() {
  return (
    <div className="page-stack">
      <GuiaTitulo
        titulo="Atendimento · Zé"
        subtitulo="Agente de IA que atende o cliente no WhatsApp, 24 horas por dia."
      />
      <StatusModulo status="real" />

      <Secao titulo="Pra que serve">
        <p>
          O Zé é o agente de inteligência artificial que conversa com o cliente pelo WhatsApp da
          Sinérgica. Ele entende o que o cliente precisa, responde dúvidas comuns e — quando é o
          caso — abre uma Ordem de Serviço no PCM sozinho, sem precisar que alguém do escritório
          esteja disponível naquele momento.
        </p>
      </Secao>

      <Secao titulo="Como ajuda no dia a dia">
        <p>
          Antes, um chamado fora do horário comercial só era tratado no dia seguinte. Com o Zé, o
          cliente é atendido na hora, mesmo de madrugada ou fim de semana — e se for algo que já dá
          pra virar OS direto, ela já nasce registrada, sem esperar alguém digitar.
        </p>
      </Secao>

      <Secao titulo="Principais telas">
        <ListaFuncoes
          itens={[
            {
              nome: "Dashboard",
              descricao:
                "Métricas do atendimento: quantos chamados hoje, quantos pendentes, tempo de resposta.",
            },
            {
              nome: "Inbox",
              descricao:
                "Conversas em andamento, com histórico, cliente vinculado e contexto do agente. Quando necessário, use o handoff para um atendente humano assumir e depois devolver ao agente.",
            },
            {
              nome: "Config",
              descricao:
                "Configura canais, instâncias Evolution, agentes, base de conhecimento, regras, operação e IA. Cada instância pode usar agente e conhecimento próprios, mesmo compartilhando o mesmo servidor Evolution.",
            },
          ]}
        />
      </Secao>

      <Callout titulo="Se conecta com PCM e Comercial">
        <p>
          Quando o Zé identifica manutenção, cria chamado/OS no PCM conforme o fluxo. O contato pode
          ser vinculado ao cadastro do cliente no CRM, preservando histórico. O atendente humano
          assume casos sensíveis sem perder contexto; oportunidades comerciais ficam preparadas para
          o módulo Comercial.
        </p>
      </Callout>
    </div>
  );
}

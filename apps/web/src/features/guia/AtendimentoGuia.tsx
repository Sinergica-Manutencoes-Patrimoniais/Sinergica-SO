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
          caso — abre um Chamado no PCM com o contexto da conversa, sem precisar que alguém do
          escritório esteja disponível naquele momento.
        </p>
      </Secao>

      <Secao titulo="Como ajuda no dia a dia">
        <p>
          Antes, um chamado fora do horário comercial só era tratado no dia seguinte. Com o Zé, o
          cliente é atendido na hora, mesmo de madrugada ou fim de semana — e se for algo que já dá
          pra virar manutenção, o Chamado já nasce registrado e a equipe decide no board se vira
          backlog ou OS, sem redigitar a conversa.
        </p>
      </Secao>

      <Secao titulo="Principais telas">
        <ListaFuncoes
          itens={[
            {
              nome: "Dashboard",
              descricao:
                "Mostra volume, pendências e tempo de resposta. Abra no começo do turno para decidir onde há risco de demora e se a equipe precisa assumir conversas.",
            },
            {
              nome: "Inbox",
              descricao:
                "Central de conversas com cliente vinculado e contexto do agente. Use o handoff para um atendente humano assumir casos sensíveis e devolver ao Zé quando a exceção acabar.",
            },
            {
              nome: "Config",
              descricao:
                "Configura canais, instâncias Evolution, agentes, conhecimento, regras e IA. Ajuste aqui antes de liberar um canal novo; cada instância pode ter agente e conhecimento próprios.",
            },
          ]}
        />
      </Secao>

      <Callout titulo="Se conecta com PCM e Comercial">
        <p>
          Quando o Zé identifica manutenção, cria o Chamado no PCM conforme o fluxo. O contato pode
          ser vinculado ao cadastro do cliente no CRM, preservando histórico. O atendente humano
          assume casos sensíveis sem perder contexto; quando o Zé identifica uma oportunidade
          comercial na conversa, ela já cai automaticamente no Funil do módulo Comercial, na etapa
          configurada pra receber lead do agente — sem precisar recadastrar nada.
        </p>
      </Callout>
    </div>
  );
}

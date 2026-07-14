import { Callout, GuiaTitulo, Secao } from "./GuiaUi";

export function VisaoGeralGuia() {
  return (
    <div className="page-stack">
      <GuiaTitulo
        titulo="O que é o Sinérgica SO"
        subtitulo="Guia rápido pra quem está começando a usar o sistema."
      />

      <Secao titulo="Pra que serve">
        <p>
          O Sinérgica SO é o sistema operacional da Sinérgica Manutenções — o lugar único onde a
          empresa toda registra, acompanha e decide o trabalho do dia a dia. Antes dele, informação
          ficava espalhada em planilhas, WhatsApp e memória de quem executava. Agora cada módulo
          cobre uma frente da operação (manutenção, atendimento ao cliente, comercial, financeiro,
          marketing) e todos compartilham a mesma base de dados — o que acontece numa OS aparece na
          rentabilidade do cliente, o que o Zé responde no WhatsApp vira histórico do contato, e
          assim por diante.
        </p>
      </Secao>

      <Secao titulo="Como o sistema é organizado">
        <p>
          No topo da tela ficam as abas dos módulos — cada uma é uma frente diferente do negócio. Do
          lado esquerdo, dentro de cada módulo, fica a navegação das telas específicas daquele
          módulo (por exemplo, dentro de PCM tem Ordens de Serviço, Backlog, Ferramentas...).
        </p>
        <p>
          <strong className="text-ink">PCM (Planejamento e Controle de Manutenção)</strong> é o
          coração do sistema — é lá que toda Ordem de Serviço nasce e é decidida. O aplicativo
          <strong className="text-ink"> Auvo</strong> continua sendo usado pelos técnicos em campo
          (check-in, fotos, assinatura) — o PCM não substitui o Auvo, ele decide o que vira trabalho
          e acompanha o que já foi feito, sincronizando os dois automaticamente.
        </p>
      </Secao>

      <Secao titulo="Quem pode ver e fazer o quê">
        <p>Cada pessoa tem um papel, e o papel define o que ela enxerga no sistema:</p>
        <ul className="list-disc pl-5">
          <li>
            <strong className="text-ink">Superadmin</strong> — acesso total, inclusive configurações
            e gestão de usuários.
          </li>
          <li>
            <strong className="text-ink">Supervisor</strong> — acesso operacional amplo, pode
            gerenciar grupos e usuários.
          </li>
          <li>
            <strong className="text-ink">Colaborador</strong> — acesso ao que o cargo exige, módulo
            por módulo (leitura ou leitura+escrita).
          </li>
          <li>
            <strong className="text-ink">Cliente-síndico</strong> — só enxerga o portal da Área do
            Cliente, e só o que é do próprio condomínio (nunca custo interno ou dado de outro
            cliente).
          </li>
        </ul>
        <p>
          Se uma aba não aparece pra você, é porque seu usuário não tem permissão naquele módulo —
          fale com quem administra o sistema.
        </p>
      </Secao>

      <Callout titulo="Nem tudo está pronto ainda">
        <p>
          O sistema está sendo construído por partes. Alguns módulos já rodam com dado real todo dia
          (PCM, Atendimento); outros têm um protótipo navegável pra dar ideia de como vai ficar
          antes de valer a pena construir de verdade (Financeiro); e outros ainda são só plano
          (Comercial, Marketing, Cockpit, Área do Cliente). Cada página deste guia diz claramente em
          qual desses três estados o módulo está.
        </p>
      </Callout>
    </div>
  );
}

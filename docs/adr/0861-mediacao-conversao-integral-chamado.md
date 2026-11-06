---
name: "docs-adr-0861-mediacao-conversao-integral-chamado-md"
description: "Documento Sinérgica SO: ADR 0861 — Fronteira da conversão integral"
alwaysApply: false
---

# ADR 0861 — Fronteira da conversão integral

A interface não deve acessar o núcleo privado 1047. Uma RPC de mediação possui gate privado independente, inicialmente fechado, verifica sessão, permissão por Cliente, isolamento e lock de autorização, e delega a ele sem conceder EXECUTE no núcleo. O gate principal e as barreiras legadas continuam obrigatórios. Não há fallback automático para o caminho antigo depois de erro incerto.

O adaptador deve enviar a identidade estável, revisão, destino, status de Hub e todos os campos; não regenerar IDs nem tratar indisponibilidade como autorização para uma segunda criação. A inclusão da RPC não comprova integração da interface nem compatibilidade de consumidores. Enquanto faltarem conciliação de números, testes integrados e concorrência, CI e revisão adversarial, ambos os gates permanecem fechados e não há rollout.

Rollback operacional: fechar a flag e o gate de mediação. Isso não apaga OS ou altera referências existentes; efeitos externos continuam fora de escopo de testes e implantação.

Provas sintéticas: 4/4 para ACL e gate, inclusive chamada como `authenticated`; 20/20 no clone para mediação, payload, retry, duas OS, negação por Cliente e rollback após falha. No segundo ensaio, gates foram abertos e restrições removidas somente em transação revertida, com anti-sync. Teste do adapter serializa o objeto para JSON e verifica os 20 campos, inclusive nulls explícitos. Não há teste HTTP ponta a ponta; a interface existente não usa este adapter e não preserva ainda identidade durável para retry.

A remoção futura do trigger de numeração ainda não é segura: a adaptação de escritores em ADR-0864 não comprova todos os caminhos ou consumidores implantados. Formato `CH…-OS-UUID`, concorrência, autorização revogável, CI e revisão adversarial permanecem pendentes. Não abrir gates.

Foi preparada interface experimental em flag separada e desligada por padrão, com pedido persistido em `sessionStorage` por usuário, Cliente e Chamado, sem fallback automático. A interface reutiliza o formulário legado de conversão do Chamado e preserva tipo de tarefa, técnico, data, GUT e solicitante; esse formulário não oferece equipamento, diferentemente da abertura geral de OS. Quando a flag experimental está ligada, as ações de conversão legadas deste painel ficam ocultas para evitar trilhas concorrentes. A tentativa resiste a recarga da mesma aba, mas não ao encerramento da sessão/aba, nem coordena outras abas; não é persistência durável em todos os cenários. Não ativar antes de resolver política de recuperação após perda de sessão e testar integração real e compatibilidade completa.

# ADR-1035 — Criação concorrente de OS com escopo conferido

Status: preparação local, não aplicada nem testada.

Para atender três comandos independentes simultâneos sem aceitar qualquer revisão obsoleta, a entrada privada segura a linha do Chamado, reconfere a fotografia do escopo e admite atualização de revisão apenas quando cada revisão intermediária aparece exatamente uma vez como resultado de criação de OS do mesmo Cliente e Chamado. Chamado, escopo ou origem alterados por outro caminho geram conflito. O núcleo existente continua a validar autorização, conteúdo, identidade, transação, legado e idempotência; um recibo imutável preserva revisão original e revisão usada para executar, de modo que retry seja idêntico.

A evidência de comandos intermediários precisa ser provada completa e exclusiva para todos os escritores de revisão, incluindo gatilhos legados, remoção/alteração direta de comandos e atualizações revertidas. Hash do escopo não cobre todos os objetos; validar direitos do proprietário, RLS/FORCE, ordem de locks, chamadas antigas, concorrência real nas duas ordens, colisões e compatibilidade de rollout. Gate e execução permanecem fechados; não ativar até prova e revisão adversarial. Nenhuma tarefa Auvo é enviada por esta entrada.

A proteção preparada também torna os recibos existentes de `chamado_os_comandos` imutáveis e considera apenas o protocolo de conversão integral com OS ainda pertencente ao mesmo Chamado e Cliente. A nova restrição afeta todos os consumidores dessa tabela: inventariar manutenção, retenção e reversão antes de aplicá-la; não apagar histórico como rollback.

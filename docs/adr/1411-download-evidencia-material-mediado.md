# ADR-1411 — Download mediado de evidência de materiais

## Decisão

A função de serviço recebe a identidade autenticada pela borda e consulta o caminho privado sem entregá-lo ao navegador. Reutiliza a autorização canônica para aquele usuário e a cadeia de vínculos da evidência. A borda volta a conferir o acesso depois de recuperar os bytes, limita tamanho e aceita somente assinatura JPEG/PNG. Gate desligado.

## Limites

Migration e borda não foram aplicadas nem testadas. A simulação local de claims é restrita ao serviço e precisa de revisão adversarial específica: provar isolamento da transação, papel, revogação e locks, armazenamento privado, resposta perdida, MIME, limites, ACL e RLS/FORCE antes de habilitar. A assinatura não comprova segurança integral do arquivo nem origem do conteúdo.

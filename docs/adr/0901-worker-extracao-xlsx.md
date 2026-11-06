# ADR-0901 — Worker terminável para extração XLSX

Data: 2026-10-30 · Status: preparação, recurso desligado.

A extração do ADR-0900 deve ocorrer em worker dedicado por solicitação, sem chamadas intencionais a rede ou staging; o carregamento dos codecs e a política CSP ainda exigem verificação. A chamada faz cópia limitada da entrada, usa prazo máximo, aceita cancelamento, encerra o worker em sucesso, erro, cancelamento ou timeout e valida o formato e os limites da resposta antes de devolvê-la. Nenhum fallback executa extração na thread principal se worker estiver indisponível. O arquivo original do chamador não é destacado.

Timeout e worker não garantem limite de memória dentro do codec ou do navegador; mantêm-se as validações do ADR-0900, testes de navegador e revisão adversarial. Interpretação XML e confirmação do usuário continuam fora da extração. Sem conexão à interface até conclusão dos gates; não há gravação ou ação externa.

# ADR-0475 — vigência de acesso à exportação local

Status: proposto; não homologado. A exportação já relê a página via RPC com autorização por Cliente. Antes do download, revalida identidade da sessão e a capacidade `integracao.reconciliar` no servidor e verifica novamente a identidade. Qualquer falha aborta a geração do arquivo. A autorização pode mudar após a última verificação; não se afirma atomicidade entre servidor e download local. Gate/flags permanecem desligados; teste de revogação e troca de sessão é obrigatório antes da ativação.

A migration 0701 prepara revalidação sem escrita de um item da fila com capacidade, Cliente e comparação de estado/tentativas da prévia. A origem não tem revisão monotônica: a comparação não detecta valores alterados e revertidos, mudanças não cobertas nem garante que acesso ou estado permaneçam após a resposta. Resultado não autoriza retry ou exportação posterior sem nova autorização.

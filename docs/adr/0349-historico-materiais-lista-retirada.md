# ADR-0349 — Histórico de materiais quando a versão atual foi retirada

Status: proposta; gate fechado e validação pendente.

O Portal descobre identificadores de listas vinculadas à Conta/OS apenas quando há publicação anterior ainda não retirada. A descoberta não revela conteúdo ou metadados da versão atual retirada; leitura de cada versão continua sujeita à checagem individual de autorização e visibilidade da ADR-0346. A lista atual retirada nunca é disponibilizada por este caminho, e versões anteriores retiradas não são exibidas. Escrita de disponibilidade não é habilitada por este histórico. Revisão de privacidade, concorrência de retirada e testes de isolamento são obrigatórios antes da ativação.

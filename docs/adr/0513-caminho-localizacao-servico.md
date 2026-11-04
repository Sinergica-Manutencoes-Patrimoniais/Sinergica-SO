# ADR-0513 — Caminho de anexo apenas ao serviço

O navegador recebe somente bytes pela rota autenticada. A resolução do caminho permanece privada e é executada por função restrita ao service role, com identidade e papel provenientes do token previamente validado pela rota. O comando simula essas claims apenas durante a consulta e revalida permissão e estado do vínculo; rota reexecuta a checagem após download. Chave de serviço permanece no servidor. Gate fechado; revisão de claims, concessões e testes de segurança são pré-requisitos de liberação.

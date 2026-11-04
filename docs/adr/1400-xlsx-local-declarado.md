# ADR-1400 — XLSX extraído localmente como dados declarados

Além da recepção atestada, a interface pode preparar lote manual a partir das linhas extraídas em Worker no navegador. O usuário confirma arquivo, aba, Cliente e origem; erros estruturais bloqueiam o envio. A mesma tentativa usa identificador persistido e o comando existente valida autorização, conteúdo e unicidade no servidor.

A origem `planilha`, o hash e a extração são declarações locais: o servidor não recebe nem autentica os bytes. A funcionalidade não se apresenta como recepção atestada, não aprova nem incorpora cadastro e depende da revisão PCM. Flag inicia desligada. Testes de parser, tamanho, sessão, idempotência, múltiplas abas, permissão, retenção e revisão adversarial são necessários antes de habilitar.

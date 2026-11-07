---
name: "supabase-tests-manual-e01-s165-avaliacao-concorrencia-1726-md"
description: "Documento Sinérgica SO: Concorrencia da avaliacao legada 1726"
alwaysApply: false
---

# Concorrencia da avaliacao legada 1726

Use somente clone descartavel com migrations ate 1726. Nao executa Auvo nem altera 1045. A preparacao confirma dados sinteticos; descarte o clone ao final.

1. Execute `manual_E01-S165_avaliacao_concorrencia_1726_setup.sql` com `psql -v ON_ERROR_STOP=1`; os arquivos `manual_E01-S165_visita_futura_1703_setup.sql` e `manual_E01-S165_impacto_visita_fila_1705.sql` devem estar na mesma pasta.
2. Na sessao A, execute `manual_E01-S165_avaliacao_concorrencia_1726_sessao_a.sql`. Ela substitui a escolha por `integrar_ponte` e espera oito segundos antes de confirmar.
3. Durante a espera, execute `manual_E01-S165_avaliacao_concorrencia_1726_sessao_b.sql` na sessao B. Deve falhar imediatamente com `55P03` na trava do Plano.
4. Depois do commit de A, repita B. Deve retornar `false`: a decisao anterior ja nao e a ultima.

O ensaio cobre apenas decisao primeiro e avaliacao depois; nao comprova todas as corridas nem aprovacao operacional.

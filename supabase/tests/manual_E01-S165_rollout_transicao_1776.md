# Compatibilidade de rollout da transição de Plano 1776

Escopo: mudança de conflito `revisao_obsoleta` de SQLSTATE `40001` para `P0011` em suspensão/encerramento/retomada. Comparação estática entre interface anterior do snapshot `1770c57` e interface atual; 1776 foi compilada e ensaiada em clone separado pela fixture `manual_E01-S165_transicao_conflito_1776.sql`.

* Banco novo + interface anterior: o tratamento anterior conserva o pedido e informa resultado não confirmado diante de `P0011`. Teste Vitest temporário, usando o componente do snapshot e resposta simulada `P0011` na primeira tentativa e após resultado incerto, passou; não oferece recuperação automática da rejeição definitiva.
* Interface nova + banco antigo: `40001` é tratado como resultado incerto e o pedido é preservado; teste `TransicaoPlano1776.test.tsx` cobre essa resposta simulada. Em outros fluxos foi observado retry do PostgREST para `40001`, portanto não se pode assumir resposta rápida aqui; não foi reproduzido HTTP da versão antiga especificamente nesta rota.
* Banco e interface novos: conflito `P0011` com mensagem exata na primeira tentativa permite nova conferência após verificar sessão/pedido; replay incerto e `40001` genuíno permanecem preservados. Fixture SQL e três testes de interface passaram.

Para implantação futura, manter o gate da transição fechado durante a mudança e validar banco 1776 antes da interface atual; reabrir apenas depois das demais validações e autorização operacional. Essa orientação não autoriza deploy nem alterar gates. Tratar qualquer `40001` como rejeição definitiva pode perder a recuperação de uma operação de resultado incerto. Este ensaio é parcial, não uma prova de todas as versões, de PostgREST nesta rota ou de homologação.

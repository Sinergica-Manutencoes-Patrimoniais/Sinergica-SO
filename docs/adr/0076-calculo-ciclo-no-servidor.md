# ADR-0076 — Cálculo civil de ciclo no servidor

## Decisão

O futuro comando transacional de materialização calcula cada vencimento diretamente da data-base aprovada e do índice de ciclo, sem depender de execução, feriado, programação ou relógio de sessão. Uma função pura interna do banco aplica dias, semanas, meses ou anos, preserva o último dia quando o mês não contém o dia da âncora e rejeita argumentos ou resultados fora do intervalo de datas suportado pela aplicação. Não grava dados nem autoriza geração, e não é exposta diretamente a usuários.

## Compatibilidade e limites

A função legada `materializar_ocorrencias_preventivas` permanece inalterada; a futura integração precisa comparar os resultados para frequências compartilhadas e respeitar a ADR-0075. Não há mudança de Ocorrências existentes, nem envio Auvo. Reversão antes de uso: remover a função aditiva. Após haver consumidores, desativá-los primeiro e preservar dados gerados; homologar concorrência, versão e autorização antes de liberar o escritor.

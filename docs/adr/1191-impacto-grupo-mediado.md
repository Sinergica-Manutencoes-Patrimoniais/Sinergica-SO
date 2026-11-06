# ADR-1191 — Consulta mediada do impacto de movimentar Grupo

## Contexto

As consultas 0505 e 0507 são privadas, mas a prévia da movimentação tenta chamá-las pelo navegador. A tela não consegue obter essas informações com a execução revogada. Os números são parciais e não representam uma avaliação completa da programação ou execução.

## Decisão

Preparar entradas autenticadas separadas para cada consulta. Cada entrada confere identidade, Cliente e Grupo, tenta a trava compartilhada de autorização, mantém o respectivo gate fechado por padrão e reutiliza o núcleo privado com suas verificações de capacidade. O cliente escolhe explicitamente a entrada mediada por flag adicional desligada. Não modificar o Grupo, a programação nem vínculos.

## Limitações e liberação

Não aplicar ou habilitar antes de validar RLS/FORCE, proprietários, sequência das migrations, concorrência de autorização e gates, troca de Cliente/sessão, integridade das contagens e revisão adversarial. A trava só oferece a garantia correspondente aos escritores que a respeitam. Contagens não incluem todos os vínculos indiretos nem comprovam estado de execução. A falha da prévia não autoriza inferir ausência de impacto.

# Validação do caderno de testes — novembro de 2026

Preservado aqui em 27/11/2026 porque vivia **fora do repositório**, em
`/Users/lucasazevedo/validacao-caderno-sinergica/`, numa máquina que seria apagada.

## O que é

Execução do caderno de 65 casos de teste contra a aplicação, com os defeitos encontrados.
A numeração **DEF-xx** só existe nestes arquivos — não há nada equivalente no código.

| Arquivo | O que é |
|---|---|
| `resultado-parcial.md` | O relatório. 151 KB. Situação dos 65 casos, DEF-01 a DEF-55, massa de teste criada, e a seção "Passagem para nova sessão" com a próxima etapa concreta de cada caso em triagem |
| `situacao-por-caso-recuperado.md` | Transcrição verbatim da situação dos 65 casos, feita durante uma recuperação de perda |
| `adendo-2026-11-26.md` e `sinergica-adendo-2026-11-26.md` | Resultados avulsos preservados durante a mesma recuperação |
| `evidencias/` | 13 capturas de tela com conteúdo |
| `Caderno_Tecnico_Implementacao_SSO_v1.docx` | Documento técnico que estava solto no repositório, sem rastreamento |

## Estado na data

9 casos aprovados integralmente, 15 reprovados, 16 bloqueados, 23 em triagem,
2 despriorizados. 55 defeitos registrados.

14 defeitos já corrigidos: Onda 1 na `main` (PR #127) e Onda 2 no PR #128.

## O que NÃO está aqui, de propósito

- **As senhas das contas de teste.** Ficaram em arquivos locais privados na máquina antiga
  (`credenciais-teste-locais.txt`, `credencial-operador-local.txt`) e não foram copiadas.
  As contas são `gestor-pcm-caderno-20261126@teste.invalid` e
  `operador-pcm-caderno-20261126@teste.invalid`; se as senhas não vierem por outro caminho,
  criar contas novas no mesmo padrão.
- **16 capturas de tela antigas**, perdidas em 26/11/2026 por uma falha de cópia.
  Estão nomeadas no relatório como perdidas, para recaptura.

## Aviso sobre o ambiente

`so-sinergica.netlify.app` é **produção** (`PROD_ORIGIN` em `scripts/smoke-edge-functions.mjs`),
usada para teste porque o sistema ainda não está em uso real. O teste foi autorizado apenas no
cliente **Sinérgica - Escritório**, e a massa fictícia criada está listada no relatório para limpeza.

O módulo **Atendimento** tem conversas reais de WhatsApp com dado pessoal e de saúde de terceiros.
Não foi aberto, e não deve ser.

# ADR-1544 — Versão operacional efetiva de ocorrência revisada

Status: proposta em desenvolvimento; não habilita aprovação, geração ou integração Auvo. A guarda 1045 permanece incondicional.

## Contexto

AC-5 da E01-S165 prevê prévia de ocorrências mantidas ou alteradas, preservando vigência, conteúdo histórico e OS. A ocorrência preparada conserva `versao_id` e `rotina_id` de origem; a identidade canônica e os vínculos são imutáveis. A decisão atual permite manter ou exigir reconciliação, mas não efetiva a alteração do conteúdo para uma ocorrência cuja Rotina e alvo permanecem.

## Direção proposta

A escolha do PCM será específica de uma ocorrência canônica já existente, com comparação explícita da Rotina da origem e da revisão. Uma vinculação adicional imutável deverá apontar para a versão e Rotina aprovadas que fornecerão conteúdo operacional futuro, sem alterar a ocorrência de origem, a identidade, data original ou OS. A transição exige mesma identidade lógica, modo, alvo e data comprovados; a decisão de data/âncora diferente continua fora deste recorte. Somente a partir da vigência aprovada a versão efetiva poderá ser consumida.

A gravação e o uso precisarão revalidar atomicamente a comparação confirmada, identidade, fonte, vigência, autorização, decisão e estado de execução, com idempotência e auditoria. Ocorrências com OS ou execução cuja preservação não possa ser demonstrada não serão alteradas; o PCM recebe motivo específico. Ausência de registro em fonte parcial não prova ausência de execução. Não alterar, cancelar ou reenviar OS/Auvo.

## Consumidores e limites identificados

- `sso_materializar_ciclo_legado` (0764, posteriormente alterada) resolve a Rotina e questionário pela versão da preparada. Para novo consumo, precisa usar a versão efetiva autorizada sem mudar a origem histórica.
- `sso_vincular_visita_legado_existente` (0723, posteriormente alterada) também confere questionário na versão original. A alteração deve preservar a identidade contratual e os vínculos existentes.
- `sso_guardar_os_chamado_preventivo` (1584) reconstrói versão e Rotina da preparada em INSERT e UPDATE, validando questionário e tipo de tarefa; a implementação deve congelar a origem efetiva por OS sem reinterpretar OS existentes. A integridade de retorno 1041 também exige igualdade com a versão de origem da preparada e precisa de compatibilidade explícita.
- `sso_previa_cobertura_visita` (0811) lê referência histórica da OS e não pode passar a usar a nova versão retroativamente. A captura da versão efetiva no momento de criação de uma OS futura precisa ser preservada de forma imutável e consultada por seus consumidores de retorno.
- A geração canônica reutiliza a preparada e o ciclo. Uso da versão e continuidade aprovados não equivalem à troca do conteúdo operacional.

## Condições antes de habilitar

Concluir inventário dos consumidores de calendário, Visita, fila, Chamado, Grupo, OS e retorno; adaptar a leitura de conteúdo de ponta a ponta e manter a proveniência histórica congelada. Validar conflito e replay, mudança concorrente da comparação/OS, isolamento Cliente, RLS, preservação de questionário, datas diferentes bloqueadas, geração sem duplicar ciclo, vigência futura, permissões, revisão adversarial e ensaio integrado no banco. A fonte de feriados e demais fontes externas permanecem incompletas; nada disso remove a guarda 1045.

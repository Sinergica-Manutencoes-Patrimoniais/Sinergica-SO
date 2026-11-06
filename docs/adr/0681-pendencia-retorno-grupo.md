# ADR-0681 — Identidade de Grupo em Pendência de retorno

Pendência passa a admitir exatamente uma origem: ocorrência preventiva legada ou ocorrência de Grupo, sem fabricar Plano, Sistema ou Componente. A adaptação do comando de Pendência verifica a OS declarada, Cliente, Grupo e snapshot da versão aprovada e preserva as verificações de retorno, decisão e Não OK. Registros anteriores continuam com origem legada.

Esta migration não autoriza inserção para Grupo: a barreira 0903 permanece. Consumidores de Pendências que pressupõem ocorrência legada, concorrência, testes, rollout e revisão adversarial devem ser concluídos antes de ativação. Nenhum gate ou permissão é habilitado.

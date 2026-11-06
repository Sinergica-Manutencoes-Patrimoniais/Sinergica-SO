# ADR-1435 — Preservar tipo de tarefa nas cópias

Ao revisar a mesma Rotina lógica ou copiar um Plano/modelo no mesmo Cliente e alvo, preservar o tipo de tarefa explicitamente presente na fotografia aprovada. Ausência permanece desconhecida. Se existir referência e o gate estiver fechado, a operação é recusada para evitar perda silenciosa; Cliente ou alvo diferente não herda a referência.

A cópia não cria OS nem envia tarefa. Antes da ativação, validar fotografias antigas, mapas, hashes, concorrência, triggers, referências inativas, RLS/FORCE e revisão adversarial. O gate do ADR-1433 permanece fechado.

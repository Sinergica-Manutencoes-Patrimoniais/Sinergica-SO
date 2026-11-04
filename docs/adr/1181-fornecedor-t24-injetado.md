# ADR-1181 — Adaptador de fornecedor T−24 com transporte injetado

Status: proposta local, não conectada nem homologada.

Preparar fornecedor que compõe payload com contrato explícito, valida identidade das respostas e normaliza leitura de técnico, data, alvo e questionário. Busca só declara ausência quando transporte atesta cobertura completa e identidade exata; resultados incompletos ou ambíguos exigem reconciliação. PATCH usa conversor existente de JSON Patch. Nenhuma credencial, endpoint ou chamada é configurada neste módulo.

Os sinais de comprovação e cobertura são fornecidos pela implementação de transporte e não constituem evidência por si mesmos. É obrigatório provar paginação e filtros reais, formatos de POST/PATCH/GET, timezone, questionário ausente, limites e comportamento de erro antes de conectar ou abrir gates. Validar tentativas concorrentes, timeout, resposta tardia, revogação e revisão adversarial. Nenhuma tarefa real é criada nesta etapa.

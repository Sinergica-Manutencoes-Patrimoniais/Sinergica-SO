# threat-model

**Task ID:** `threat-model`
**Version:** 1.0.0
**Status:** Active
**Owner:** @security (Cipher)

---

## Purpose

Executa modelagem de ameaças usando STRIDE no componente ou story especificado. Identifica vetores de ataque, classifica por probabilidade × impacto e gera mitigações priorizadas.

---

## STRIDE Framework

| Categoria | Pergunta central | Exemplos |
|-----------|-----------------|---------|
| **S**poofing | Quem pode se passar por outro? | Bypass de auth, token forgery, IP spoofing |
| **T**ampering | O que pode ser adulterado? | SQL injection, CSRF, request manipulation |
| **R**epudiation | Quem pode negar uma ação? | Falta de audit log, log manipulation |
| **I**nformation Disclosure | O que pode ser exposto? | PII em logs, verbose errors, IDOR |
| **D**enial of Service | O que pode ser derrubado? | Rate limit ausente, resource exhaustion |
| **E**levation of Privilege | Quem pode ganhar mais poder? | Broken auth, IDOR, privilege escalation |

---

## Execution Steps

### Step 1: Scope Definition

```
Componente/Feature: ___________
Superfície de ataque:
  - Endpoints HTTP: ___________
  - Dados de entrada: ___________
  - Integrações externas: ___________
  - Dados sensíveis envolvidos: ___________
  - Atores (usuários, sistemas): ___________
```

### Step 2: Threat Tree

Para cada categoria STRIDE, enumerar ameaças concretas:

```
[COMPONENTE]
├── S: Spoofing
│   ├── Threat 1: ___________
│   └── Threat 2: ___________
├── T: Tampering
│   └── ...
├── R: Repudiation
│   └── ...
├── I: Information Disclosure
│   └── ...
├── D: Denial of Service
│   └── ...
└── E: Elevation of Privilege
    └── ...
```

### Step 3: Risk Rating

Para cada ameaça identificada:

| Ameaça | Probabilidade (1-5) | Impacto (1-5) | Score (P×I) | Severidade |
|--------|--------------------|--------------:|:-----------:|-----------|
| ...    | ...                | ...           | ...         | CRITICAL/HIGH/MEDIUM/LOW |

**Mapeamento de score:**
- 20-25: CRITICAL
- 12-19: HIGH
- 6-11: MEDIUM
- 1-5: LOW

### Step 4: Attack Vectors (Top 5 por Score)

Para cada vetor ranqueado:

```
VETOR: [nome]
Severidade: [CRITICAL/HIGH/MEDIUM/LOW]
Categoria STRIDE: [letra]
Descrição: [como o ataque funciona]
Pré-requisitos: [o que o atacante precisa]
Impacto: [o que acontece se explorado]
Prova de conceito: [esboço do ataque]
```

### Step 5: Mitigations

Para cada ameaça HIGH/CRITICAL:

```
MITIGAÇÃO: [ameaça]
Controle primário: [defesa principal]
Controle secundário: [defesa em profundidade]
Implementação: [como implementar]
Verificação: [como testar que funciona]
Responsável: [@dev/@devops/@data-engineer]
Prazo: [imediato/próximo sprint/backlog]
```

---

## Output Format

```markdown
## Threat Model — [Componente/Feature]
**Data:** YYYY-MM-DD
**Analista:** @security (Cipher)
**Escopo:** [descrição]

### Resumo Executivo
[2-3 linhas com os riscos mais críticos]

### Threat Tree
[diagrama textual]

### Risk Matrix
[tabela de ameaças ranqueadas]

### Top Attack Vectors
[vetores detalhados]

### Mitigations Roadmap
[tabela de mitigações priorizadas]

### Gate Decision
PASS / CONCERNS / FAIL
[justificativa]
```

---

## Integration

- Executar **antes** de stories com: auth, pagamentos, PII, novos endpoints de API
- Saída salva em: `docs/security/threat-models/{component}-{date}.md`
- Findings CRITICAL/HIGH → registrar como stories de segurança via @sm
- Resultado alimenta `*security-gate` como pré-condição

---

## References

- STRIDE: Microsoft Threat Modeling Tool methodology
- OWASP Threat Modeling: https://owasp.org/www-community/Threat_Modeling
- PASTA: Process for Attack Simulation and Threat Analysis (alternativa)

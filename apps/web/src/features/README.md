# features/ — bounded contexts do Sinérgica SO

Um diretório por **bounded context** (ver `docs/ARCHITECTURE.md` para o context-map completo).
Features de domínios diferentes **não se importam** entre si — o compartilhamento acontece só
via `packages/` (`@sinergica/shared`, `@sinergica/ui`).

Dentro de cada feature, a regra de dependência DDD vale localmente
(`interfaces → application → domain ← infrastructure`):

```
features/<dominio>/
  pages/           ← telas (rotas)
  components/      ← UI específica do contexto
  hooks/           ← lógica de tela (TanStack Query, etc.)
  domain/          ← regras puras, value objects, invariantes (sem I/O, sem framework)
  application/     ← casos de uso (orquestra domínio + portas)
  infrastructure/  ← adapters (Supabase, Auvo, Evolution…)
  types/           ← tipos do contexto
```

| Feature        | Bounded context        | Schema Postgres | Status   |
|----------------|------------------------|-----------------|----------|
| `pcm`          | Operação Técnica & PCM | `pcm`           | âncora (1ª spec) |
| `comercial`    | Comercial / CRM        | `comercial`     | planejado |
| `atendimento`  | Atendimento (Zé/IA)    | `atendimento`   | planejado |
| `marketing`    | Marketing              | `marketing`     | planejado |
| `growth`       | Growth (Ads)           | `growth`        | planejado |
| `operacao`     | Operação & Estoque     | `pcm`/`estoque` | planejado |
| `financeiro`   | Financeiro             | `financeiro`    | planejado |
| `gestao`       | Gestão (cockpit)       | (views)         | planejado |
| `area-cliente` | Área do Cliente        | (views `pcm`)   | planejado |

> O PCM é o **system of record** da operação; o Auvo é o **braço de campo** (execução).

# Consent Management Design Task

Design consent mechanism and opt-out flow for a feature that collects or processes personal data under a consent-based legal basis.

**Reference:** Privacy by Design Principle 7 (Respect for User Privacy), GDPR Articles 6/7, CCPA opt-out requirements, Cavoukian's consent principles.

---

## Task Definition

```yaml
task: consentManagementDesign()
responsavel: Pax (Balancer)
responsavel_type: Agente
atomic_layer: Molecule

Entrada:
  - campo: story_id
    tipo: string
    obrigatorio: true

  - campo: legal_basis
    tipo: enum
    obrigatorio: true
    validacao: consent | legitimate_interest | contract | legal_obligation

Saida:
  - campo: consent_design
    tipo: file
    destino: docs/stories/{story_id}/privacy/consent-design.md
    persistido: true
```

---

## Consent Design (when legal_basis = consent)

### Consent validity requirements (GDPR Article 7)

Consent must be:

- **Freely given:** no coercion or bundling with other services
- **Specific:** for a specific, defined purpose
- **Informed:** user knows what they're consenting to before agreeing
- **Unambiguous:** opt-in action (pre-ticked boxes are not valid)
- **Withdrawable:** as easy to withdraw as to give

### Consent UI design checklist

- [ ] Consent request is presented BEFORE data collection begins
- [ ] Clear description of what data is collected and for what purpose
- [ ] Explicit opt-in action required (no pre-filled checkboxes)
- [ ] Opt-out is equally prominent and easy as opt-in
- [ ] Timestamp and version of consent terms recorded at time of acceptance
- [ ] Consent stored in database with: user_id, consent_type, timestamp, version

### Consent record schema

```sql
CREATE TABLE consent_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  user_id UUID NOT NULL,
  consent_type TEXT NOT NULL,    -- e.g., 'marketing_outreach', 'data_processing'
  consented BOOLEAN NOT NULL,
  consent_version TEXT NOT NULL, -- version of terms at time of consent
  ip_address INET,               -- for evidence purposes
  user_agent TEXT                -- for evidence purposes
);
```

---

## Opt-Out Flow Design (for all legal bases)

Regardless of legal basis, users must be able to opt out of:

- Receiving further communications
- Having their data processed

### Opt-out requirements

- **Opt-out channel:** how does a user opt out? (Reply STOP, email, UI button)
- **Blocklist implementation:** opt-out must be permanent and not re-opted-in without explicit new consent
- **Opt-out confirmation:** user receives acknowledgment within 48h
- **Propagation:** opt-out must propagate to all channels (email + WhatsApp + etc.)

### Blocklist schema

```sql
CREATE TABLE opt_out_blocklist (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  identifier TEXT NOT NULL UNIQUE, -- email or phone (hashed for privacy)
  identifier_type TEXT NOT NULL,   -- 'email' | 'phone'
  reason TEXT,                     -- 'user_request' | 'bounce' | 'complaint'
  permanent BOOLEAN DEFAULT TRUE
);
```

### Automated opt-out processing

For messaging features:

- Incoming messages matching "STOP", "PARE", "REMOVER", "UNSUBSCRIBE", "OPT OUT" → automatic opt-out
- Response message sent confirming removal
- No further messages sent

---

## Legitimate Interest Assessment (when legal_basis = legitimate_interest)

When relying on legitimate interest (not consent), document:

1. **Purpose test:** What legitimate interest is pursued? Is it genuine?
2. **Necessity test:** Is processing necessary? Can it be done with less invasive means?
3. **Balancing test:** Does the legitimate interest override the data subject's rights?
   - Consider: nature of data, data subject's reasonable expectations, impact

Legitimate interest is NOT appropriate for:

- Sensitive data (special categories under GDPR Article 9)
- Children's data
- When processing has a high potential for harm

---

## Post-Conditions

```yaml
post-conditions:
  - [ ] Consent mechanism designed (if applicable)
    blocker: true
  - [ ] Opt-out flow designed with blocklist
    blocker: true
  - [ ] Consent record schema defined
    blocker: false
  - [ ] LI assessment documented (if legal_basis = legitimate_interest)
    blocker: false
```

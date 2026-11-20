---
id: ADR-0011
category: cross_cutting
title: 'Cross-cutting: Compliance and data residency'
status: accepted
superseded_by: null
component_id: null
rule: Encrypt data in transit and at rest, and keep all data in the single AWS region.
decision: No specific compliance regime assumed; personal data is stored encrypted
  at rest and in transit in the single AWS region. Revisit if GDPR or other residency
  rules apply.
evidence: recommended default, accepted by the human without review
---

## Context

recommended default, accepted by the human without review

## Decision

No specific compliance regime assumed; personal data is stored encrypted at rest and in transit in the single AWS region. Revisit if GDPR or other residency rules apply.

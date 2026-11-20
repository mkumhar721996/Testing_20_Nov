---
id: ADR-0009
category: cross_cutting
title: 'Cross-cutting: Tenant isolation'
status: accepted
superseded_by: null
component_id: null
rule: Every tenant-owned table has an organisation id column and every query the Core
  API runs is filtered by the caller's organisation id.
decision: Single shared database with shared tables; every tenant-owned row carries
  an organisation id, and the Core API scopes every query by the caller's organisation.
evidence: 'the human: "Shared tables with an organisation id column"'
contested: true
alternatives_considered:
- 'Schema per organisation: more operational overhead than the human wanted'
- 'Database per organisation: highest cost and migration burden'
- 'Separate stack per organisation: heaviest isolation, not chosen'
consequences:
- Isolation depends on application-level scoping, so cross-tenant access tests are
  required
- Cheapest to run and simplest to migrate
---

## Context

the human: "Shared tables with an organisation id column"

## Decision

Single shared database with shared tables; every tenant-owned row carries an organisation id, and the Core API scopes every query by the caller's organisation.

## Alternatives considered

- Schema per organisation: more operational overhead than the human wanted
- Database per organisation: highest cost and migration burden
- Separate stack per organisation: heaviest isolation, not chosen

## Consequences

- Isolation depends on application-level scoping, so cross-tenant access tests are required
- Cheapest to run and simplest to migrate

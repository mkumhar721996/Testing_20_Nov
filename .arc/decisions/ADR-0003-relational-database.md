---
id: ADR-0003
category: component
title: Relational Database
status: accepted
superseded_by: null
component_id: comp_relational_database
responsibility: Persistent store for customer and organisation data; product not yet
  chosen.
kind: infrastructure
split_reason: a backing service the project uses
rule: Application data is stored in the Relational Database and accessed only by the
  Core API.
evidence: 'proposed: customers and organisations imply persistent relational data'
---

## Context

proposed: customers and organisations imply persistent relational data

## Decision

Persistent store for customer and organisation data; product not yet chosen.

Kept separate because a backing service the project uses.

---
id: ADR-0008
category: deployment_target
title: "Deployment target: AWS, containers, a single region (region not yet named);\
  \ environments prod and\u2026"
status: accepted
superseded_by: null
component_id: null
rule: Run all components as containers on AWS in a single region; no multi-region
  replication.
decision: AWS, containers, a single region (region not yet named); environments prod
  and staging. Web App and Core API run as containers; the database is run in the
  same region.
evidence: 'the human: "AWS with containers, one region"; staging proposed'
---

## Context

the human: "AWS with containers, one region"; staging proposed

## Decision

AWS, containers, a single region (region not yet named); environments prod and staging. Web App and Core API run as containers; the database is run in the same region.

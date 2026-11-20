---
id: ADR-0006
category: nfr
title: "NFR: scale \u2014 100 concurrent, 10,000 registered"
status: accepted
superseded_by: null
dimension: scale
metric: concurrent users
threshold: 100 concurrent, 10,000 registered
component_id: null
needs_dedicated_tracking: true
rule: Design for up to 10,000 registered users and 100 concurrent users; revisit when
  exceeded.
evidence: recommended default, accepted by the human without review
---

## Context

recommended default, accepted by the human without review

## Decision

concurrent users: 100 concurrent, 10,000 registered

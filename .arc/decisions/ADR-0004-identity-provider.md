---
id: ADR-0004
category: component
title: Identity Provider
status: accepted
superseded_by: null
component_id: comp_identity_provider
responsibility: Managed service that signs customers and organisation members in and
  issues tokens; runs on Amazon Cognito.
kind: managed_service
split_reason: a managed provider the project uses but doesn't build
rule: Users authenticate only through the Identity Provider; the Core API accepts
  only tokens it issued.
evidence: 'the human: "Amazon Cognito (fits AWS)"'
---

## Context

the human: "Amazon Cognito (fits AWS)"

## Decision

Managed service that signs customers and organisation members in and issues tokens; runs on Amazon Cognito.

Kept separate because a managed provider the project uses but doesn't build.

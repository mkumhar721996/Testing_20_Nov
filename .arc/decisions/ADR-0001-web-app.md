---
id: ADR-0001
category: component
title: Web App
status: accepted
superseded_by: null
component_id: comp_web_app
responsibility: Browser UI used by customers and by organisations (and their members)
  to use the product.
kind: web_ui
split_reason: 'a different runtime: browser client'
talks_to:
- component_id: comp_core_api
  interaction: sync
  evidence: 'proposed: browser client calls the backend'
- component_id: comp_identity_provider
  interaction: sync
  evidence: 'proposed: browser sign-in via the managed provider'
rule: All user-facing screens live in the Web App and reach data only through the
  API.
evidence: 'the human: "web application will be use for customers, organisations"'
---

## Context

the human: "web application will be use for customers, organisations"

## Decision

Browser UI used by customers and by organisations (and their members) to use the product.

Kept separate because a different runtime: browser client.

## Talks to

- **Core API** (sync) — proposed: browser client calls the backend
- **Identity Provider** (sync) — proposed: browser sign-in via the managed provider

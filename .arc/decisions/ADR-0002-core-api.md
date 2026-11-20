---
id: ADR-0002
category: component
title: Core API
status: accepted
superseded_by: null
component_id: comp_core_api
responsibility: Backend API holding the business logic and enforcing customer/organisation
  access rules; the single writer of the database.
kind: api_service
split_reason: server runtime separate from the browser client
talks_to:
- component_id: comp_relational_database
  interaction: shared-storage
  evidence: 'proposed: API persists data'
- component_id: comp_identity_provider
  interaction: sync
  evidence: 'proposed: API validates tokens issued by the provider'
rule: Only the Core API reads or writes the database; it authorises every request
  against the caller's customer or organisation.
evidence: 'proposed: a web app for customers and organisations needs a server-side
  API'
---

## Context

proposed: a web app for customers and organisations needs a server-side API

## Decision

Backend API holding the business logic and enforcing customer/organisation access rules; the single writer of the database.

Kept separate because server runtime separate from the browser client.

## Talks to

- **Relational Database** (shared-storage) — proposed: API persists data
- **Identity Provider** (sync) — proposed: API validates tokens issued by the provider

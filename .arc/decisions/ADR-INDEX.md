# ADR Index

One line per decision — the rule, not the reasoning. Read the full ADR (`.arc/decisions/ADR-NNNN-*.md`) for context and rationale.

## Accepted — binding rules

| ADR | Category | Status | Rule |
|---|---|---|---|
| ADR-0001 | component | accepted | All user-facing screens live in the Web App and reach data only through the API. |
| ADR-0002 | component | accepted | Only the Core API reads or writes the database; it authorises every request against the caller's customer or organisation. |
| ADR-0003 | component | accepted | Application data is stored in the Relational Database and accessed only by the Core API. |
| ADR-0004 | component | accepted | Users authenticate only through the Identity Provider; the Core API accepts only tokens it issued. |
| ADR-0005 | nfr | accepted | Monthly availability of the Web App and Core API stays at or above 99.5%, with planned maintenance windows allowed. |
| ADR-0006 | nfr | accepted | Design for up to 10,000 registered users and 100 concurrent users; revisit when exceeded. |
| ADR-0007 | nfr | accepted | Core API p95 latency stays under 500 ms. |
| ADR-0008 | deployment_target | accepted | Run all components as containers on AWS in a single region; no multi-region replication. |
| ADR-0009 | cross_cutting | accepted | Every tenant-owned table has an organisation id column and every query the Core API runs is filtered by the caller's organisation id. |
| ADR-0010 | cross_cutting | accepted | Do not add external system calls without recording them as an integration first. |
| ADR-0011 | cross_cutting | accepted | Encrypt data in transit and at rest, and keep all data in the single AWS region. |

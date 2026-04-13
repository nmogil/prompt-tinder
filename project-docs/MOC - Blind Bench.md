---
title: "MOC - Blind Bench"
created: 2026-04-11
modified: 2026-04-11
type: moc
status: planning
domain: ideas
tags:
  - moc
  - blind-bench
---

# MOC - Blind Bench

> Navigation hub for Blind Bench — "Git meets Google Docs" for collaborative prompt engineering.

**Status**: v1 — in planning. Architecture frozen, UX and build plan drafted, optimizer meta-prompt pending (owner drafts).

---

## Start here
- [[Blind Bench - Architecture]] — system design, data model, Convex functions, auth model, design decisions
- [[Blind Bench - Glossary]] — locked vocabulary for the product (version, run, output, test case, blind label, meta context, etc.)

## Product & Design
- [[Blind Bench - UX Spec]] — design principles, sitemap, screen catalog, component inventory, user flows, states, blind-eval security rules, accessibility, microcopy, keyboard shortcuts
- [[Blind Bench - Architecture#Authorization Model]] — role × action matrix that the UX spec enforces at the browser-surface level
- [[Blind Bench - Architecture#Data Flow: Prompt Optimization Cycle]] — the loop the product is built around

## Implementation
- [[Blind Bench - Build Plan]] — M0 through M7 milestones with deliverables, acceptance criteria, testable demos, dependency graph
- [[Blind Bench - Optimizer Meta-Prompt]] — scaffolding (input/output schema, constraints, validation, versioning, eval) around the core meta-prompt the owner drafts

## Background
- [[Blind Bench - Architecture#Overview]] — tech stack table and core workflow
- [[Blind Bench - Architecture#v1 Scope & Deferred]] — what ships in v1 and what's explicitly pushed

---

## Parent
- [[MOC - Ideas Hub]]

## Related MOCs
- [[MOC - AI & Agents]]
- [[MOC - Web Development]]

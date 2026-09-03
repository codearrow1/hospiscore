# HospiOS

> The operating platform for the global hospitality technology ecosystem.

HospiOS is a global hospitality SaaS platform designed to connect hospitality businesses with a unified commercial, administrative and technology ecosystem.

This repository contains the **HospiOS SaaS Platform, Marketing Website and SaaS Control Plane**.

It does **not** define or document the main operational PMS application.

---

# What HospiOS Includes

The repository is organized around two major public/product layers and the SaaS management platform surrounding them.

## 1. Marketing Website

The public website is responsible for:

- product marketing
- hospitality solutions
- property-type positioning
- pricing
- resources
- integrations
- lead generation
- demo requests
- property score
- property intelligence
- contact and conversion flows

Typical public capabilities include:

- Homepage
- Platform
- Solutions
- Pricing
- Resources
- Property Score
- Property Intelligence
- Demo booking
- Contact
- Property discovery
- Property claim
- SaaS onboarding entry points

---

# 2. Property Intelligence & Acquisition

HospiOS includes a property intelligence and acquisition engine intended to turn hospitality businesses into qualified SaaS opportunities.

Typical lifecycle:

```text
Property Discovery
        ↓
Property Intelligence
        ↓
Property Score
        ↓
Lead
        ↓
Report
        ↓
Property Claim
        ↓
Verification
        ↓
Organization
        ↓
Onboarding
        ↓
Plan Recommendation
        ↓
Subscription
```

The system is designed to preserve property history and attribution throughout the lifecycle.

---

# 3. SaaS Control Plane

The SaaS Control Plane is the commercial and administrative core of HospiOS.

It includes:

### Organizations

* organization management
* property relationships
* ownership
* organization lifecycle

### Properties

* property discovery
* import
* Google Places enrichment
* claim workflow
* verification
* property lifecycle

### Users & Access

* users
* memberships
* roles
* permissions
* authentication
* tenant access

### Plans

* plan management
* pricing
* feature entitlements
* plan approvals

### Subscriptions

* subscription lifecycle
* trials
* renewals
* plan changes
* cancellation
* suspension
* expiration
* proration

### Billing

* invoices
* invoice lines
* payments
* refunds
* voids
* dunning
* coupons
* usage billing

### Payment Infrastructure

Provider-neutral payment architecture supporting multiple providers.

The system is designed to support:

* provider configuration
* credentials
* connection testing
* provider capabilities
* routing
* refunds
* webhook processing
* idempotency
* provider status

Live provider activation remains explicitly controlled.

### Affiliates

* affiliate applications
* attribution
* referral links
* campaigns
* recurring commissions
* deferred commissions
* multi-tier recruitment
* commission overrides
* fraud controls
* payouts

### CRM / Growth

* leads
* demos
* pipeline
* campaigns
* attribution
* sales workflows
* conversion tracking

### Partners

* partner management
* partner relationships
* attribution
* commercial workflows

### Franchise

* franchise relationships
* property/group relationships
* commercial management

### Analytics

* SaaS KPIs
* MRR
* ARR
* customer metrics
* funnel
* customer health
* financial monitoring
* growth analytics

### Platform Administration

* settings
* integrations
* audit
* approvals
* notifications
* operational controls

---

# Architecture Overview

```text
                         ┌─────────────────────────┐
                         │      MARKETING WEB      │
                         │                         │
                         │ Homepage                │
                         │ Solutions               │
                         │ Pricing                 │
                         │ Resources               │
                         │ Property Score          │
                         │ Demo / Lead Generation  │
                         └────────────┬────────────┘
                                      │
                                      ▼
                         ┌─────────────────────────┐
                         │  PROPERTY INTELLIGENCE  │
                         │                         │
                         │ Discovery               │
                         │ Scoring                 │
                         │ Reports                 │
                         │ Lead Capture            │
                         │ Attribution             │
                         └────────────┬────────────┘
                                      │
                                      ▼
                         ┌─────────────────────────┐
                         │ CLAIM / ONBOARDING       │
                         │                         │
                         │ Claim                   │
                         │ Verification            │
                         │ Organization            │
                         │ Property                 │
                         │ Plan Recommendation     │
                         └────────────┬────────────┘
                                      │
                                      ▼
┌─────────────────────────────────────────────────────────────────────┐
│                        HOSPIOS SAAS CONTROL PLANE                    │
│                                                                     │
│ Organizations   Properties   Users/RBAC   Plans   Subscriptions    │
│                                                                     │
│ Billing   Invoices   Payments   Refunds   Dunning   Coupons         │
│                                                                     │
│ Affiliates   Campaigns   Leads   Demos   Pipeline   Partners        │
│                                                                     │
│ Franchise   Analytics   Settings   Audit   Integrations             │
│                                                                     │
└──────────────────────────────┬──────────────────────────────────────┘
                               │
                               ▼
                    ┌────────────────────────┐
                    │     DOMAIN SERVICES     │
                    │                        │
                    │ auth                   │
                    │ RBAC                   │
                    │ tenancy                │
                    │ billing                │
                    │ payments               │
                    │ subscriptions          │
                    │ affiliates             │
                    │ attribution             │
                    │ property intelligence  │
                    │ notifications          │
                    └────────────┬───────────┘
                                 │
                                 ▼
                    ┌────────────────────────┐
                    │       PRISMA ORM       │
                    └────────────┬───────────┘
                                 │
                                 ▼
                    ┌────────────────────────┐
                    │       DATABASE         │
                    └────────────────────────┘
```

---

# Architecture Principles

## Server-side authorization

Authentication alone is not sufficient.

Every protected mutation must enforce:

```text
Authentication
       ↓
Authorization
       ↓
Tenant Scope
       ↓
Validation
       ↓
Business Rules
       ↓
Database
```

UI-level hiding is never considered a security boundary.

---

# Multi-Tenant Model

The commercial platform follows the conceptual hierarchy:

```text
Platform
   ↓
Organization
   ↓
Property
   ↓
Membership / Users / Business Data
```

A request must not be able to escape its permitted organization/property context.

Client-provided IDs must never automatically be treated as trusted ownership.

---

# Financial Architecture

Financial functionality is treated as a domain rather than simple CRUD.

Important properties:

* transactional writes
* idempotency
* database constraints
* concurrency protection
* auditability
* explicit state transitions
* accurate currency handling

Financial flows include:

```text
Plan
 ↓
Subscription
 ↓
Invoice
 ↓
Payment
 ↓
Settlement
 ↓
Dunning / Renewal
```

Related financial domains include:

* refunds
* voids
* coupons
* commissions
* payouts
* usage billing

---

# Payment Architecture

The payment layer is provider-neutral.

Conceptually:

```text
Payment Request
       ↓
Provider Resolver
       ↓
Provider Adapter
       ↓
External Gateway
       ↓
Webhook / Callback
       ↓
Canonical Payment State
```

Providers should not leak provider-specific logic into the rest of the business domain.

---

# Affiliate Architecture

The affiliate system is designed around a persistent attribution chain:

```text
Affiliate
 ↓
Referral
 ↓
Property / Lead
 ↓
Claim
 ↓
Organization
 ↓
Subscription
 ↓
Commission
 ↓
Eligibility
 ↓
Payout
```

The system supports:

* first/last attribution where configured
* campaign attribution
* recurring commission
* deferred commission
* affiliate recruitment
* multi-tier overrides
* fraud detection
* payout settlement

Business policies that require owner decisions must not be guessed by developers.

---

# Technology Stack

## Frontend

* Next.js
* React
* TypeScript
* Tailwind CSS / project design system
* Server Components
* Client Components
* responsive UI
* PWA support

## Backend

* Next.js App Router
* Next.js API Routes
* TypeScript
* domain/service modules
* server-side authorization

## ORM

* Prisma

## Database

The application uses Prisma-backed persistence with environment-dependent deployment storage.

Schema changes must use versioned migrations.

Production schema evolution must never use:

```bash
prisma db push
```

## Authentication

* session-based authentication
* server-side session validation
* RBAC
* tenant scoping

## Integrations

The architecture supports integration adapters for areas such as:

* payment providers
* Google Places
* email
* communication
* calendars
* OTA/distribution
* accounting
* APIs
* webhooks
* external services

## Testing

* Vitest
* TypeScript compiler
* ESLint
* production build validation
* integration tests
* browser/runtime verification

## Deployment

The current production environment uses:

* GitHub
* Hostinger
* Next.js
* Node.js
* Prisma migrations
* environment-managed production secrets

The exact production deployment contract belongs in the deployment documentation rather than application code.

---

# Important Repository Boundaries

This repository contains:

```text
Marketing Website
+
Property Intelligence
+
Lead / Growth Platform
+
SaaS Control Plane
```

The following is deliberately outside this architecture document:

```text
Main Operational PMS Application
```

The operational PMS domain may integrate with HospiOS commercially, but its internal product architecture should not be mixed into the SaaS Control Plane architecture.

---

# Development Flow

Recommended flow:

```text
Issue
 ↓
Architecture Review
 ↓
Implementation
 ↓
Unit Test
 ↓
Integration Test
 ↓
Typecheck
 ↓
Lint
 ↓
Production Build
 ↓
Review
 ↓
PR
 ↓
Merge
 ↓
Deploy
 ↓
Live Verification
```

---

# Quality Gates

Before a pull request is considered ready:

```bash
npx tsc --noEmit
npm run lint
npx vitest run
npm run build
npm run launch:check
npm run smoke
```

Financial, security and tenancy changes should receive additional focused tests.

---

# Security Rules

Never commit:

* passwords
* API keys
* private keys
* payment credentials
* encryption keys
* production database credentials
* webhook secrets
* session secrets

Use:

```text
.env
.env.local
.env.production
```

for local/host configuration as appropriate.

Only safe placeholders belong in:

```text
.env.example
```

---

# Database Rules

Never:

```bash
prisma db push
```

against production.

Use:

```text
schema change
→ migration
→ local validation
→ migration validation
→ deployment
```

Migrations must be additive and reviewable unless a destructive migration is explicitly approved.

---

# Contribution Rules

Before changing a business domain:

1. Locate the canonical service.
2. Locate the canonical database model.
3. Locate existing permissions.
4. Locate existing audit behavior.
5. Locate existing tests.
6. Extend rather than duplicate.

Do not put business logic in presentation components when a domain/service layer already exists.

---

# Pull Requests

A good PR should state:

### What changed

### Why it changed

### Files/domains affected

### Security impact

### Database impact

### Migration impact

### Tests

### Deployment considerations

### Backward compatibility

---

# Architecture Documentation

Detailed architecture documentation belongs in:

```text
docs/
```

Suggested documents:

* ARCHITECTURE.md
* SAAS-MANAGEMENT-ARCHITECTURE.md
* SAAS-RBAC-MATRIX.md
* SAAS-DATA-FLOW.md
* SAAS-FINANCIAL-INVARIANTS.md
* SAAS-INTEGRATIONS.md
* PROPERTY-INTELLIGENCE-ENGINE.md
* MARKETING-ARCHITECTURE.md
* DEPLOYMENT.md
* CONTRIBUTING.md

---

# Project Philosophy

HospiOS should remain:

* modular
* multi-tenant
* auditable
* secure
* provider-neutral
* internationally scalable
* API-first
* strongly typed
* testable
* observable

Most importantly:

**The UI should reflect what the backend actually supports.**

No fake success states.

No fake integrations.

No fake metrics.

No fabricated production data.

No hidden security bypasses.

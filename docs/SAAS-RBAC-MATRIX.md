# HospiOS — SAAS RBAC Matrix

> Grounded in the actual code. Source of truth:
> `lib/rbac.ts` (app role hierarchy),
> `lib/saas/roles.ts` (SaaS permissions + 17 SaaS roles),
> `lib/marketing/roles.ts` (marketing capabilities).

---

## App role hierarchy (merge layer — `lib/rbac.ts`)

The canonical top-level roles used for dashboards, navigation and routing:

| AppRole | Label | Dashboard | Identity source |
|---|---|---|---|
| `super_admin` | Super Admin | `/saas` | stored role in SUPER_ADMIN_TIER or ADMIN_EMAILS allowlist |
| `subadmin` | Subadmin | `/marketing-admin` | any other marketing/SaaS role (Growth plane, canonical) |
| `staff` | Staff | `/staff` | `support_admin`, `customer_success` |
| `affiliate` | Affiliate | `/affiliate` | explicit Affiliate binding (never raw email) |
| `partner` | Partner | `/partner` | explicit Partner binding (never raw email) |
| `customer` | Customer | `/customer` | primary OrgContact binding (never raw email) |

Portal identity (`affiliate`/`partner`/`customer`) requires an **explicit
binding** (`Affiliate.userId`, `Partner.userId`, or a KV binding record) —
never a raw email match. This is a documented security rule (referenced as
S-01 in code).

`super_admin` tier roles: `super_admin`, `platform_admin`, `finance_admin`,
`sales_admin`, `affiliate_manager`, `partner_manager`, `franchise_manager`.
`staff` tier: `support_admin`, `customer_success`.

---

## SaaS permissions (`lib/saas/roles.ts`)

29 granular permissions:

`CUSTOMER_VIEW`, `CUSTOMER_MANAGE`, `PROPERTY_VIEW`, `PROPERTY_MANAGE`,
`PLAN_VIEW`, `PLAN_MANAGE`, `SUBSCRIPTION_VIEW`, `SUBSCRIPTION_MANAGE`,
`BILLING_VIEW`, `BILLING_MANAGE`, `REFUND_APPROVE`, `USAGE_VIEW`,
`MARKETING_VIEW`, `MARKETING_MANAGE`, `AFFILIATE_VIEW`, `AFFILIATE_MANAGE`,
`AFFILIATE_APPROVE`, `AFFILIATE_PAYOUT`, `PARTNER_VIEW`, `PARTNER_MANAGE`,
`FRANCHISE_VIEW`, `FRANCHISE_MANAGE`, `FRANCHISE_FINANCE`, `FINANCIAL_APPROVE`,
`FEATURE_FLAG_MANAGE`, `SUPPORT_VIEW`, `SUPPORT_MANAGE`, `AUDIT_VIEW`,
`SYSTEM_SETTINGS_MANAGE`.

---

## SaaS role → permission matrix

| Role | Permissions |
|---|---|
| `super_admin` | all 29 |
| `platform_admin` | all 29 |
| `finance_admin` | CUSTOMER_VIEW, PLAN_VIEW, SUBSCRIPTION_VIEW, BILLING_VIEW, BILLING_MANAGE, REFUND_APPROVE, AUDIT_VIEW, USAGE_VIEW |
| `marketing_admin` | MARKETING_VIEW, MARKETING_MANAGE, CUSTOMER_VIEW, BILLING_VIEW, AUDIT_VIEW |
| `sales_admin` | CUSTOMER_VIEW, PROPERTY_VIEW, SUBSCRIPTION_VIEW, USAGE_VIEW, AUDIT_VIEW |
| `customer_success` | CUSTOMER_VIEW, CUSTOMER_MANAGE, PROPERTY_VIEW, SUBSCRIPTION_VIEW, USAGE_VIEW, BILLING_VIEW, SUPPORT_VIEW, SUPPORT_MANAGE, AUDIT_VIEW |
| `support_admin` | CUSTOMER_VIEW, SUBSCRIPTION_VIEW, BILLING_VIEW, PROPERTY_VIEW, AUDIT_VIEW, USAGE_VIEW, SUPPORT_VIEW, SUPPORT_MANAGE |
| `affiliate_manager` | AFFILIATE_VIEW, AFFILIATE_MANAGE, AFFILIATE_APPROVE, AFFILIATE_PAYOUT, CUSTOMER_VIEW, AUDIT_VIEW |
| `partner_manager` | PARTNER_VIEW, PARTNER_MANAGE, CUSTOMER_VIEW, AUDIT_VIEW |
| `franchise_manager` | FRANCHISE_VIEW, FRANCHISE_MANAGE, FRANCHISE_FINANCE, CUSTOMER_VIEW, AUDIT_VIEW |
| `analyst` | CUSTOMER_VIEW, PROPERTY_VIEW, SUBSCRIPTION_VIEW, BILLING_VIEW, AUDIT_VIEW, USAGE_VIEW, MARKETING_VIEW, AFFILIATE_VIEW, PARTNER_VIEW, FRANCHISE_VIEW |
| `read_only` | CUSTOMER_VIEW, PROPERTY_VIEW, PLAN_VIEW, SUBSCRIPTION_VIEW, BILLING_VIEW, USAGE_VIEW, MARKETING_VIEW, AFFILIATE_VIEW, PARTNER_VIEW, FRANCHISE_VIEW, SUPPORT_VIEW, AUDIT_VIEW |
| `marketing_manager` (legacy) | CUSTOMER_VIEW, PROPERTY_VIEW, PLAN_VIEW, SUBSCRIPTION_VIEW, BILLING_VIEW, MARKETING_VIEW |
| `sales_manager` (legacy) | CUSTOMER_VIEW, PROPERTY_VIEW, SUBSCRIPTION_VIEW, USAGE_VIEW |
| `sales_rep` (legacy) | CUSTOMER_VIEW, PROPERTY_VIEW, SUBSCRIPTION_VIEW |
| `content_editor` (legacy) | CUSTOMER_VIEW |
| `seo_manager` (legacy) | CUSTOMER_VIEW |

Helpers: `hasSaasPerm(user, perm)`, `saasRoleFor(user)`,
`getRolePermissions(role)`.

---

## Portal data scope

- **Affiliate** portal (`/affiliate`, `/api/affiliate/*`): own affiliate data + network/downline.
- **Partner** portal (`/partner`, `/api/partner/*`): own partner data.
- **Customer** portal (`/customer`, `/api/customer/*`): own organization's data
  (subscription, payments, properties, claims, team, support) only.
- **Staff** (`/staff`): support/customer-success operations.
- **Subadmin / growth** (`/marketing-admin`): marketing/leads/forms/demos.

Portal and tenant boundaries are enforced server-side. UI hiding is never a
security boundary.

---

## Enforcement

Every protected mutation must pass:

```text
Authentication → Authorization → Tenant Scope → Validation → Business Rules → Database
```

Client-provided IDs are never trusted as ownership without server-side checks.

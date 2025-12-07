# 🚀 ProfitLens Landing (Next.js + Vercel)

ProfitLens is a cockpit-grade financial SaaS platform built for real accountants and business owners. It delivers live profit tracking, audit trails, export flows, and scenario planning—all with founder-grade resilience and modular control.

---

## 💳 Plans & Stripe Integration

- **Basic Plan** → Stripe Checkout  
- **Pro Plan** → Stripe Checkout  
- Stripe subscription status (`active`, `trialing`, `past_due`, `canceled`, `incomplete`) gates premium cockpit features  
- Webhook-driven session enrichment and audit logging  
- Role-based access: `FOUNDER`, `ACCOUNTANT`, `ADMIN`, `USER`  
- Premium cockpit modules unlock instantly after payment

---

## ⚡ Quick Start (Local)

```bash
npm install
cp .env.local.example .env.local
npm run dev
```

Visit the deployed site: [https://profitlensuk.vercel.app](https://profitlensuk.vercel.app)

---

## 📧 Contact

For support or inquiries, email: **workhardnow100@gmail.com**  
Stripe reviewers will see pricing, signup path, and contact.

---

## 📝 Notes

- To use Gmail App Passwords: enable 2FA, then create an App Password at [https://myaccount.google.com/apppasswords](https://myaccount.google.com/apppasswords)
- You can switch to SendGrid later if preferred

---

## 🧭 Vision

ProfitLens is built to survive betrayal, failure, and scale. Every module is cockpit-grade, every flow is audit-aware, and every override is logged. This is not a dashboard—it’s a control panel for financial clarity.

---

## 🧠 Architecture Overview

### 🔐 Access & Gating

- Role-based: `FOUNDER`, `ACCOUNTANT`, `ADMIN`, `USER`
- Subscription-aware: `active`, `trialing`, `past_due`, `canceled`, `incomplete`
- Session-enriched via NextAuth + Supabase
- Audit-grade logging for every override, ingestion, and export

### 🧩 Core Modules

- `ChartingModule`: Revenue, expense, and profit trend charts
- `ForecastTool`: Scenario simulation with growth rate and break-even logic
- `ExportQueue`: Tracks export jobs with format, range, and download links
- `AuditTrail`: Full traceability of actions per client
- `StatementVault`: Secure access to uploaded statements

---

## 🗂️ Directory Structure

```
components/
├── accountant/       # Accountant cockpit modules
├── auth/             # Role-based access control
├── ui/               # Manual transaction entry and shared UI
├── Sidebar.js        # Modular sidebar with active route highlighting

pages/api/
├── upload/           # Bulk ingestion endpoint
├── clients/          # Manual transaction entry
├── founder-override  # Founder-only access override

prisma/
├── schema.prisma     # Full schema with audit logs, exports, forecasts
├── migrations/       # Timestamped migration history
├── seed.ts           # Bootstrap founder + client

scripts/
├── seed.mjs          # CLI seed script
├── uploads-test.mjs  # Multipart ingestion test
├── testPrisma.js     # Statement probe
├── deploy.ts         # Snapshot, migrate, seed, and log deploys
```

---

## 🧬 Schema Highlights

- `ExportJob`: Tracks export status and download URLs
- `ForecastSnapshot`: Persists simulations for audit and review
- `Reconciliation`: Tags and matches transactions for review
- `AuditLog`: Logs every override, ingestion, and export
- `Subscription`: Stripe-linked status and plan metadata

---

## 🛠️ Dev Commands

```bash
npm run dev           # Start local dev server
npm run seed          # Seed founder + client
npm run migrate       # Apply migrations
npm run generate      # Generate Prisma client
npm run typecheck     # Type safety check
npm run lint          # Lint codebase
```

---

## 🧪 Testing Tools

- `uploads-test.mjs`: Simulates ingestion with `x-client-id`
- `testPrisma.js`: Verifies statement visibility
- `seed.mjs`: Idempotent founder bootstrapping
- `deploy.ts`: Applies migrations, seeds, and logs deploy events

---

## 🔐 Supabase Integration

- Row-level security enabled on `statements`  
  ```sql
  ALTER TABLE statements ENABLE ROW LEVEL SECURITY;
  CREATE POLICY "Allow read access to public" ON statements FOR SELECT USING (true);
  ```
- Ready for scoped ingestion, secure downloads, and audit overlays

# Payments Service (Isolated) — FastAPI + CyberSource (Visa) Sandbox

This is a fully isolated payments backend that you can run alongside your main app without touching existing code. It will expose HTTP endpoints for:
- Deposits (card top‑ups) via Visa CyberSource (sandbox)
- Internal P2P transfers using a double‑entry ledger
- Balance and transaction history

Nothing here modifies your teammates’ code until you decide to integrate by calling these endpoints from your main app.

## Features and plan

Phase 1 (scaffold)
- FastAPI app with CORS and health/config routes
- Separate dependencies and environment variables

Phase 2 (wallet + transfers)
- SQLite database with tables: users, accounts, ledger_entries, idempotency
- Double‑entry transfers with idempotency and limits

Phase 3 (CyberSource deposits)
- Flex Microform (frontend) → token
- Backend Payments API (auth+capture) on sandbox
- Credit in‑app ledger on ACCEPT

## Prerequisites

- Python 3.10+ recommended
- CyberSource Sandbox account (for later):
  - merchantId, keyId, sharedSecret (HTTP Signature) OR JWT
- No need to touch your main backend or frontend to run this service

## Quick start

1) Create and activate a virtual environment
- macOS/Linux:
  python3 -m venv .venv
  source .venv/bin/activate
- Windows (PowerShell):
  py -3 -m venv .venv
  .venv\Scripts\Activate.ps1

2) Install dependencies
- From repo root:
  pip install -r payments/requirements.txt

3) Configure environment
- Copy sample env and edit values as needed (keep in repo root):
  cp payments/.env.sample payments/.env
- For now you can leave CyberSource keys empty; we will wire those later.

4) Run the service (port 8001)
- From repo root:
  uvicorn payments.main:app --reload --port 8001

5) Verify
- Health: http://localhost:8001/health
- Config: http://localhost:8001/config

## Configuration (.env)

Edit `payments/.env` (created from `.env.sample`):

- PAYMENTS_CURRENCY=USD
- PAYMENTS_MAX_TX_CENTS=50000  # $500 limit
- DATABASE_URL=sqlite:///payments/payments.db
- CYBERSOURCE_* for sandbox (fill later)

Note: Keep `.env` out of version control.

## API surface (initial)

- GET /health → status + service info
- GET /config → currency and max transaction settings

Planned:
- POST /accounts/:id/deposit
  - Body (CyberSource): { amountCents, currency, flexToken }
  - On ACCEPT → credit ledger entry and return new balance
- POST /transfers
  - Body: { fromAccountId, toAccountId, amountCents, currency }
  - Atomic double‑entry with idempotency
- GET /accounts/:id
  - Returns current balance + summary
- GET /transactions?accountId=...&limit=...
  - Returns recent ledger entries (posted/pending)

## Data model (planned)

- users: id, email, created_at
- accounts: id, user_id (FK), created_at
- ledger_entries:
  - id, account_id (FK), type [deposit, transfer_in, transfer_out, adjustment],
  - amount_cents (int), currency, status [pending, posted, failed],
  - transfer_group_id (nullable), related_entry_id (nullable), created_at
- Optional cached balance on accounts (balance_cents)

## Idempotency and limits

- Require Idempotency-Key for deposit/transfer
- Enforce:
  - currency == USD
  - amount > 0 and <= 50000 cents
- Return consistent results on duplicate requests

## CyberSource integration (high level steps)

Frontend (later):
- Use Flex Microform to tokenize card → `flexToken`
- Send { amountCents, currency, flexToken } to backend

Backend:
- Call CyberSource Payments API (auth+capture) using sandbox credentials
- On decision == ACCEPT → post credit to ledger
- Return updated balance

Sandbox setup:
- Create CyberSource sandbox account
- Generate REST keys (HTTP Signature) or JWT credentials
- Use test Visa card numbers from CyberSource docs

## Security and compliance note

- This is a hackathon demo; all funds are virtual demo credits.
- Do not store PAN/CVV or handle raw card data. Use Flex Microform tokenization.
- Keep credentials in `.env` and never commit them.

## Integration guidance (later)

- From your main app, call these endpoints via HTTP.
- No need to import this service’s code.
- Once stable, we can add a thin client or API wrapper for your frontend/backend.

## Troubleshooting

- If SQLite “database is locked”: we’ll add transactions and simple in‑process locks around critical sections.
- If CORS blocks requests during local testing, adjust allowed origins in `payments/main.py` or `.env`.

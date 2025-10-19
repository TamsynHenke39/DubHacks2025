# Payments Service (Isolated) - FastAPI
# How to run (from repo root):
#   uvicorn payments.main:app --reload --port 8001
#
# Notes:
# - This service is isolated from the rest of the codebase.
# - Currency defaults to USD; max transaction defaults to $500 (50_000 cents).
# - DB schema is initialized on startup. CyberSource deposit wiring will be added next.

from __future__ import annotations

import datetime as dt
import uuid
from typing import List, Optional

from fastapi import FastAPI, Depends, HTTPException, Header, Query
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError

import stripe
from pydantic import BaseModel

from payments.config import SETTINGS
from payments.db import (
    init_db,
    get_db,
    User,
    Account,
    LedgerEntry,
    IdempotencyKey,
    begin_immediate,
    enforce_currency_and_limits,
    now_utc,
)
from payments.schemas import (
    AccountCreateRequest,
    AccountCreateResponse,
    AccountResponse,
    TransferRequest,
    TransferResponse,
    Transaction,
    TransactionsResponse,
    DepositRequest,
    DepositResponse,
)

# Allow local dev origins; adjust as needed or set PAYMENTS_CORS_ALLOWED_ORIGINS in .env
DEFAULT_ORIGINS: List[str] = [
    "http://localhost:5173",  # Vite default
    "http://127.0.0.1:5173",
    "http://localhost:3000",
    "http://127.0.0.1:3000",
    "http://localhost:8000",
    "http://127.0.0.1:8000",
]

effective_origins: List[str] = (
    SETTINGS.cors_allowed_origins if SETTINGS.cors_allowed_origins else DEFAULT_ORIGINS
)

app = FastAPI(
    title="Payments Service (Isolated)",
    version=SETTINGS.service_version,
    description="Isolated payments backend for wallet top-ups and transfers (to be integrated later).",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=effective_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("startup")
def on_startup() -> None:
    # Initialize SQLite schema (hackathon-friendly; no migrations)
    init_db()
    # Configure Stripe if a secret is provided
    if SETTINGS.stripe_secret_key:
        stripe.api_key = SETTINGS.stripe_secret_key


@app.get("/health")
def health():
    return {
        "status": "ok",
        "service": SETTINGS.service_name,
        "version": SETTINGS.service_version,
    }


@app.get("/config")
def config():
    return {
        "currency": SETTINGS.currency,
        "maxTransactionCents": SETTINGS.max_tx_cents,
        "corsAllowedOrigins": effective_origins,
        "cybersource": {
            "environment": SETTINGS.cybersource_environment,
            "authType": SETTINGS.cybersource_auth_type,
            "merchantConfigured": bool(SETTINGS.cybersource_merchant_id)
            and bool(SETTINGS.cybersource_key_id)
            and bool(SETTINGS.cybersource_shared_secret),
        },
        "notes": "Runtime settings are loaded from payments/.env when present.",
    }


@app.get("/")
def root():
    return {
        "message": "Payments service is running. See /health and /config.",
        "nextSteps": [
            "Integrate CyberSource deposits (sandbox) and credit ledger on ACCEPT",
            "Expose deposit endpoint (with Flex token) and idempotency",
        ],
    }


# ===== Accounts =====

@app.post("/accounts", response_model=AccountCreateResponse)
def create_account(req: AccountCreateRequest, db: Session = Depends(get_db)):
    # Create or reuse user by email
    user = db.execute(select(User).where(User.email == req.email)).scalar_one_or_none()
    if not user:
        user = User(email=req.email, name=req.name)
        db.add(user)
        db.flush()  # get user.id

    # Create or reuse USD account for this user
    account = (
        db.execute(
            select(Account).where(Account.user_id == user.id, Account.currency == SETTINGS.currency)
        ).scalar_one_or_none()
    )
    if not account:
        account = Account(user_id=user.id, currency=SETTINGS.currency, balance_cents=0)
        db.add(account)
        db.flush()

    return AccountCreateResponse(
        userId=user.id,
        accountId=account.id,
        currency=account.currency,
        balanceCents=account.balance_cents,
    )


@app.get("/accounts/{account_id}", response_model=AccountResponse)
def get_account(account_id: int, db: Session = Depends(get_db)):
    account = db.get(Account, account_id)
    if not account:
        raise HTTPException(status_code=404, detail="Account not found")
    return AccountResponse(
        userId=account.user_id,
        accountId=account.id,
        currency=account.currency,
        balanceCents=account.balance_cents,
    )


# ===== Transactions =====

@app.get("/transactions", response_model=TransactionsResponse)
def get_transactions(
    accountId: int = Query(..., description="Account ID"),
    limit: int = Query(20, ge=1, le=100, description="Max number of transactions to return"),
    db: Session = Depends(get_db),
):
    account = db.get(Account, accountId)
    if not account:
        raise HTTPException(status_code=404, detail="Account not found")

    rows = (
        db.query(LedgerEntry)
        .filter(LedgerEntry.account_id == accountId)
        .order_by(LedgerEntry.created_at.desc())
        .limit(limit)
        .all()
    )

    items: List[Transaction] = []
    for r in rows:
        items.append(
            Transaction(
                id=r.id,
                accountId=r.account_id,
                type=r.type,
                status=r.status,
                amountCents=r.amount_cents,
                currency=r.currency,
                transferGroupId=r.transfer_group_id,
                relatedEntryId=r.related_entry_id,
                createdAt=r.created_at.replace(tzinfo=dt.timezone.utc).isoformat().replace("+00:00", "Z"),
            )
        )
    return TransactionsResponse(accountId=accountId, items=items)


# ===== Transfers (internal, double-entry) =====

def _load_account_or_404(db: Session, account_id: int) -> Account:
    acct = db.get(Account, account_id)
    if not acct:
        raise HTTPException(status_code=404, detail=f"Account {account_id} not found")
    return acct


def _upsert_idempotency(
    db: Session,
    route: str,
    key: str,
    user_id: Optional[int],
    result_ref: Optional[str],
) -> IdempotencyKey:
    ttl = SETTINGS.idempotency_ttl_seconds
    now = now_utc()
    expires = now + dt.timedelta(seconds=ttl) if ttl and ttl > 0 else None

    # Try insert; on conflict, fetch existing
    idk = IdempotencyKey(
        key=key,
        route=route,
        user_id=user_id,
        result_ref=result_ref,
        created_at=now,
        last_seen_at=now,
        expires_at=expires,
    )
    db.add(idk)
    try:
        db.flush()
        return idk
    except IntegrityError:
        db.rollback()
        # Fetch existing and return
        existing = (
            db.execute(
                select(IdempotencyKey).where(
                    IdempotencyKey.key == key,
                    IdempotencyKey.route == route,
                )
            ).scalar_one_or_none()
        )
        if not existing:
            raise
        # Update last_seen
        existing.last_seen_at = now
        db.flush()
        return existing


@app.post("/transfers", response_model=TransferResponse)
def create_transfer(
    req: TransferRequest,
    db: Session = Depends(get_db),
    idempotency_key: Optional[str] = Header(default=None, alias="Idempotency-Key"),
):
    # Validate inputs
    enforce_currency_and_limits(req.amountCents, req.currency)

    from_acct = _load_account_or_404(db, req.fromAccountId)
    to_acct = _load_account_or_404(db, req.toAccountId)

    if from_acct.currency != SETTINGS.currency or to_acct.currency != SETTINGS.currency:
        raise HTTPException(status_code=400, detail="Accounts must be in service currency")

    if from_acct.id == to_acct.id:
        raise HTTPException(status_code=400, detail="Cannot transfer to the same account")

    route_name = "POST /transfers"

    # Idempotency: if key exists and has a result_ref (group id), return the prior result
    if idempotency_key:
        existing = (
            db.execute(
                select(IdempotencyKey).where(
                    IdempotencyKey.key == idempotency_key,
                    IdempotencyKey.route == route_name,
                )
            ).scalar_one_or_none()
        )
        if existing and existing.result_ref:
            # Compute current balances (should already reflect prior transfer)
            return TransferResponse(
                transferGroupId=existing.result_ref,
                fromBalanceCents=from_acct.balance_cents,
                toBalanceCents=to_acct.balance_cents,
            )

    # Perform atomic double-entry
    begin_immediate(db)

    # Re-check funds under transaction
    db.refresh(from_acct)
    db.refresh(to_acct)

    if from_acct.balance_cents < req.amountCents:
        raise HTTPException(status_code=402, detail="Insufficient funds")

    group_id = str(uuid.uuid4())

    # Debit source
    debit = LedgerEntry(
        account_id=from_acct.id,
        type="transfer_out",
        status="posted",
        amount_cents=req.amountCents,
        currency=SETTINGS.currency,
        transfer_group_id=group_id,
    )
    from_acct.balance_cents = from_acct.balance_cents - req.amountCents

    # Credit destination
    credit = LedgerEntry(
        account_id=to_acct.id,
        type="transfer_in",
        status="posted",
        amount_cents=req.amountCents,
        currency=SETTINGS.currency,
        transfer_group_id=group_id,
    )
    to_acct.balance_cents = to_acct.balance_cents + req.amountCents

    db.add_all([debit, credit])

    # Record idempotency (after creating group id)
    if idempotency_key:
        _upsert_idempotency(
            db=db,
            route=route_name,
            key=idempotency_key,
            user_id=from_acct.user_id,
            result_ref=group_id,
        )

    # Commit transaction
    db.commit()

    # Return new balances
    return TransferResponse(
        transferGroupId=group_id,
        fromBalanceCents=from_acct.balance_cents,
        toBalanceCents=to_acct.balance_cents,
    )

# ===== Deposits =====

@app.post("/accounts/{account_id}/deposit", response_model=DepositResponse)
def deposit(
    account_id: int,
    req: DepositRequest,
    db: Session = Depends(get_db),
    idempotency_key: Optional[str] = Header(default=None, alias="Idempotency-Key"),
):
    # Validate amount and currency against service settings
    enforce_currency_and_limits(req.amountCents, req.currency)

    account = db.get(Account, account_id)
    if not account:
        raise HTTPException(status_code=404, detail="Account not found")
    if account.currency != SETTINGS.currency:
        raise HTTPException(status_code=400, detail="Account currency mismatch")

    # Use account-specific route value to scope idempotency safely
    route_name = f"POST /accounts/{account_id}/deposit"

    # Idempotency check: return previous result if exists
    if idempotency_key:
        existing = (
            db.execute(
                select(IdempotencyKey).where(
                    IdempotencyKey.key == idempotency_key,
                    IdempotencyKey.route == route_name,
                )
            ).scalar_one_or_none()
        )
        if existing and existing.result_ref:
            try:
                txn_id = int(existing.result_ref)
            except ValueError:
                txn_id = 0
            return DepositResponse(
                transactionId=txn_id,
                newBalanceCents=account.balance_cents,
            )

    # For now, simulate deposit unless CyberSource is wired
    if not req.simulate:
        # Future path: use req.flexToken with CyberSource Payments API (auth+capture)
        # and only credit on decision == "ACCEPT"
        raise HTTPException(status_code=501, detail="CyberSource deposit not implemented yet; set simulate=true")

    # Atomic update for SQLite
    begin_immediate(db)
    db.refresh(account)

    entry = LedgerEntry(
        account_id=account.id,
        type="deposit",
        status="posted",
        amount_cents=req.amountCents,
        currency=SETTINGS.currency,
    )
    account.balance_cents = account.balance_cents + req.amountCents
    db.add(entry)
    db.flush()  # get entry.id

    if idempotency_key:
        _upsert_idempotency(
            db=db,
            route=route_name,
            key=idempotency_key,
            user_id=account.user_id,
            result_ref=str(entry.id),
        )

    db.commit()

    return DepositResponse(transactionId=entry.id, newBalanceCents=account.balance_cents)

# ===== Stripe (test mode) Integration =====
class CreatePIRequest(BaseModel):
    amountCents: int
    currency: str = "USD"


class CreatePIResponse(BaseModel):
    clientSecret: str
    paymentIntentId: str


class StripeDepositRequest(BaseModel):
    paymentIntentId: str
    amountCents: int
    currency: str = "USD"


@app.post("/stripe/create-payment-intent", response_model=CreatePIResponse)
def stripe_create_payment_intent(
    req: CreatePIRequest,
    idempotency_key: Optional[str] = Header(default=None, alias="Idempotency-Key"),
):
    if not SETTINGS.stripe_secret_key:
        raise HTTPException(status_code=501, detail="Stripe not configured on server")

    # Validate inputs
    enforce_currency_and_limits(req.amountCents, req.currency)

    # Create PaymentIntent in Stripe (test mode)
    try:
        kwargs = {
            "amount": int(req.amountCents),
            "currency": req.currency.lower(),
            "automatic_payment_methods": {"enabled": True},
        }
        if idempotency_key:
            pi = stripe.PaymentIntent.create(**kwargs, idempotency_key=idempotency_key)
        else:
            pi = stripe.PaymentIntent.create(**kwargs)
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Stripe PI create error: {str(e)}")

    client_secret = getattr(pi, "client_secret", None)
    if not client_secret:
        raise HTTPException(status_code=400, detail="Stripe did not return a client_secret")

    return CreatePIResponse(clientSecret=client_secret, paymentIntentId=pi["id"])


@app.post("/accounts/{account_id}/deposit/stripe", response_model=DepositResponse)
def stripe_deposit_credit(
    account_id: int,
    req: StripeDepositRequest,
    db: Session = Depends(get_db),
    idempotency_key: Optional[str] = Header(default=None, alias="Idempotency-Key"),
):
    if not SETTINGS.stripe_secret_key:
        raise HTTPException(status_code=501, detail="Stripe not configured on server")

    # Validate currency/amount against service limits
    enforce_currency_and_limits(req.amountCents, req.currency)

    # Load account
    account = db.get(Account, account_id)
    if not account:
        raise HTTPException(status_code=404, detail="Account not found")
    if account.currency != SETTINGS.currency:
        raise HTTPException(status_code=400, detail="Account currency mismatch")

    route_name = f"POST /accounts/{account_id}/deposit/stripe"

    # Idempotency: return previous result if exists
    if idempotency_key:
        existing = (
            db.execute(
                select(IdempotencyKey).where(
                    IdempotencyKey.key == idempotency_key,
                    IdempotencyKey.route == route_name,
                )
            ).scalar_one_or_none()
        )
        if existing and existing.result_ref:
            try:
                txn_id = int(existing.result_ref)
            except ValueError:
                txn_id = 0
            return DepositResponse(transactionId=txn_id, newBalanceCents=account.balance_cents)

    # Retrieve the PaymentIntent from Stripe and verify it succeeded and matches amount/currency
    try:
        pi = stripe.PaymentIntent.retrieve(req.paymentIntentId)
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Stripe PI retrieve error: {str(e)}")

    status = getattr(pi, "status", None)
    amount_received = getattr(pi, "amount_received", None)
    currency = getattr(pi, "currency", None)

    # For Payment Element with automatic_payment_methods, on successful confirmation status should be 'succeeded'
    if status != "succeeded":
        raise HTTPException(status_code=402, detail=f"PaymentIntent not succeeded (status={status})")

    # Stripe reports amounts in the smallest currency unit (cents)
    if amount_received is None or int(amount_received) != int(req.amountCents):
        raise HTTPException(
            status_code=400, detail=f"Amount mismatch: expected {req.amountCents}, got {amount_received}"
        )
    if not currency or currency.upper() != SETTINGS.currency:
        raise HTTPException(
            status_code=400, detail=f"Currency mismatch: expected {SETTINGS.currency}, got {currency}"
        )

    # Credit ledger atomically
    begin_immediate(db)
    db.refresh(account)

    entry = LedgerEntry(
        account_id=account.id,
        type="deposit",
        status="posted",
        amount_cents=req.amountCents,
        currency=SETTINGS.currency,
    )
    account.balance_cents = account.balance_cents + req.amountCents
    db.add(entry)
    db.flush()

    if idempotency_key:
        _upsert_idempotency(
            db=db,
            route=route_name,
            key=idempotency_key,
            user_id=account.user_id,
            result_ref=str(entry.id),
        )

    db.commit()

    return DepositResponse(transactionId=entry.id, newBalanceCents=account.balance_cents)

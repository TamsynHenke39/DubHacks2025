# payments/schemas.py
# Pydantic models for request/response payloads

from __future__ import annotations
from typing import List, Optional
from pydantic import BaseModel, Field


# ---- Accounts ----

class AccountCreateRequest(BaseModel):
    email: str = Field(..., description="User email; if user doesn't exist, it will be created")
    name: Optional[str] = Field(None, description="Optional display name")


class AccountCreateResponse(BaseModel):
    userId: int
    accountId: int
    currency: str
    balanceCents: int


class AccountResponse(BaseModel):
    userId: int
    accountId: int
    currency: str
    balanceCents: int


# ---- Transfers ----

class TransferRequest(BaseModel):
    fromAccountId: int
    toAccountId: int
    amountCents: int
    currency: str = "USD"


class TransferResponse(BaseModel):
    transferGroupId: str
    fromBalanceCents: int
    toBalanceCents: int


# ---- Deposits ----

class DepositRequest(BaseModel):
    amountCents: int
    currency: str = "USD"
    # For CyberSource Flex Microform (future wiring)
    flexToken: Optional[str] = None
    # For hackathon: default to simulate deposits until CyberSource is wired
    simulate: Optional[bool] = True


class DepositResponse(BaseModel):
    transactionId: int
    newBalanceCents: int


# ---- Transactions ----

class Transaction(BaseModel):
    id: int
    accountId: int
    type: str
    status: str
    amountCents: int
    currency: str
    transferGroupId: Optional[str] = None
    relatedEntryId: Optional[int] = None
    createdAt: str


class TransactionsResponse(BaseModel):
    accountId: int
    items: List[Transaction]

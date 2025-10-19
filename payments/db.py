# payments/db.py
# SQLite + SQLAlchemy setup and core data models for the isolated payments service.

from __future__ import annotations

import datetime as dt
from typing import Generator, Optional

from sqlalchemy import (
    create_engine,
    Column,
    Integer,
    String,
    DateTime,
    ForeignKey,
    BigInteger,
    Index,
    UniqueConstraint,
    event,
    text,
)
from sqlalchemy.orm import declarative_base, relationship, sessionmaker, Session

from payments.config import SETTINGS

# Determine if we are using SQLite; needed for thread options and pragmas
IS_SQLITE = SETTINGS.database_url.startswith("sqlite")

engine = create_engine(
    SETTINGS.database_url,
    connect_args={"check_same_thread": False} if IS_SQLITE else {},
    pool_pre_ping=True,
)

# Ensure SQLite enforces foreign key constraints
if IS_SQLITE:
    @event.listens_for(engine, "connect")
    def set_sqlite_pragma(dbapi_connection, connection_record):
        cursor = dbapi_connection.cursor()
        cursor.execute("PRAGMA foreign_keys=ON")
        cursor.close()

SessionLocal = sessionmaker(bind=engine, autoflush=False, autocommit=False, expire_on_commit=False)
Base = declarative_base()


# ============ Models ============

class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, autoincrement=True)
    email = Column(String(255), unique=True, nullable=False, index=True)
    name = Column(String(255), nullable=True)
    created_at = Column(DateTime, nullable=False, default=dt.datetime.utcnow)

    accounts = relationship("Account", back_populates="user", cascade="all, delete-orphan")


class Account(Base):
    __tablename__ = "accounts"

    id = Column(Integer, primary_key=True, autoincrement=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    # Cached balance for performance; source of truth is the ledger
    balance_cents = Column(BigInteger, nullable=False, default=0)
    currency = Column(String(8), nullable=False, default="USD")
    created_at = Column(DateTime, nullable=False, default=dt.datetime.utcnow)

    user = relationship("User", back_populates="accounts")
    ledger_entries = relationship("LedgerEntry", back_populates="account", cascade="all, delete-orphan")

    __table_args__ = (
        # One currency per account (kept simple for hackathon)
        Index("ix_accounts_user_currency", "user_id", "currency"),
    )


class LedgerEntry(Base):
    __tablename__ = "ledger_entries"

    id = Column(Integer, primary_key=True, autoincrement=True)
    account_id = Column(Integer, ForeignKey("accounts.id", ondelete="CASCADE"), nullable=False, index=True)

    # Types: deposit, transfer_in, transfer_out, adjustment
    type = Column(String(32), nullable=False)

    # Status: pending, posted, failed
    status = Column(String(16), nullable=False, default="posted")

    amount_cents = Column(BigInteger, nullable=False)  # positive integer
    currency = Column(String(8), nullable=False, default="USD")

    # Group to link double-entry transfers (same for debit and credit pair)
    transfer_group_id = Column(String(64), nullable=True, index=True)

    # Optional back-link (e.g., credit references its debit)
    related_entry_id = Column(Integer, ForeignKey("ledger_entries.id", ondelete="SET NULL"), nullable=True)

    created_at = Column(DateTime, nullable=False, default=dt.datetime.utcnow)

    account = relationship("Account", back_populates="ledger_entries")
    related_entry = relationship("LedgerEntry", remote_side=[id])

    __table_args__ = (
        Index("ix_ledger_account_created", "account_id", "created_at"),
    )


class IdempotencyKey(Base):
    __tablename__ = "idempotency_keys"

    id = Column(Integer, primary_key=True, autoincrement=True)
    key = Column(String(128), nullable=False)
    route = Column(String(128), nullable=False)
    # Optional scoping fields (helpful to avoid collisions)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    # Store either resulting transaction/group id or a hash of the response payload
    result_ref = Column(String(128), nullable=True)

    created_at = Column(DateTime, nullable=False, default=dt.datetime.utcnow)
    last_seen_at = Column(DateTime, nullable=False, default=dt.datetime.utcnow)
    expires_at = Column(DateTime, nullable=True)

    __table_args__ = (
        UniqueConstraint("key", "route", name="uq_idempotency_key_route"),
        Index("ix_idemp_expires", "expires_at"),
    )


# ============ Utilities ============

def init_db() -> None:
    """
    Create tables if they do not exist.
    This is sufficient for a hackathon; for production, use migrations.
    """
    Base.metadata.create_all(bind=engine)


def get_db() -> Generator[Session, None, None]:
    """
    FastAPI dependency to provide a SQLAlchemy session.
    """
    db: Session = SessionLocal()
    try:
        yield db
        db.commit()
    except Exception:
        db.rollback()
        raise
    finally:
        db.close()


def now_utc() -> dt.datetime:
    return dt.datetime.utcnow()


def begin_immediate(db: Session) -> None:
    """
    For SQLite concurrency, an immediate transaction prevents write races.
    Safe to call on other DBs (no-op), but we wrap with dialect check.
    """
    if IS_SQLITE:
        db.execute(text("BEGIN IMMEDIATE"))


def enforce_currency_and_limits(amount_cents: int, currency: str) -> None:
    """
    Validate currency and max transaction cap from SETTINGS.
    """
    if currency != SETTINGS.currency:
        raise ValueError(f"Unsupported currency: {currency} (expected {SETTINGS.currency})")
    if amount_cents <= 0 or amount_cents > SETTINGS.max_tx_cents:
        raise ValueError(
            f"Invalid amount: {amount_cents} (must be 1..{SETTINGS.max_tx_cents} cents)"
        )

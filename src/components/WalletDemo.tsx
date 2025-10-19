import { useMemo, useState } from "react";
import {
  createAccount,
  getAccount,
  getTransactions,
  depositSimulate,
  transfer,
  makeIdempotencyKey,
  stripeCreatePaymentIntent,
  stripeDepositCredit,
  type AccountCreateResponse,
  type AccountResponse,
  type TransactionItem,
} from "../lib/payments";

import { loadStripe } from "@stripe/stripe-js";
import { Elements, PaymentElement, useElements, useStripe } from "@stripe/react-stripe-js";

const stripePromise = import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY
  ? loadStripe(import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY)
  : null;

function fmtUSD(cents: number | null | undefined) {
  if (cents == null) return "$0.00";
  return `$${(cents / 100).toFixed(2)}`;
}

function StripeDepositForm(props: {
  accountId: number;
  amountCents: number;
  onCredited: (newBalanceCents: number) => void;
  onError: (msg: string) => void;
}) {
  const { accountId, amountCents, onCredited, onError } = props;
  const stripe = useStripe();
  const elements = useElements();
  const [busy, setBusy] = useState(false);

  async function handleConfirm() {
    if (!stripe || !elements) {
      onError("Stripe not ready yet. Please try again.");
      return;
    }
    setBusy(true);
    try {
      // Confirm the payment with the Payment Element UI
      const { error, paymentIntent } = await stripe.confirmPayment({
        elements,
        // Provide a return URL; for test mode we'll stay on page (Stripe may not redirect if not required)
        confirmParams: {
          return_url: window.location.href,
        },
        redirect: "if_required",
      } as any);

      if (error) {
        onError(error.message || "Stripe confirmation failed");
        setBusy(false);
        return;
      }

      const piId = paymentIntent?.id;
      const status = paymentIntent?.status;

      if (!piId) {
        onError("Missing PaymentIntent ID after confirmation");
        setBusy(false);
        return;
      }
      if (status !== "succeeded") {
        onError(`Payment not succeeded (status=${status})`);
        setBusy(false);
        return;
      }

      // Tell our server to credit the wallet (verify PI and post ledger)
      const key = makeIdempotencyKey();
      const res = await stripeDepositCredit(accountId, piId, amountCents, key);
      onCredited(res.newBalanceCents);
    } catch (e: any) {
      onError(e?.message ?? String(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div style={{ display: "grid", gap: 8 }}>
      <PaymentElement />
      <button onClick={handleConfirm} disabled={busy} style={{ padding: "8px 14px" }}>
        {busy ? "Processing..." : "Confirm Payment"}
      </button>
    </div>
  );
}

export default function WalletDemo() {
  // Sender (you)
  const [email, setEmail] = useState("alice@example.com");
  const [name, setName] = useState("Alice");
  const [account, setAccount] = useState<AccountResponse | null>(null);

  // Transactions
  const [txns, setTxns] = useState<TransactionItem[]>([]);

  // Deposit form (shared amount)
  const [depositAmount, setDepositAmount] = useState("5000"); // cents (default $50)
  const [useStripeUI, setUseStripeUI] = useState(false);
  const [depositBusy, setDepositBusy] = useState(false);

  // Stripe client secret state (for Payment Element)
  const [clientSecret, setClientSecret] = useState<string | null>(null);

  // Transfer form — by recipient email
  const [recipientEmail, setRecipientEmail] = useState("bob@example.com");
  const [transferAmount, setTransferAmount] = useState("1000"); // cents ($10)
  const [transferBusy, setTransferBusy] = useState(false);

  // Status/error
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const hasAccount = useMemo(() => !!account?.accountId, [account]);

  async function refreshAccount(accId: number) {
    const a = await getAccount(accId);
    setAccount(a);
  }

  async function refreshTransactions(accId: number) {
    const t = await getTransactions(accId, 20);
    setTxns(t.items ?? []);
  }

  async function handleCreateOrFetch() {
    setStatus(null);
    setError(null);
    try {
      const res: AccountCreateResponse = await createAccount(email, name);
      const acc: AccountResponse = {
        userId: res.userId,
        accountId: res.accountId,
        currency: res.currency,
        balanceCents: res.balanceCents,
      };
      setAccount(acc);
      await refreshTransactions(res.accountId);
      setStatus(`Ready. Account ${res.accountId} for ${email} loaded.`);
    } catch (e: any) {
      setError(e?.message ?? String(e));
    }
  }

  // Simulated deposit flow
  async function handleDepositSimulate() {
    if (!account) return;
    setStatus(null);
    setError(null);
    setDepositBusy(true);
    try {
      const amountCents = parseInt(depositAmount, 10);
      if (!Number.isFinite(amountCents) || amountCents <= 0) {
        throw new Error("Enter a positive integer amount in cents (e.g., 5000 for $50)");
      }
      const key = makeIdempotencyKey();
      const res = await depositSimulate(account.accountId, amountCents, key);
      await refreshAccount(account.accountId);
      await refreshTransactions(account.accountId);
      setStatus(`Deposit success. Txn ${res.transactionId}. New balance: ${fmtUSD(res.newBalanceCents)}`);
    } catch (e: any) {
      setError(e?.message ?? String(e));
    } finally {
      setDepositBusy(false);
    }
  }

  // Stripe deposit: step 1 create PaymentIntent and render Payment Element (clientSecret)
  async function handleStripeStart() {
    if (!account) return;
    setStatus(null);
    setError(null);
    setDepositBusy(true);
    try {
      if (!stripePromise) {
        throw new Error("Stripe publishable key not configured. Set VITE_STRIPE_PUBLISHABLE_KEY.");
      }
      const amountCents = parseInt(depositAmount, 10);
      if (!Number.isFinite(amountCents) || amountCents <= 0) {
        throw new Error("Enter a positive integer amount in cents (e.g., 5000 for $50)");
      }
      // Create PI on server
      const key = makeIdempotencyKey();
      const { clientSecret, paymentIntentId } = await stripeCreatePaymentIntent(amountCents, key);
      if (!clientSecret) {
        throw new Error("Server did not return clientSecret");
      }
      setClientSecret(clientSecret);
      setStatus("Payment Element ready. Enter test card (e.g., 4242 4242 4242 4242). Then click Confirm Payment.");
    } catch (e: any) {
      setError(e?.message ?? String(e));
    } finally {
      setDepositBusy(false);
    }
  }

  async function onStripeCredited(newBalanceCents: number) {
    if (!account) return;
    await refreshAccount(account.accountId);
    await refreshTransactions(account.accountId);
    setStatus(`Stripe deposit success. New balance: ${fmtUSD(newBalanceCents)}`);
    setClientSecret(null);
  }

  // Transfer by recipient email
  async function handleTransfer() {
    if (!account) return;
    setStatus(null);
    setError(null);
    setTransferBusy(true);
    try {
      if (!recipientEmail || !recipientEmail.includes("@")) {
        throw new Error("Enter a valid recipient email");
      }
      const amountCents = parseInt(transferAmount, 10);
      if (!Number.isFinite(amountCents) || amountCents <= 0) {
        throw new Error("Enter a positive amountCents");
      }
      // Auto create/lookup recipient by email
      const recip: AccountCreateResponse = await createAccount(recipientEmail);
      const toId = recip.accountId;

      const key = makeIdempotencyKey();
      const res = await transfer(account.accountId, toId, amountCents, key);

      await refreshAccount(account.accountId);
      await refreshTransactions(account.accountId);

      setStatus(
        `Transfer success to ${recipientEmail} (acct ${toId}). Group ${res.transferGroupId}. From balance: ${fmtUSD(
          res.fromBalanceCents
        )}. Sent ${fmtUSD(amountCents)}.`
      );
    } catch (e: any) {
      setError(e?.message ?? String(e));
    } finally {
      setTransferBusy(false);
    }
  }

  const paymentsBase = import.meta.env.VITE_PAYMENTS_BASE_URL ?? "http://127.0.0.1:8001";

  return (
    <div style={{ maxWidth: 820, margin: "2rem auto", padding: "1rem" }}>
      <h1>Wallet Demo</h1>
      <p style={{ color: "#666" }}>
        Payments API: {paymentsBase}. Toggle simulate vs. Stripe test card for deposits. Transfers by recipient email.
      </p>

      {/* Create / Fetch Account */}
      <section style={{ border: "1px solid #ddd", padding: "1rem", borderRadius: 8, marginBottom: "1rem" }}>
        <h2 style={{ marginTop: 0 }}>1) Create or Fetch Your Account</h2>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
          <input
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="your email"
            style={{ padding: 8, flex: "1 1 260px" }}
          />
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="your name (optional)"
            style={{ padding: 8, flex: "1 1 200px" }}
          />
          <button onClick={handleCreateOrFetch} style={{ padding: "8px 14px" }}>
            Create/Fetch
          </button>
        </div>

        {hasAccount && (
          <div style={{ marginTop: 8 }}>
            <strong>Account:</strong> #{account!.accountId} • User {account!.userId} • {account!.currency} • Balance{" "}
            {fmtUSD(account!.balanceCents)}
          </div>
        )}
      </section>

      {/* Deposit */}
      <section style={{ border: "1px solid #ddd", padding: "1rem", borderRadius: 8, marginBottom: "1rem" }}>
        <h2 style={{ marginTop: 0 }}>2) Deposit</h2>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center", marginBottom: 8 }}>
          <label style={{ display: "flex", gap: 6, alignItems: "center" }}>
            <input
              type="checkbox"
              checked={useStripeUI}
              onChange={(e) => {
                setUseStripeUI(e.target.checked);
                setClientSecret(null);
                setStatus(null);
                setError(null);
              }}
            />
            Use Stripe (test card)
          </label>

          <input
            value={depositAmount}
            onChange={(e) => setDepositAmount(e.target.value)}
            placeholder="amountCents e.g. 5000"
            style={{ padding: 8, flex: "1 1 200px" }}
          />

          {!useStripeUI ? (
            <button disabled={!hasAccount || depositBusy} onClick={handleDepositSimulate} style={{ padding: "8px 14px" }}>
              {depositBusy ? "Depositing..." : "Deposit (simulate)"}
            </button>
          ) : (
            <button disabled={!hasAccount || depositBusy} onClick={handleStripeStart} style={{ padding: "8px 14px" }}>
              {depositBusy ? "Preparing..." : "Start Stripe Deposit"}
            </button>
          )}
        </div>

        {/* Stripe Payment Element renders below once clientSecret is set */}
        {useStripeUI && clientSecret && stripePromise && hasAccount && (
          <Elements
            stripe={stripePromise}
            options={{
              clientSecret,
              appearance: { theme: "stripe" },
            }}
          >
            <StripeDepositForm
              accountId={account!.accountId}
              amountCents={parseInt(depositAmount || "0", 10) || 0}
              onCredited={(newBalance) => {
                setStatus(`Stripe deposit success. New balance: ${fmtUSD(newBalance)}`);
                setClientSecret(null);
              }}
              onError={(msg) => setError(msg)}
            />
          </Elements>
        )}

        {useStripeUI && !stripePromise && (
          <div style={{ color: "crimson", marginTop: 8 }}>
            Stripe publishable key not configured. Set VITE_STRIPE_PUBLISHABLE_KEY in .env.local and restart Vite.
          </div>
        )}
      </section>

      {/* Transfer by Recipient Email */}
      <section style={{ border: "1px solid #ddd", padding: "1rem", borderRadius: 8, marginBottom: "1rem" }}>
        <h2 style={{ marginTop: 0 }}>3) Transfer to Another User (by Email)</h2>
        <p style={{ color: "#666", marginTop: -8 }}>
          Enter the recipient's email. If they don't have an account yet, one will be created automatically.
        </p>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
          <input
            value={recipientEmail}
            onChange={(e) => setRecipientEmail(e.target.value)}
            placeholder="recipient email e.g. bob@example.com"
            style={{ padding: 8, flex: "1 1 260px" }}
          />
          <input
            value={transferAmount}
            onChange={(e) => setTransferAmount(e.target.value)}
            placeholder="amountCents e.g. 1000"
            style={{ padding: 8, flex: "1 1 180px" }}
          />
          <button disabled={!hasAccount || transferBusy} onClick={handleTransfer} style={{ padding: "8px 14px" }}>
            {transferBusy ? "Transferring..." : "Send"}
          </button>
        </div>
      </section>

      {/* Status/Error */}
      {(status || error) && (
        <div style={{ marginBottom: "1rem" }}>
          {status && <div style={{ color: "green" }}>{status}</div>}
          {error && <div style={{ color: "crimson" }}>{error}</div>}
        </div>
      )}

      {/* Transactions */}
      <section style={{ border: "1px solid #ddd", padding: "1rem", borderRadius: 8 }}>
        <h2 style={{ marginTop: 0 }}>Recent Transactions</h2>
        {!hasAccount && <div>Load or create an account to see transactions.</div>}
        {hasAccount && (
          <div style={{ display: "grid", gap: 6 }}>
            {txns.length === 0 && <div>No transactions yet.</div>}
            {txns.map((t) => (
              <div
                key={t.id}
                style={{
                  border: "1px solid #eee",
                  borderRadius: 6,
                  padding: 8,
                  display: "flex",
                  justifyContent: "space-between",
                }}
              >
                <div>
                  <div style={{ fontWeight: 600 }}>{t.type}</div>
                  <div style={{ color: "#666", fontSize: 12 }}>{new Date(t.createdAt).toLocaleString()}</div>
                </div>
                <div style={{ textAlign: "right" }}>
                  <div>{fmtUSD(t.amountCents)}</div>
                  <div style={{ color: "#666", fontSize: 12 }}>{t.status}</div>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

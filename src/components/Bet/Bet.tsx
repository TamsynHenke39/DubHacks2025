import { useState } from "react";
import BetForm from "./BetForm/BetForm";
import type { Bet } from "../../Bet";

function BetPopUp() {
  const [betAmount, setBetAmount] = useState<number>();
  const [description, setDescription] = useState<string>("");
  const [sender, setSender] = useState<string>("");
  const [recipient, setRecipient] = useState<string>("");
  const [showForm, setShowForm] = useState<boolean>(false);

  const handleSave = async () => {
    if (!betAmount || !description || !sender || !recipient) {
      alert("Please fill out all fields");
      return;
    }

    try {
      const response = await fetch("http://localhost:5000/api/bets/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sender,
          receiver: recipient,
          amount: betAmount,
          description,
        }),
      });

      if (!response.ok)
        throw new Error(`HTTP error! Status: ${response.status}`);

      const data: { status: string; bet: Bet } = await response.json();
      console.log("Bet created successfully:", data);

      // Reset form fields
      setBetAmount(undefined);
      setDescription("");
      setSender("");
      setRecipient("");
      setShowForm(false); // hide form after saving
    } catch (error) {
      console.error("Failed to create bet:", error);
    }
  };

  return (
    <div style={{ position: "relative" }}>
      <button
        id="myBtn"
        type="button"
        className="btn btn-primary btn-lg"
        onClick={() => setShowForm((prev) => !prev)}
        style={{ position: "fixed", bottom: "2rem", right: "2rem" }}
      >
        Place Bet
      </button>

      {showForm && (
        <div
          style={{
            position: "fixed",
            bottom: "6rem",
            right: "2rem",
            width: "320px",
            background: "white",
            border: "1px solid #ccc",
            borderRadius: "8px",
            padding: "1rem",
            boxShadow: "0 4px 12px rgba(0,0,0,0.15)",
            zIndex: 1000,
          }}
        >
          <h5>Place Bet</h5>
          <BetForm
            onAmountChange={setBetAmount}
            onDescriptionChange={setDescription}
            onSenderChange={setSender}
            onRecipientChange={setRecipient}
          />
          <div style={{ marginTop: "1rem", display: "flex", justifyContent: "space-between" }}>
            <button
              className="btn btn-secondary"
              onClick={() => setShowForm(false)}
            >
              Close
            </button>
            <button className="btn btn-primary" onClick={handleSave}>
              Save
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default BetPopUp;

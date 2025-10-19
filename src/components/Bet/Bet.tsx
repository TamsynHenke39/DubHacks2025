import { useState } from "react";
import BetForm from "./BetForm/BetForm";
import type { Bet } from "../../Bet";

interface BetPopUpProps {
  onNewBet?: (bet: Bet) => void; // optional callback
}

function BetPopUp({ onNewBet }: BetPopUpProps) {
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
      console.log("✅ Bet created successfully:", data.bet);

      // ✅ Immediately inform the parent to add it to the list
      if (onNewBet) onNewBet(data.bet);

      // Reset form
      setBetAmount(undefined);
      setDescription("");
      setSender("");
      setRecipient("");
      setShowForm(false);
    } catch (error) {
      console.error("Failed to create bet:", error);
    }
  };

  return (
    <div className="bet-popup">
      <button
        id="myBtn"
        type="button"
        className="btn btn-primary btn-lg neon-button"
        onClick={() => setShowForm((prev) => !prev)}
      >
        Place Bet
      </button>

      {showForm && (
        <div className="bet-popup-form animate-pop">
          <h5 className="popup-title">Place a Bet ✦</h5>
          <BetForm
            onAmountChange={setBetAmount}
            onDescriptionChange={setDescription}
            onSenderChange={setSender}
            onRecipientChange={setRecipient}
          />
          <div className="popup-actions">
            <button className="btn btn-secondary glow-btn" onClick={() => setShowForm(false)}>
              Close
            </button>
            <button className="btn btn-primary glow-btn" onClick={handleSave}>
              Save
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default BetPopUp;

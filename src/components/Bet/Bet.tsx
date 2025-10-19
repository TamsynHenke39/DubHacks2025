import * as bootstrap from "bootstrap";
import { useState } from "react";
import BetForm from "./BetForm/BetForm";
import type { Bet } from "../../Bet";

function BetPopUp() {
  const [betAmount, setBetAmount] = useState<number>();
  const [description, setDescription] = useState<string>();
  const [sender, setSender] = useState<string>();
  const [recipient, setRecipient] = useState<string>();

  const[toggleAnimation, setAnimation] = useState<boolean>(false);


  const handleSave = async () => {

    if (!betAmount || !description || !sender || !recipient) {
      alert("Please fill out all fields");
      return;
    }

    try {
      const response = await fetch("http://localhost:5000/api/bets/create", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          sender: sender,
          receiver: recipient, // spelling corrected
          amount: betAmount,
          description: description,
        }),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! Status: ${response.status}`);
      }

      const data:  { status: string; bet: Bet } = await response.json();
      console.log("Bet created successfully:", data);

      
      const modal = document.getElementById('exampleModal');

      if (modal) {
        const bsModal = bootstrap.Modal.getInstance(modal);
        bsModal?.hide();
      }

      const backdrop = document.querySelector('.modal-backdrop');
      if (backdrop) {
        backdrop.remove();
      }

      // Remove the modal-open class from body
      document.body.classList.remove('modal-open');

      setBetAmount(undefined);
      setDescription("");
      setSender("");
      setRecipient("");

    } catch (error) {
      console.error("Failed to create bet:", error);
    }
  };

  const handleBetClick = () => {
    setAnimation(false);
    void document.getElementById("myBtn")?.offsetWidth; // force reflow
    setAnimation(true);  // trigger animation

  } 

  return (
    <>
      <button
        type="button"
        className={`btn btn-primary btn-lg animate__animated ${toggleAnimation ? "animate__pulse" : ""}`}
        data-bs-toggle="modal"
        data-bs-target="#exampleModal"
        onClick = {handleBetClick}

      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="36"
          height="36"
          fill="currentColor"
          className="bi bi-plus-circle-fill"
          viewBox="0 0 16 16"
        >
          <path d="M16 8A8 8 0 1 1 0 8a8 8 0 0 1 16 0M8.5 4.5a.5.5 0 0 0-1 0v3h-3a.5.5 0 0 0 0 1h3v3a.5.5 0 0 0 1 0v-3h3a.5.5 0 0 0 0-1h-3z" />
        </svg>
      </button>

      {/* Modal */}
      <div
        className="modal fade"
        id="exampleModal"
        aria-labelledby="exampleModalLabel"
        aria-hidden="true"
      >
        <div className="modal-dialog">
          <div className="modal-content">
            <div className="modal-header">
              <h1 className="modal-title fs-5" id="exampleModalLabel" style ={{padding: '1rem'}}>
                Place Bet
              </h1>
              <button
                type="button"
                className="btn-close"
                data-bs-dismiss="modal"
                aria-label="Close"
              ></button>
            </div>
            <div className="modal-body">Time to place a bet!</div>
            <div style={{ padding: "1rem" }}>
              <BetForm
                onAmountChange={setBetAmount}
                onDescriptionChange={setDescription}
                onSenderChange={setSender}
                onRecipientChange={setRecipient}
              />
            </div>
            <div className="modal-footer">
              <button
                type="button"
                className="btn btn-secondary"
                data-bs-dismiss="modal"
              >
                Close
              </button>
              <button
                type="button"
                className="btn btn-primary"
                onClick={handleSave}
              >
                Save changes
              </button>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

export default BetPopUp;

import React from "react";
import type { Bet } from "../../Bet";
import "./Card.css"; // <-- Add this import

interface Props {
  betMap: Bet[];
}

function Card({ betMap }: Props) {
  return (
    <div
      className="d-flex flex-row overflow-auto"
      style={{
        padding: "1rem",
        gap: "1rem",
        scrollBehavior: "smooth",
      }}
    >
      {betMap.map((bet) => (
        <div className="card flex-shrink-0 bet-card" key={bet.id}>
          <div className="card-body">
            <h5 className="card-title">Bet #{bet.id}</h5>
            <p className="card-text">
              <strong>Sender:</strong> {bet.sender} <br />
              <strong>Recipient:</strong> {bet.receiver} <br />
              <strong>Amount:</strong> ${bet.amount} <br />
              <strong>Description:</strong> {bet.description} <br />
              <strong>Status:</strong>{" "}
              <span
                className={`status-text ${
                  bet.status === "pending"
                    ? "status-pending"
                    : bet.status === "accepted"
                    ? "status-accepted"
                    : "status-other"
                }`}
              >
                {bet.status}
              </span>
            </p>

            <div className="d-flex justify-content-between">
              <button className="btn btn-sm glow-btn btn-accept">Accept</button>
              <button className="btn btn-sm glow-btn btn-settle">Settle</button>
              <button className="btn btn-sm glow-btn btn-view">View</button>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

export default Card;

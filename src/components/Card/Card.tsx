import React from "react";
import type { Bet } from "../../Bet";

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
        <div className="card flex-shrink-0" style={{ width: "18rem" }} key={bet.id}>
          <div className="card-body">
            <h5 className="card-title">Bet #{bet.id}</h5>
            <p className="card-text">
              Sender: {bet.sender} <br />
              Recipient: {bet.reciever} <br />
              Amount: ${bet.amount} <br />
              Description: {bet.description} <br />
              Status: {bet.status}
            </p>
            <div className="d-flex justify-content-between">
              <button className="btn btn-primary btn-sm">Accept</button>
              <button className="btn btn-secondary btn-sm">Settle</button>
              <button className="btn btn-info btn-sm">View</button>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

export default Card;

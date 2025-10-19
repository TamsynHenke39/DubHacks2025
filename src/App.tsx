import Navbar from './components/Navbar/Navbar.tsx';
import 'animate.css';
import './App.css';
import BetPopUp from './components/Bet/Bet.tsx';
import { useEffect, useState } from 'react';
import Payment from './pages/Payment.tsx';
import type { Bet } from './Bet.ts';
import Card from './components/Card/Card.tsx';

export type Page = { kind: "Home" } | { kind: "Payment" };

function App() {
  const [page, setPage] = useState<Page>({ kind: "Home" });
  const [betMap, setBetMap] = useState<Bet[]>([]);
  const USERNAME = "alice@email.com";

  useEffect(() => {
    const fetchBets = async () => {
      try {
        const res = await fetch("http://localhost:5000/api/bets");
        if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`);
        const data = await res.json();
        const filtered: Bet[] = data.bets.filter(
          (b: Bet) => b.sender === USERNAME || b.receiver === USERNAME
        );
        setBetMap(filtered);
      } catch (err) {
        console.error("Failed to fetch bets:", err);
      }
    };

    fetchBets();
    const interval = setInterval(fetchBets, 3000);
    return () => clearInterval(interval);
  }, []);

  // ✅ Add this callback to append new bets right away
  const addBet = (newBet: Bet) => {
    setBetMap((prev) => [newBet, ...prev]);
  };

  if (page.kind === "Home") {
    return (
      <>
        <Navbar />
        <h2 style={{ padding: "1rem" }}>My Bets</h2>

        <Card betMap={betMap || []} />

        <div
          style={{
            position: "fixed",
            bottom: "1rem",
            right: "1rem",
            zIndex: 1000,
          }}
        >
          {/* ✅ Pass the addBet callback */}
          <BetPopUp onNewBet={addBet} />
        </div>

        <button onClick={() => setPage({ kind: "Payment" })}>
          Ryan dev button
        </button>
      </>
    );
  } else {
    return <Payment />;
  }
}

export default App;

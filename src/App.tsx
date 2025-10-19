import Navbar from './components/Navbar/Navbar.tsx'
import 'animate.css';
import './App.css'
import BetPopUp from './components/Bet/Bet.tsx'
import { useState } from 'react';
import Payment from './pages/Payment.tsx';
import type { Bet } from './Bet.ts';

export type Page = 
{kind: "Home"} 
| {kind: "Payment"}

function App() {

  const [page, setPage] = useState<Page>({kind: "Home"});
  const [betMap, setBetMap] = useState<Bet[]>();


  //a
  const USERNAME = "alice@email.com";

  if (page.kind == "Home") {

      return (
      <>
        <Navbar></Navbar>
        <h2>Friends</h2>

        <div className = "bet-popup">
          <BetPopUp></BetPopUp>
        </div>

        <button onClick = {() => setPage({kind: "Payment"})}>Ryan dev button</button>
        
      </>
    )
  } else {
    return (
      <Payment></Payment>
    )
  }
}

export default App

// Removed Commenting Test

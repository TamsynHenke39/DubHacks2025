import Navbar from './components/Navbar/Navbar.tsx'
import 'animate.css';
import './App.css'
import BetPopUp from './components/Bet/Bet.tsx'
function App() {
  // const [count, setCount] = useState(0)


  //a
  const USERNAME = "alice@email.com";


  return (
    <>
      <Navbar></Navbar>
      <h2>Friends</h2>

      <div className = "bet-popup">
        <BetPopUp></BetPopUp>
      </div>
      
    </>
  )
}

export default App

// Removed Commenting Test

import { useState } from 'react'
import Navbar from './components/Navbar/Navbar.tsx'
import './App.css'
import reactLogo from './assets/react.svg'
import viteLogo from '/vite.svg'
import type { Bet, Friend } from './Friend.ts'

function App() {
  // const [count, setCount] = useState(0)

  const [friends, setFriends] = useState<Friend[]>();

  const ryanBets: Bet[] = [
    {name: "Lasagna film", amount: 5.00, won: false},
    {name: "playing tennis", amount: 800, won: true},
    {name: "doing homework faster than dylan", amount: 6.49, won: false},
    {name: "grading faster and better than tamsyn", amount: 9.00, won: true},
  ]

  const tamsynBets: Bet[] = [
    {name: "Lasagna film", amount: 5.00, won: false},
    {name: "playing tennis", amount: 800, won: true},
    {name: "doing homework faster than dylan", amount: 6.49, won: false},
    {name: "grading faster and better than tamsyn", amount: 9.00, won: true},
  ]


  const dylanBets: Bet[] = [
    {name: "Lasagna film", amount: 5.00, won: false},
    {name: "playing tennis", amount: 800, won: true},
    {name: "doing homework faster than dylan", amount: 6.49, won: false},
    {name: "grading faster and better than tamsyn", amount: 9.00, won: true},
  ]


  const friendsArray: Friend[] = [
    {name: "Ryan", bets: ryanBets},
    {name: "Dylan", bets: dylanBets},
    {name: "Tamsyn", bets: tamsynBets},
  ]


  return (
    <>
      <Navbar></Navbar>
      <h2>Friends</h2>
    </>
  )
}

export default App

// Removed Commenting Test

import { useState } from 'react'
import reactLogo from './assets/react.svg'
import viteLogo from '/vite.svg'
import Hello from "./test.jsx";
import Home from "./Home.jsx";
import './App.css'

function App() {
  const [count, setCount] = useState(0)

  return (
    <Home />
  )
}

export default App

import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import Showroom from './Showroom'
import './styles.css'

// ?showroom=<type> opens a close-up of one ship model instead of the game.
const showroom = new URLSearchParams(window.location.search).get('showroom')

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>{showroom ? <Showroom type={showroom} /> : <App />}</React.StrictMode>
)

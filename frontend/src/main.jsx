import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'

document.documentElement.classList.add('h-full');
document.body.classList.add('h-full', 'overflow-hidden', 'bg-slate-50', 'text-slate-900', 'font-sans');
const rootEl = document.getElementById('root');
if (rootEl) {
  rootEl.classList.add('h-full');
}

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)

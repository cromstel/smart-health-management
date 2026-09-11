import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { registerSW } from 'virtual:pwa-register'

registerSW({ immediate: true })

// User Timing API: marks when the bootstrap entry begins executing. Later
// marks/measures (app ready, route chunk loads, navigation) are emitted by
// App.tsx / AppLayout so Lighthouse and devtools can surface real timings.
if (typeof performance !== 'undefined') {
  performance.mark('app:bootstrap')
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
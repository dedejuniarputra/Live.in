import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import DashboardRoutes from './routes/DashboardRoutes.tsx'
import ErrorBoundary from './components/common/ErrorBoundary.tsx'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>
      <DashboardRoutes />
    </ErrorBoundary>
  </StrictMode>,
)

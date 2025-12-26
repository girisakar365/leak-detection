import { useState, useEffect } from 'react'
import { Routes, Route, useNavigate } from 'react-router-dom'
import MonitoringSetup from './pages/MonitoringSetup'
import LeakDetection from './pages/LeakDetection'

function App() {
  const [networkData, setNetworkData] = useState(null)
  const [predictionResult, setPredictionResult] = useState(null)
  const navigate = useNavigate()

  // Set dark mode on mount
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', 'dark')
  }, [])

  // Handle successful monitoring completion
  const handleMonitoringComplete = (result) => {
    setPredictionResult(result)
    navigate('/results')
  }

  // Handle going back to monitoring setup
  const handleBackToSetup = () => {
    setPredictionResult(null)
    navigate('/')
  }

  return (
    <div className="app">
      <header className="header">
        <div className="header-title">
          💧 Water Supply Monitoring System
        </div>
      </header>
      
      <main className="main-content">
        <Routes>
          <Route 
            path="/" 
            element={
              <MonitoringSetup 
                networkData={networkData}
                setNetworkData={setNetworkData}
                onMonitoringComplete={handleMonitoringComplete}
              />
            } 
          />
          <Route 
            path="/results" 
            element={
              <LeakDetection 
                networkData={networkData}
                predictionResult={predictionResult}
                onBack={handleBackToSetup}
              />
            } 
          />
        </Routes>
      </main>
    </div>
  )
}

export default App


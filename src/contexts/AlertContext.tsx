"use client"

import React, { createContext, useContext, useState, useCallback, ReactNode } from 'react'
import { Toast, ToastProps } from '@/components/ui/alert'

interface AlertContextType {
  showAlert: (alert: Omit<ToastProps, 'id' | 'onClose'>) => void
  showSuccess: (message: string, title?: string) => void
  showError: (message: string, title?: string) => void
  showWarning: (message: string, title?: string) => void
  showInfo: (message: string, title?: string) => void
}

const AlertContext = createContext<AlertContextType | undefined>(undefined)

export const useAlert = () => {
  const context = useContext(AlertContext)
  if (!context) {
    throw new Error('useAlert must be used within an AlertProvider')
  }
  return context
}

interface AlertProviderProps {
  children: ReactNode
}

interface AlertState extends ToastProps {
  id: string
}

export const AlertProvider: React.FC<AlertProviderProps> = ({ children }) => {
  const [alerts, setAlerts] = useState<AlertState[]>([])

  const removeAlert = useCallback((id: string) => {
    setAlerts(prev => prev.filter(alert => alert.id !== id))
  }, [])

  const showAlert = useCallback((alert: Omit<ToastProps, 'id' | 'onClose'>) => {
    const id = Math.random().toString(36).substr(2, 9)
    const duration = alert.duration || 5000

    const newAlert: AlertState = {
      ...alert,
      id,
      onClose: () => removeAlert(id)
    }

    setAlerts(prev => [...prev, newAlert])

    // Auto-remove after duration
    setTimeout(() => {
      removeAlert(id)
    }, duration)
  }, [removeAlert])

  const showSuccess = useCallback((message: string, title?: string) => {
    showAlert({
      variant: 'success',
      title,
      description: message
    })
  }, [showAlert])

  const showError = useCallback((message: string, title?: string) => {
    showAlert({
      variant: 'error',
      title,
      description: message
    })
  }, [showAlert])

  const showWarning = useCallback((message: string, title?: string) => {
    showAlert({
      variant: 'warning',
      title,
      description: message
    })
  }, [showAlert])

  const showInfo = useCallback((message: string, title?: string) => {
    showAlert({
      variant: 'info',
      title,
      description: message
    })
  }, [showAlert])

  const contextValue: AlertContextType = {
    showAlert,
    showSuccess,
    showError,
    showWarning,
    showInfo
  }

  return (
    <AlertContext.Provider value={contextValue}>
      {children}
      
      {/* Toast Container - Responsive positioning */}
      <div className="fixed inset-0 sm:inset-auto sm:bottom-4 sm:right-4 z-50 flex flex-col items-center justify-center sm:items-end sm:justify-end space-y-2 max-w-sm w-full sm:w-auto pointer-events-none">
        {alerts.map((alert) => (
          <div
            key={alert.id}
            className="animate-in slide-in-from-right-full duration-300 pointer-events-auto"
          >
            <Toast {...alert} />
          </div>
        ))}
      </div>
    </AlertContext.Provider>
  )
}
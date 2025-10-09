"use client"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { useAlert } from "@/contexts/AlertContext"

export default function AlertDemo() {
  const { showSuccess, showError, showWarning, showInfo } = useAlert()

  const handleSuccessAlert = () => {
    showSuccess("This is a success message! Everything went perfectly.", "Success!")
  }

  const handleErrorAlert = () => {
    showError("Something went wrong. Please try again later.", "Error!")
  }

  const handleWarningAlert = () => {
    showWarning("Please check your input before proceeding.", "Warning!")
  }

  const handleInfoAlert = () => {
    showInfo("Here's some helpful information for you.", "Info")
  }

  const handleGameRegistrationSuccess = () => {
    showSuccess("Successfully registered for Basketball, Tennis!", "Registration Successful")
  }

  return (
    <Card className="w-full max-w-md mx-auto bg-slate-800/50 border-slate-700">
      <CardHeader>
        <CardTitle className="text-center text-slate-100">Alert System Demo</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <Button 
          onClick={handleSuccessAlert}
          className="w-full bg-green-600 hover:bg-green-700 text-white"
        >
          Show Success Alert
        </Button>
        
        <Button 
          onClick={handleErrorAlert}
          className="w-full bg-red-600 hover:bg-red-700 text-white"
        >
          Show Error Alert
        </Button>
        
        <Button 
          onClick={handleWarningAlert}
          className="w-full bg-yellow-600 hover:bg-yellow-700 text-white"
        >
          Show Warning Alert
        </Button>
        
        <Button 
          onClick={handleInfoAlert}
          className="w-full bg-blue-600 hover:bg-blue-700 text-white"
        >
          Show Info Alert
        </Button>
        
        <div className="border-t border-slate-600 pt-3">
          <Button 
            onClick={handleGameRegistrationSuccess}
            className="w-full codeninja-gradient text-white"
          >
            Test Game Registration Success
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}
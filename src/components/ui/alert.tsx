import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { X, CheckCircle, AlertCircle, AlertTriangle, Info } from "lucide-react"
import { cn } from "@/lib/utils"

const alertVariants = cva(
  "relative w-full rounded-lg border p-4 [&>svg~*]:pl-7 [&>svg+div]:translate-y-[-3px] [&>svg]:absolute [&>svg]:left-4 [&>svg]:top-4 [&>svg]:text-foreground",
  {
    variants: {
      variant: {
        default: "bg-background text-foreground",
        destructive:
          "border-destructive/50 text-destructive dark:border-destructive [&>svg]:text-destructive",
        success:
          "border-green-500/50 text-green-600 dark:border-green-500 dark:text-green-400 [&>svg]:text-green-600 dark:[&>svg]:text-green-400",
        warning:
          "border-yellow-500/50 text-yellow-600 dark:border-yellow-500 dark:text-yellow-400 [&>svg]:text-yellow-600 dark:[&>svg]:text-yellow-400",
        info:
          "border-blue-500/50 text-blue-600 dark:border-blue-500 dark:text-blue-400 [&>svg]:text-blue-600 dark:[&>svg]:text-blue-400",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
)

const Alert = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement> & VariantProps<typeof alertVariants>
>(({ className, variant, ...props }, ref) => (
  <div
    ref={ref}
    role="alert"
    className={cn(alertVariants({ variant }), className)}
    {...props}
  />
))
Alert.displayName = "Alert"

const AlertDescription = React.forwardRef<
  HTMLParagraphElement,
  React.HTMLAttributes<HTMLParagraphElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn("text-sm [&_p]:leading-relaxed", className)}
    {...props}
  />
))
AlertDescription.displayName = "AlertDescription"

const AlertTitle = React.forwardRef<
  HTMLParagraphElement,
  React.HTMLAttributes<HTMLHeadingElement>
>(({ className, ...props }, ref) => (
  <h5
    ref={ref}
    className={cn("mb-1 font-medium leading-none tracking-tight", className)}
    {...props}
  />
))
AlertTitle.displayName = "AlertTitle"

// Toast notification component for popup alerts
export interface ToastProps {
  id: string
  title?: string
  description: string
  variant?: 'success' | 'error' | 'warning' | 'info'
  duration?: number
  onClose?: () => void
}

const getToastIcon = (variant: ToastProps['variant']) => {
  switch (variant) {
    case 'success':
      return <CheckCircle className="h-4 w-4" />
    case 'error':
      return <AlertCircle className="h-4 w-4" />
    case 'warning':
      return <AlertTriangle className="h-4 w-4" />
    case 'info':
      return <Info className="h-4 w-4" />
    default:
      return <Info className="h-4 w-4" />
  }
}

const getToastStyles = (variant: ToastProps['variant']) => {
  switch (variant) {
    case 'success':
      return 'bg-green-50 border-green-200 text-green-800 dark:bg-green-900/50 dark:border-green-700 dark:text-white sm:dark:bg-green-900/10 sm:dark:text-white'
    case 'error':
      return 'bg-red-50 border-red-200 text-red-800 dark:bg-red-900/50 dark:border-red-700 dark:text-white sm:dark:bg-red-900/10 sm:dark:text-white'
    case 'warning':
      return 'bg-yellow-50 border-yellow-200 text-yellow-800 dark:bg-yellow-900/50 dark:border-yellow-700 dark:text-white sm:dark:bg-yellow-900/10 sm:dark:text-white'
    case 'info':
      return 'bg-blue-50 border-blue-200 text-blue-800 dark:bg-blue-900/50 dark:border-blue-700 dark:text-white sm:dark:bg-blue-900/10 sm:dark:text-white'
    default:
      return 'bg-slate-50 border-slate-200 text-slate-800 dark:bg-slate-900/50 dark:border-slate-700 dark:text-white sm:dark:bg-slate-900/10 sm:dark:text-white'
  }
}

export const Toast: React.FC<ToastProps> = ({
  id,
  title,
  description,
  variant = 'info',
  onClose
}) => {
  return (
    <div
      className={cn(
        "relative flex items-start space-x-3 border shadow-lg transition-all duration-300 ease-in-out",
        "animate-in slide-in-from-right-full",
        // Mobile: centered square style with less transparency
        "w-80 max-w-[90vw] mx-auto rounded-xl p-4 sm:w-full sm:max-w-sm sm:rounded-lg sm:p-3",
        "text-base sm:text-sm",
        getToastStyles(variant)
      )}
      role="alert"
    >
      <div className="flex-shrink-0 mt-0.5">
        {getToastIcon(variant)}
      </div>
      <div className="flex-1 min-w-0 pr-2">
        {title && (
          <div className="font-medium mb-1 text-lg sm:text-base leading-tight">
            {title}
          </div>
        )}
        <div className="text-base sm:text-sm leading-tight break-words">
          {description}
        </div>
      </div>
      {onClose && (
        <button
          onClick={onClose}
          className="flex-shrink-0 inline-flex text-gray-400 hover:text-gray-600 dark:text-white dark:hover:text-gray-200 transition-colors touch-manipulation"
          aria-label="Close notification"
        >
          <X className="h-4 w-4" />
        </button>
      )}
    </div>
  )
}

export { Alert, AlertDescription, AlertTitle }
/**
 * Application Initialization
 * This file handles startup tasks for the CodeNinja Hub application
 */

import { cronService } from './cron';

/**
 * Initialize application services
 */
export async function initializeApp() {

  try {
    // Initialize cron service
    if (!cronService.initialized) {
      cronService.initialize();
    }

    // Start cron jobs if enabled
    if (process.env.NODE_ENV === 'production' || process.env.ENABLE_CRON === 'true') {
      const startedCount = cronService.startAll();
      
      // Set up health check in development mode
      if (process.env.NODE_ENV !== 'production') {
        setupHealthCheck();
      }
    } else {
    }

  } catch (error) {
    console.error('✗ Application initialization failed:', error);
    throw error;
  }
}

/**
 * Set up periodic health check for cron jobs in development
 */
function setupHealthCheck() {
  setInterval(() => {
    try {
      const status = cronService.getStatus();
      const runningJobs = Object.values(status).filter(Boolean).length;
      const totalJobs = Object.keys(status).length;
      
      if (runningJobs === 0 && cronService.initialized) {
        cronService.startAll();
      } else if (runningJobs < totalJobs) {
        cronService.startAll();
      }
    } catch (error) {
      console.error('Cron health check failed:', error);
    }
  }, 30000); // Check every 30 seconds in development
}

/**
 * Graceful shutdown handler
 */
export function setupGracefulShutdown() {
  // Prevent multiple event listeners
  if (global.__shutdownHandlersSetup) {
    return;
  }
  global.__shutdownHandlersSetup = true;

  const shutdown = (signal: string) => {
    
    try {
      // Stop all cron jobs
      if (cronService.initialized) {
        cronService.stopAll();
      }
      
      process.exit(0);
    } catch (error) {
      console.error('✗ Error during shutdown:', error);
      process.exit(1);
    }
  };

  // Handle different termination signals
  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGUSR2', () => shutdown('SIGUSR2')); // nodemon restart
}

// Auto-initialize if this file is imported (server-side only)
if (typeof window === 'undefined') {
  // Only run on server-side
  setupGracefulShutdown();
  
  // Use a global flag to prevent multiple initializations
  if (!global.__appInitialized) {
    global.__appInitialized = true;
    
    // Initialize on next tick to allow other modules to load first
    process.nextTick(() => {
      initializeApp().catch(error => {
        console.error('Failed to initialize application:', error);
      });
    });
  }
}

// Declare global flags
declare global {
  var __appInitialized: boolean | undefined;
  var __shutdownHandlersSetup: boolean | undefined;
}
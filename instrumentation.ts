/**
 * Next.js Instrumentation
 * This file runs when the server starts up, making it perfect for initializing services
 */

export async function register() {
  // Only run on server-side
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    // Import and initialize application services
    const { initializeApp, setupGracefulShutdown } = await import('./src/lib/init');
    
    try {
      setupGracefulShutdown();
      await initializeApp();
    } catch (error) {
      console.error('Failed to initialize application services:', error);
    }
  }
}
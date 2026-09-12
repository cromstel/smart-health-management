import '@testing-library/jest-dom/vitest';

// Suppress known unhandled rejections from motion/happy-dom during test teardown
// These are benign "Animation was canceled" errors that occur when motion animations
// are interrupted by happy-dom's cleanup. They don't indicate real test failures.
const originalUnhandledRejection = process.listeners('unhandledRejection');
process.removeAllListeners('unhandledRejection');
process.on('unhandledRejection', (reason: unknown, promise: Promise<unknown>) => {
  if (reason instanceof Error && reason.message === 'The animation was canceled.') {
    // Known benign issue: motion animations canceled by happy-dom cleanup
    // See: https://github.com/framer/motion/issues/1234
    return;
  }
  // Re-emit other unhandled rejections to fail tests appropriately
  for (const handler of originalUnhandledRejection) {
    handler(reason, promise);
  }
});

// Also suppress console.error for these specific errors to reduce noise
const originalConsoleError = console.error;
console.error = (...args: unknown[]) => {
  const message = args.join(' ');
  if (message.includes('The animation was canceled.') && message.includes('motion-dom')) {
    return;
  }
  originalConsoleError.apply(console, args);
};

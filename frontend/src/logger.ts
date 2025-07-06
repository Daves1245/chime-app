import pino from 'pino';

// Check if we're in build mode or Electron environment to avoid worker thread issues
const isBuild =
  process.env.NODE_ENV === 'production' &&
  process.env.NEXT_PHASE === 'phase-production-build';

// More comprehensive Electron detection
const isElectron = (() => {
  try {
    // Check for Electron in renderer process
    if (typeof window !== 'undefined') {
      const windowWithProcess = window as unknown as { process?: { type?: string } };
      if (windowWithProcess.process?.type === 'renderer') {
        return true;
      }
    }
    // Check for Electron in main process  
    if (typeof process !== 'undefined' && process.versions && (process.versions as Record<string, string>).electron) {
      return true;
    }
    // Check for user agent (additional fallback)
    if (typeof navigator !== 'undefined' && navigator.userAgent && navigator.userAgent.toLowerCase().indexOf('electron') > -1) {
      return true;
    }
    return false;
  } catch {
    return false;
  }
})();

interface MockLogger {
  info: (obj: object | string, msg?: string) => void;
  error: (obj: object | string, msg?: string) => void;
  warn: (obj: object | string, msg?: string) => void;
  debug: (obj: object | string, msg?: string) => void;
  child: (obj: object) => MockLogger;
}

const mockLogger: MockLogger = {
  info: (obj: object | string, msg?: string) =>
    console.info(typeof obj === 'string' ? obj : msg || '', obj),
  error: (obj: object | string, msg?: string) =>
    console.error(typeof obj === 'string' ? obj : msg || '', obj),
  warn: (obj: object | string, msg?: string) =>
    console.warn(typeof obj === 'string' ? obj : msg || '', obj),
  debug: (obj: object | string, msg?: string) =>
    console.debug(typeof obj === 'string' ? obj : msg || '', obj),
  child: () => mockLogger,
};

// Always use mock logger for now to avoid worker thread issues
const logger = mockLogger;

export default logger;

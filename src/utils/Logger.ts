/**
 * Simple logging utility with different log levels
 */
export class Logger {
  private static isDevelopment = true; // Toggle based on build mode

  static info(message: string, ...args: any[]): void {
    if (this.isDevelopment) {
      console.log(`[NRK-Oversetter] ${message}`, ...args);
    }
  }

  static warn(message: string, ...args: any[]): void {
    console.warn(`[NRK-Oversetter] ${message}`, ...args);
  }

  static error(message: string, ...args: any[]): void {
    console.error(`[NRK-Oversetter] ${message}`, ...args);
  }

  static debug(message: string, ...args: any[]): void {
    if (this.isDevelopment) {
      console.log(`[NRK-Oversetter] [DEBUG] ${message}`, ...args);
    }
  }
}

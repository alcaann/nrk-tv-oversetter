import { ITranslationEngine } from '../interfaces/ITranslationEngine.js';
import { TranslatorEngine } from './TranslatorEngine.js';

/**
 * Factory for creating translation engine instances
 * This allows easy swapping between different translation providers
 */
export class TranslationEngineFactory {
  private static engines: Map<string, ITranslationEngine> = new Map();

  /**
   * Get a translation engine by type
   * @param engineType - Type of engine to create
   */
  static async getEngine(engineType: 'edge' | 'google' | 'deepl' | 'custom'): Promise<ITranslationEngine> {
    // Return cached instance if available
    if (this.engines.has(engineType)) {
      return this.engines.get(engineType)!;
    }

    let engine: ITranslationEngine;

    switch (engineType) {
      case 'edge':
        // Uses built-in browser Translator API (Chrome/Edge)
        engine = new TranslatorEngine();
        break;

      case 'google':
        // TODO: Implement GoogleTranslationEngine
        throw new Error('Google Translation Engine not yet implemented');

      case 'deepl':
        // TODO: Implement DeepLTranslationEngine
        throw new Error('DeepL Translation Engine not yet implemented');

      case 'custom':
        // TODO: Implement custom API engine
        throw new Error('Custom Translation Engine not yet implemented');

      default:
        throw new Error(`Unknown engine type: ${engineType}`);
    }

    await engine.initialize();
    this.engines.set(engineType, engine);

    return engine;
  }

  /**
   * Clear cached engines and dispose of resources
   */
  static async clearEngines(): Promise<void> {
    for (const engine of this.engines.values()) {
      await engine.dispose();
    }
    this.engines.clear();
  }

  /**
   * Switch to a different engine
   */
  static async switchEngine(newEngineType: 'edge' | 'google' | 'deepl' | 'custom'): Promise<ITranslationEngine> {
    await this.clearEngines();
    return this.getEngine(newEngineType);
  }
}

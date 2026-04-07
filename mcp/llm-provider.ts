/**
 * LLM Provider Abstraction
 *
 * Defines the LLMProvider interface and concrete implementations.
 * Select a provider at runtime via the LLM_PROVIDER environment variable.
 *
 * Currently supported providers:
 *   - anthropic (default) — uses @anthropic-ai/sdk
 *
 * To add a new provider (e.g. OpenAI):
 *   1. Create a class that implements LLMProvider
 *   2. Add a case for it in createProvider()
 */

import Anthropic from '@anthropic-ai/sdk';

// -- Interface ----------------------------------------------------------------

/** Minimal contract every LLM provider must satisfy. */
export interface LLMProvider {
  /**
   * Send a prompt to the LLM and return the raw text response.
   * The caller is responsible for parsing and validating the result.
   */
  generateJSON(prompt: string): Promise<string>;
}

// -- Anthropic implementation -------------------------------------------------

/** Wraps the Anthropic Messages API to satisfy LLMProvider. */
export class AnthropicProvider implements LLMProvider {
  private client: Anthropic;

  constructor() {
    this.client = new Anthropic();
  }

  async generateJSON(prompt: string): Promise<string> {
    const message = await this.client.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 1000,
      messages: [{ role: 'user', content: prompt }],
    });

    const content = message.content[0];
    if (content.type !== 'text') {
      throw new Error('Unexpected response type from Anthropic (expected text)');
    }

    return content.text;
  }
}

// -- Factory ------------------------------------------------------------------

/**
 * Instantiate the provider selected by name.
 * @param name - Provider identifier (e.g. 'anthropic'). Defaults to 'anthropic'.
 */
export function createProvider(name: string = 'anthropic'): LLMProvider {
  switch (name.toLowerCase()) {
    case 'anthropic':
      return new AnthropicProvider();
    default:
      throw new Error(
        `Unknown LLM_PROVIDER: "${name}". Supported values: anthropic`
      );
  }
}

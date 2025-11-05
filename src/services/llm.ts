import axios from 'axios';
import config from '../config/index.js';
import logger from '../utils/logger.js';

export interface LLMResponse {
  text: string;
  usage?: {
    prompt_tokens?: number;
    completion_tokens?: number;
    total_tokens?: number;
  };
  cost_usd?: number;
}

// Key rotation state for Gemini
let currentGeminiKeyIndex = 0;

/**
 * Get next Gemini API key (round-robin)
 */
function getNextGeminiKey(): string {
  const keys = config.apis.gemini.apiKeys;
  if (keys.length === 0) {
    throw new Error('No Gemini API keys configured');
  }

  const key = keys[currentGeminiKeyIndex];
  currentGeminiKeyIndex = (currentGeminiKeyIndex + 1) % keys.length;

  logger.debug('Using Gemini API key', {
    index: currentGeminiKeyIndex,
    total_keys: keys.length,
  });

  return key;
}

/**
 * Call Google Gemini API with Flash model (fast, cheaper)
 */
export async function callGeminiFlash(prompt: string): Promise<LLMResponse> {
  const startTime = Date.now();
  const apiKey = getNextGeminiKey();
  const model = config.apis.gemini.modelFlash;

  try {
    const response = await axios.post(
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,
      {
        contents: [
          {
            parts: [
              {
                text: prompt,
              },
            ],
          },
        ],
        generationConfig: {
          temperature: config.llm.temperature,
          maxOutputTokens: config.llm.maxTokens,
          topP: 0.95,
        },
      },
      {
        headers: {
          'Content-Type': 'application/json',
          'x-goog-api-key': apiKey,
        },
      }
    );

    const text = response.data.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!text) {
      throw new Error('No response text from Gemini Flash');
    }

    const usage = {
      prompt_tokens: response.data.usageMetadata?.promptTokenCount,
      completion_tokens: response.data.usageMetadata?.candidatesTokenCount,
      total_tokens: response.data.usageMetadata?.totalTokenCount,
    };

    const processingTime = Date.now() - startTime;

    logger.info('Gemini Flash response received', {
      model,
      processing_time_ms: processingTime,
      tokens: usage.total_tokens,
    });

    return {
      text,
      usage,
      cost_usd: calculateGeminiCost(usage.prompt_tokens || 0, usage.completion_tokens || 0, 'flash'),
    };
  } catch (error) {
    logger.error('Gemini Flash API call failed', {
      error,
      model,
    });
    throw error;
  }
}

/**
 * Call Google Gemini Pro model (higher quality, for contextual feedback)
 */
export async function callGeminiPro(prompt: string): Promise<LLMResponse> {
  const startTime = Date.now();
  const apiKey = getNextGeminiKey();
  const model = config.apis.gemini.modelPro;

  try {
    const response = await axios.post(
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,
      {
        contents: [
          {
            parts: [
              {
                text: prompt,
              },
            ],
          },
        ],
        generationConfig: {
          temperature: config.llm.temperature,
          maxOutputTokens: config.llm.maxTokens,
          topP: 0.95,
        },
      },
      {
        headers: {
          'Content-Type': 'application/json',
          'x-goog-api-key': apiKey,
        },
      }
    );

    const text = response.data.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!text) {
      throw new Error('No response text from Gemini Pro');
    }

    const usage = {
      prompt_tokens: response.data.usageMetadata?.promptTokenCount,
      completion_tokens: response.data.usageMetadata?.candidatesTokenCount,
      total_tokens: response.data.usageMetadata?.totalTokenCount,
    };

    const processingTime = Date.now() - startTime;

    logger.info('Gemini Pro response received', {
      model,
      processing_time_ms: processingTime,
      tokens: usage.total_tokens,
    });

    return {
      text,
      usage,
      cost_usd: calculateGeminiCost(usage.prompt_tokens || 0, usage.completion_tokens || 0, 'pro'),
    };
  } catch (error) {
    logger.error('Gemini Pro API call failed', {
      error,
      model,
    });
    throw error;
  }
}

/**
 * Calculate approximate cost for Gemini API calls
 * Based on Google's pricing (subject to change)
 */
function calculateGeminiCost(
  promptTokens: number,
  completionTokens: number,
  model: 'flash' | 'pro'
): number {
  // Approximate pricing (as of 2025)
  // Flash: Free tier or very cheap
  // Pro: ~$0.01 per 1K tokens
  if (model === 'flash') {
    return 0; // Assuming free tier
  } else {
    const totalTokens = promptTokens + completionTokens;
    return (totalTokens / 1000) * 0.01; // $0.01 per 1K tokens
  }
}

/**
 * Call Claude API (optional, for comparison)
 */
export async function callClaude(prompt: string): Promise<LLMResponse> {
  const { Anthropic } = await import('@anthropic-ai/sdk');

  const anthropic = new Anthropic({
    apiKey: config.apis.claude.apiKey,
  });

  try {
    const message = await anthropic.messages.create({
      model: config.apis.claude.model,
      max_tokens: config.llm.maxTokens,
      temperature: config.llm.temperature,
      messages: [
        {
          role: 'user',
          content: prompt,
        },
      ],
    });

    const text = message.content[0].type === 'text' ? message.content[0].text : '';

    logger.info('Claude response received', {
      model: config.apis.claude.model,
      tokens: message.usage.output_tokens,
    });

    return {
      text,
      usage: {
        prompt_tokens: message.usage.input_tokens,
        completion_tokens: message.usage.output_tokens,
        total_tokens: message.usage.input_tokens + message.usage.output_tokens,
      },
    };
  } catch (error) {
    logger.error('Claude API call failed', error);
    throw error;
  }
}

/**
 * Main LLM call function with provider selection
 */
export async function callLLM(
  prompt: string,
  provider: 'gemini_flash' | 'gemini_pro' | 'claude' = 'gemini_flash',
  useContextualModel: boolean = false
): Promise<LLMResponse> {
  // If contextual feedback is needed, use Pro model
  if (useContextualModel && provider.startsWith('gemini')) {
    provider = 'gemini_pro';
  }

  switch (provider) {
    case 'gemini_flash':
      return callGeminiFlash(prompt);
    case 'gemini_pro':
      return callGeminiPro(prompt);
    case 'claude':
      return callClaude(prompt);
    default:
      throw new Error(`Unsupported LLM provider: ${provider}`);
  }
}

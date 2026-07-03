/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export interface TokenEstimate {
  tokens: number;
  costUsd: number;
}

/**
 * Estimates token counts based on character heuristics.
 * Prose is estimated at ~4 characters per token.
 * Code is estimated at ~3.2 characters per token due to higher density of operators and spaces.
 */
export function estimateTokens(text: string, isCode: boolean = false): number {
  if (!text || text.trim() === '') return 0;
  const divisor = isCode ? 3.2 : 4.0;
  return Math.max(1, Math.round(text.length / divisor));
}

/**
 * Computes Gemini 3.5-Flash prices:
 * - Input: $0.075 per 1,000,000 tokens ($0.000000075 per token)
 * - Output: $0.30 per 1,000,000 tokens ($0.0000003 per token)
 */
export function calculateCost(tokens: number, isOutput: boolean = false): number {
  if (tokens <= 0) return 0;
  const rate = isOutput ? 0.0000003 : 0.000000075;
  return tokens * rate;
}

/**
 * Formats precise micro-USD values.
 */
export function formatUsd(amount: number): string {
  if (amount === 0) return '$0.000000';
  if (amount < 0.0001) {
    return `$${amount.toFixed(7)}`;
  }
  return `$${amount.toFixed(5)}`;
}

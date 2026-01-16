import OpenAI from "openai";
import type { ActivityLog } from "@shared/schema";

// xAI/Grok API client
const grokClient = new OpenAI({
  baseURL: "https://api.x.ai/v1",
  apiKey: process.env.XAI_API_KEY || "",
});

export interface GrokDecision {
  action: "burn" | "buyback" | "airdrop" | "claim_rewards" | "hold" | "none";
  amount?: number;
  reason: string;
  confidence: number;
  thought: string;
}

export interface SentimentAnalysis {
  overall: "bullish" | "bearish" | "neutral";
  score: number; // -1 to 1
  keyTopics: string[];
  urgency: "low" | "medium" | "high";
}

export interface CommunityInsight {
  sentiment: SentimentAnalysis;
  suggestedAction: GrokDecision;
  summary: string;
}

export class GrokService {
  private client: OpenAI;

  constructor() {
    this.client = grokClient;
  }

  /**
   * Analyze community sentiment from X posts
   */
  async analyzeCommunitysentiment(posts: string[]): Promise<SentimentAnalysis> {
    try {
      const postsText = posts.join("\n---\n");

      const response = await this.client.chat.completions.create({
        model: "grok-2-1212",
        messages: [
          {
            role: "system",
            content: `You are an expert crypto community sentiment analyzer for Groked.dev memecoin project.
Analyze the provided X/Twitter posts and determine:
1. Overall sentiment (bullish/bearish/neutral)
2. Sentiment score (-1 to 1, where -1 is extremely bearish, 1 is extremely bullish)
3. Key topics being discussed
4. Urgency level for action (low/medium/high)

Respond with JSON only: { "overall": "string", "score": number, "keyTopics": ["string"], "urgency": "string" }`,
          },
          {
            role: "user",
            content: `Analyze these community posts:\n\n${postsText}`,
          },
        ],
        response_format: { type: "json_object" },
      });

      const result = JSON.parse(response.choices[0].message.content || "{}");

      return {
        overall: result.overall || "neutral",
        score: Math.max(-1, Math.min(1, result.score || 0)),
        keyTopics: result.keyTopics || [],
        urgency: result.urgency || "low",
      };
    } catch (error: any) {
      console.error("Error analyzing sentiment:", error);
      return {
        overall: "neutral",
        score: 0,
        keyTopics: [],
        urgency: "low",
      };
    }
  }

  /**
   * Get AI decision based on market data and community sentiment
   */
  async getDecision(
    marketData: {
      marketCap: number;
      volume24h: number;
      priceChange24h: number;
      holderCount: number;
      bondingCurveProgress: number;
    },
    sentiment: SentimentAnalysis,
    treasuryBalance: number
  ): Promise<GrokDecision> {
    try {
      const response = await this.client.chat.completions.create({
        model: "grok-2-1212",
        messages: [
          {
            role: "system",
            content: `You are Grok4, an autonomous AI managing the Groked.dev memecoin on Solana/Pump.fun.
Your job is to make decisions about token management based on market data and community sentiment.

Available actions:
- burn: Burn tokens to reduce supply (increases scarcity)
- buyback: Buy tokens from market using treasury SOL (supports price)
- airdrop: Distribute tokens/SOL to holders (rewards community)
- claim_rewards: Claim creator fees from Pump.fun
- hold: Take no action, wait for better conditions
- none: No action needed

Consider:
1. Market conditions (price, volume, marketcap)
2. Community sentiment (bullish/bearish)
3. Treasury balance (don't spend if low)
4. Bonding curve progress (close to graduation?)

Respond with JSON: { "action": "string", "amount": number or null, "reason": "string", "confidence": number (0-1), "thought": "your internal reasoning process" }`,
          },
          {
            role: "user",
            content: `Current state:
Market Cap: $${marketData.marketCap}
24h Volume: $${marketData.volume24h}
24h Price Change: ${marketData.priceChange24h}%
Holder Count: ${marketData.holderCount}
Bonding Curve Progress: ${marketData.bondingCurveProgress}%
Treasury SOL Balance: ${treasuryBalance} SOL

Community Sentiment:
Overall: ${sentiment.overall}
Score: ${sentiment.score}
Key Topics: ${sentiment.keyTopics.join(", ")}
Urgency: ${sentiment.urgency}

What action should I take?`,
          },
        ],
        response_format: { type: "json_object" },
      });

      const result = JSON.parse(response.choices[0].message.content || "{}");

      return {
        action: result.action || "hold",
        amount: result.amount,
        reason: result.reason || "No specific reason provided",
        confidence: Math.max(0, Math.min(1, result.confidence || 0.5)),
        thought: result.thought || "Internal reasoning not available",
      };
    } catch (error: any) {
      console.error("Error getting AI decision:", error);
      return {
        action: "hold",
        reason: "AI decision failed, defaulting to hold",
        confidence: 0,
        thought: `Error: ${error.message}`,
      };
    }
  }

  /**
   * Generate a community response/tweet
   */
  async generateResponse(context: string, tone: "friendly" | "professional" | "hype"): Promise<string> {
    try {
      const toneGuide = {
        friendly: "casual, warm, and approachable",
        professional: "clear, informative, and trustworthy",
        hype: "exciting, energetic, and bullish (but not financial advice)",
      };

      const response = await this.client.chat.completions.create({
        model: "grok-2-1212",
        messages: [
          {
            role: "system",
            content: `You are Grok4, the AI behind Groked.dev memecoin. Generate a ${toneGuide[tone]} response for X/Twitter.
Keep it under 280 characters. No financial advice. Be authentic.`,
          },
          {
            role: "user",
            content: context,
          },
        ],
      });

      return response.choices[0].message.content || "";
    } catch (error: any) {
      console.error("Error generating response:", error);
      return "";
    }
  }

  /**
   * Analyze a single post for actionable insights
   */
  async analyzePost(post: string): Promise<{
    isActionable: boolean;
    suggestedReply?: string;
    sentiment: "positive" | "negative" | "neutral";
  }> {
    try {
      const response = await this.client.chat.completions.create({
        model: "grok-2-1212",
        messages: [
          {
            role: "system",
            content: `Analyze this X/Twitter post about Groked.dev memecoin.
Determine if it requires a response, and if so, suggest one.
Respond with JSON: { "isActionable": boolean, "suggestedReply": "string or null", "sentiment": "positive/negative/neutral" }`,
          },
          {
            role: "user",
            content: post,
          },
        ],
        response_format: { type: "json_object" },
      });

      const result = JSON.parse(response.choices[0].message.content || "{}");

      return {
        isActionable: result.isActionable || false,
        suggestedReply: result.suggestedReply,
        sentiment: result.sentiment || "neutral",
      };
    } catch (error: any) {
      console.error("Error analyzing post:", error);
      return {
        isActionable: false,
        sentiment: "neutral",
      };
    }
  }

  /**
   * Get full community insight with action recommendation
   */
  async getCommunityInsight(
    posts: string[],
    marketData: {
      marketCap: number;
      volume24h: number;
      priceChange24h: number;
      holderCount: number;
      bondingCurveProgress: number;
    },
    treasuryBalance: number
  ): Promise<CommunityInsight> {
    const sentiment = await this.analyzeCommunitysentiment(posts);
    const suggestedAction = await this.getDecision(marketData, sentiment, treasuryBalance);

    return {
      sentiment,
      suggestedAction,
      summary: `Community is ${sentiment.overall} (${sentiment.score.toFixed(2)}). ` +
        `Key topics: ${sentiment.keyTopics.join(", ")}. ` +
        `Recommended action: ${suggestedAction.action} with ${(suggestedAction.confidence * 100).toFixed(0)}% confidence.`,
    };
  }
}

export const grokService = new GrokService();

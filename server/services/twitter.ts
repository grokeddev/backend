/**
 * X (Twitter) API Service for Groked.dev
 * Monitors community messages and enables engagement
 * 
 * Required Environment Variables:
 * - X_API_KEY (API Key)
 * - X_API_SECRET (API Key Secret)
 * - X_ACCESS_TOKEN (Access Token)
 * - X_ACCESS_SECRET (Access Token Secret)
 * - X_BEARER_TOKEN (Bearer Token for v2 API)
 */

// X API v2 endpoints
const X_API_BASE = "https://api.twitter.com/2";

export interface Tweet {
  id: string;
  text: string;
  authorId: string;
  authorUsername?: string;
  createdAt: string;
  metrics?: {
    likes: number;
    retweets: number;
    replies: number;
  };
}

export interface SearchResult {
  tweets: Tweet[];
  nextToken?: string;
  resultCount: number;
}

export interface PostResult {
  success: boolean;
  tweetId?: string;
  error?: string;
}

export class TwitterService {
  private bearerToken: string;
  private apiKey: string;
  private apiSecret: string;
  private accessToken: string;
  private accessSecret: string;

  constructor() {
    this.bearerToken = process.env.X_BEARER_TOKEN || "";
    this.apiKey = process.env.X_API_KEY || "";
    this.apiSecret = process.env.X_API_SECRET || "";
    this.accessToken = process.env.X_ACCESS_TOKEN || "";
    this.accessSecret = process.env.X_ACCESS_SECRET || "";
  }

  /**
   * Check if Twitter API is configured
   */
  isConfigured(): boolean {
    return !!(this.bearerToken || (this.apiKey && this.apiSecret));
  }

  /**
   * Get authorization header for API requests
   */
  private getAuthHeader(): string {
    if (this.bearerToken) {
      return `Bearer ${this.bearerToken}`;
    }
    // For endpoints requiring OAuth 1.0a, you'd need additional implementation
    return "";
  }

  /**
   * Search for tweets mentioning Groked.dev or the token
   */
  async searchMentions(
    query: string = "groked OR groked.dev OR $GROK",
    maxResults: number = 100,
    nextToken?: string
  ): Promise<SearchResult> {
    if (!this.isConfigured()) {
      console.warn("Twitter API not configured");
      return { tweets: [], resultCount: 0 };
    }

    try {
      const params = new URLSearchParams({
        query: `${query} -is:retweet lang:en`,
        max_results: Math.min(maxResults, 100).toString(),
        "tweet.fields": "created_at,public_metrics,author_id",
        expansions: "author_id",
        "user.fields": "username",
      });

      if (nextToken) {
        params.append("next_token", nextToken);
      }

      const response = await fetch(
        `${X_API_BASE}/tweets/search/recent?${params.toString()}`,
        {
          headers: {
            Authorization: this.getAuthHeader(),
          },
        }
      );

      if (!response.ok) {
        const error = await response.text();
        throw new Error(`Twitter API error: ${response.status} - ${error}`);
      }

      const data = await response.json();

      // Map users to tweets
      const usersMap = new Map<string, string>();
      if (data.includes?.users) {
        for (const user of data.includes.users) {
          usersMap.set(user.id, user.username);
        }
      }

      const tweets: Tweet[] = (data.data || []).map((tweet: any) => ({
        id: tweet.id,
        text: tweet.text,
        authorId: tweet.author_id,
        authorUsername: usersMap.get(tweet.author_id),
        createdAt: tweet.created_at,
        metrics: tweet.public_metrics
          ? {
              likes: tweet.public_metrics.like_count,
              retweets: tweet.public_metrics.retweet_count,
              replies: tweet.public_metrics.reply_count,
            }
          : undefined,
      }));

      return {
        tweets,
        nextToken: data.meta?.next_token,
        resultCount: data.meta?.result_count || tweets.length,
      };
    } catch (error: any) {
      console.error("Error searching tweets:", error);
      return { tweets: [], resultCount: 0 };
    }
  }

  /**
   * Get tweets from a specific user
   */
  async getUserTweets(userId: string, maxResults: number = 10): Promise<Tweet[]> {
    if (!this.isConfigured()) {
      console.warn("Twitter API not configured");
      return [];
    }

    try {
      const params = new URLSearchParams({
        max_results: Math.min(maxResults, 100).toString(),
        "tweet.fields": "created_at,public_metrics",
        exclude: "retweets,replies",
      });

      const response = await fetch(
        `${X_API_BASE}/users/${userId}/tweets?${params.toString()}`,
        {
          headers: {
            Authorization: this.getAuthHeader(),
          },
        }
      );

      if (!response.ok) {
        throw new Error(`Twitter API error: ${response.status}`);
      }

      const data = await response.json();

      return (data.data || []).map((tweet: any) => ({
        id: tweet.id,
        text: tweet.text,
        authorId: userId,
        createdAt: tweet.created_at,
        metrics: tweet.public_metrics
          ? {
              likes: tweet.public_metrics.like_count,
              retweets: tweet.public_metrics.retweet_count,
              replies: tweet.public_metrics.reply_count,
            }
          : undefined,
      }));
    } catch (error: any) {
      console.error("Error getting user tweets:", error);
      return [];
    }
  }

  /**
   * Post a tweet (requires OAuth 1.0a)
   */
  async postTweet(text: string): Promise<PostResult> {
    if (!this.accessToken || !this.accessSecret) {
      return {
        success: false,
        error: "Twitter OAuth credentials not configured",
      };
    }

    try {
      // For OAuth 1.0a, we need to sign the request
      // This is a simplified version - in production use a library like oauth-1.0a
      const response = await fetch(`${X_API_BASE}/tweets`, {
        method: "POST",
        headers: {
          Authorization: this.getAuthHeader(),
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ text }),
      });

      if (!response.ok) {
        const error = await response.text();
        return { success: false, error };
      }

      const data = await response.json();
      return {
        success: true,
        tweetId: data.data?.id,
      };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  }

  /**
   * Reply to a tweet
   */
  async replyToTweet(tweetId: string, text: string): Promise<PostResult> {
    if (!this.accessToken || !this.accessSecret) {
      return {
        success: false,
        error: "Twitter OAuth credentials not configured",
      };
    }

    try {
      const response = await fetch(`${X_API_BASE}/tweets`, {
        method: "POST",
        headers: {
          Authorization: this.getAuthHeader(),
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          text,
          reply: { in_reply_to_tweet_id: tweetId },
        }),
      });

      if (!response.ok) {
        const error = await response.text();
        return { success: false, error };
      }

      const data = await response.json();
      return {
        success: true,
        tweetId: data.data?.id,
      };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  }

  /**
   * Like a tweet
   */
  async likeTweet(userId: string, tweetId: string): Promise<boolean> {
    if (!this.accessToken) {
      return false;
    }

    try {
      const response = await fetch(`${X_API_BASE}/users/${userId}/likes`, {
        method: "POST",
        headers: {
          Authorization: this.getAuthHeader(),
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ tweet_id: tweetId }),
      });

      return response.ok;
    } catch (error) {
      console.error("Error liking tweet:", error);
      return false;
    }
  }

  /**
   * Get trending topics related to crypto/memecoins
   */
  async getCryptoTrends(): Promise<string[]> {
    // Note: Trends API requires different access level
    // This is a placeholder - would need proper implementation
    return [
      "Solana",
      "memecoin",
      "pump.fun",
      "crypto",
      "airdrop",
    ];
  }

  /**
   * Monitor mentions in real-time (polling-based)
   */
  async pollMentions(
    lastTweetId?: string,
    query: string = "groked OR groked.dev"
  ): Promise<Tweet[]> {
    const result = await this.searchMentions(query, 100);
    
    if (lastTweetId) {
      // Filter only new tweets
      return result.tweets.filter(
        (tweet) => BigInt(tweet.id) > BigInt(lastTweetId)
      );
    }

    return result.tweets;
  }

  /**
   * Get engagement metrics for project tweets
   */
  async getEngagementStats(tweetIds: string[]): Promise<Map<string, Tweet["metrics"]>> {
    if (!this.isConfigured() || tweetIds.length === 0) {
      return new Map();
    }

    try {
      const params = new URLSearchParams({
        ids: tweetIds.join(","),
        "tweet.fields": "public_metrics",
      });

      const response = await fetch(
        `${X_API_BASE}/tweets?${params.toString()}`,
        {
          headers: {
            Authorization: this.getAuthHeader(),
          },
        }
      );

      if (!response.ok) {
        throw new Error(`Twitter API error: ${response.status}`);
      }

      const data = await response.json();
      const stats = new Map<string, Tweet["metrics"]>();

      for (const tweet of data.data || []) {
        if (tweet.public_metrics) {
          stats.set(tweet.id, {
            likes: tweet.public_metrics.like_count,
            retweets: tweet.public_metrics.retweet_count,
            replies: tweet.public_metrics.reply_count,
          });
        }
      }

      return stats;
    } catch (error) {
      console.error("Error getting engagement stats:", error);
      return new Map();
    }
  }
}

export const twitterService = new TwitterService();

import type { Express, Request, Response } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { solanaService } from "./services/solana";
import { pumpPortalService } from "./services/pumpportal";
import { grokService } from "./services/grok";
import { twitterService } from "./services/twitter";
import {
  deployTokenRequestSchema,
  airdropRequestSchema,
  burnRequestSchema,
  buybackRequestSchema,
  snapshotRequestSchema,
  claimRewardsRequestSchema,
  type DashboardStats,
} from "@shared/schema";

// Helper function for async route handling
const asyncHandler = (fn: (req: Request, res: Response) => Promise<void>) => {
  return (req: Request, res: Response) => {
    fn(req, res).catch((error) => {
      console.error("Route error:", error);
      res.status(500).json({ error: error.message || "Internal server error" });
    });
  };
};

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {

  // ============================================
  // HEALTH CHECK
  // ============================================
  app.get("/api/health", (req, res) => {
    res.json({
      status: "ok",
      timestamp: new Date().toISOString(),
      version: "1.0.0",
    });
  });

  // ============================================
  // DASHBOARD / STATS
  // ============================================
  app.get("/api/dashboard", asyncHandler(async (req, res) => {
    const treasuryState = await storage.getTreasuryState();
    const activeToken = await storage.getActiveToken();
    
    let marketData = null;
    if (activeToken) {
      marketData = await storage.getLatestMarketData(activeToken.mint);
    }

    const stats: DashboardStats = {
      treasurySol: treasuryState?.solBalance || "0",
      treasuryToken: treasuryState?.tokenBalance || "0",
      marketCap: marketData?.marketCap || "0",
      volume24h: marketData?.volume24h || "0",
      holderCount: marketData?.holderCount || 0,
      bondingCurveProgress: marketData?.bondingCurveProgress || "0",
      isGraduated: marketData?.isGraduated || false,
      tokenMint: activeToken?.mint || null,
    };

    res.json(stats);
  }));

  // ============================================
  // WALLET MANAGEMENT
  // ============================================
  app.post("/api/wallet/generate", asyncHandler(async (req, res) => {
    const { type = "temp", label } = req.body;
    
    const walletData = solanaService.generateWallet();
    
    // In production, use proper encryption for private keys
    // For now, we store it but NEVER return it in API responses
    const wallet = await storage.createWallet({
      publicKey: walletData.publicKey,
      encryptedPrivateKey: walletData.privateKey,
      type,
      label,
    });

    // Log activity - NEVER log private keys
    await storage.createActivityLog({
      type: "wallet",
      action: "generate",
      description: `Generated new ${type} wallet`,
      metadata: { publicKey: wallet.publicKey, type },
      status: "success",
    });

    // SECURITY: Never return private keys in API responses
    res.json({
      id: wallet.id,
      publicKey: wallet.publicKey,
      type: wallet.type,
      label: wallet.label,
      warning: "Private key stored securely. Export via secure channel if needed.",
    });
  }));

  app.get("/api/wallet/treasury", asyncHandler(async (req, res) => {
    const wallet = await storage.getTreasuryWallet();
    
    if (!wallet) {
      res.status(404).json({ error: "Treasury wallet not found" });
      return;
    }

    const solBalance = await solanaService.getSolBalance(wallet.publicKey);
    
    res.json({
      publicKey: wallet.publicKey,
      solBalance,
    });
  }));

  app.get("/api/wallet/:publicKey/balance", asyncHandler(async (req, res) => {
    const { publicKey } = req.params;
    const { tokenMint } = req.query;

    const solBalance = await solanaService.getSolBalance(publicKey);
    let tokenBalance = 0;

    if (tokenMint && typeof tokenMint === "string") {
      tokenBalance = await solanaService.getTokenBalance(publicKey, tokenMint);
    }

    res.json({ solBalance, tokenBalance });
  }));

  // ============================================
  // TOKEN OPERATIONS
  // ============================================
  app.post("/api/token/deploy", asyncHandler(async (req, res) => {
    const validation = deployTokenRequestSchema.safeParse(req.body);
    if (!validation.success) {
      res.status(400).json({ error: validation.error.errors });
      return;
    }

    const tokenData = validation.data;
    const treasuryWallet = await storage.getTreasuryWallet();

    if (!treasuryWallet) {
      res.status(400).json({ error: "Treasury wallet not configured" });
      return;
    }

    // Log activity
    const activityLog = await storage.createActivityLog({
      type: "deploy",
      action: "deploy_token",
      thought: "Initiating token deployment on Pump.fun",
      description: `Deploying token: ${tokenData.name} (${tokenData.symbol})`,
      status: "pending",
    });

    // Deploy token
    const result = await pumpPortalService.deployToken(
      treasuryWallet.encryptedPrivateKey,
      tokenData
    );

    if (result.success && result.mint) {
      // Create token record
      const token = await storage.createToken({
        mint: result.mint,
        name: tokenData.name,
        symbol: tokenData.symbol,
        description: tokenData.description,
        imageUri: tokenData.imageUri,
        creatorWallet: treasuryWallet.publicKey,
        deployTxSignature: result.signature,
        status: "active",
      });

      // Update treasury state
      await storage.updateTreasuryState({ tokenMint: result.mint });

      // Update activity log
      await storage.updateActivityLog(activityLog.id, {
        status: "success",
        txSignature: result.signature,
        tokenMint: result.mint,
      });

      res.json({
        success: true,
        token: {
          id: token.id,
          mint: token.mint,
          name: token.name,
          symbol: token.symbol,
        },
        txSignature: result.signature,
      });
    } else {
      await storage.updateActivityLog(activityLog.id, {
        status: "failed",
        metadata: { error: result.error },
      });

      res.status(500).json({ error: result.error });
    }
  }));

  app.get("/api/token/active", asyncHandler(async (req, res) => {
    const token = await storage.getActiveToken();
    
    if (!token) {
      return res.status(404).json({ error: "No active token" });
    }

    res.json(token);
  }));

  app.get("/api/token/:mint", asyncHandler(async (req, res) => {
    const { mint } = req.params;
    const token = await storage.getTokenByMint(mint);
    
    if (!token) {
      return res.status(404).json({ error: "Token not found" });
    }

    res.json(token);
  }));

  app.get("/api/token/:mint/market", asyncHandler(async (req, res) => {
    const { mint } = req.params;
    
    // Fetch fresh data from Pump.fun
    const marketData = await pumpPortalService.getMarketData(mint);
    
    if (!marketData) {
      return res.status(404).json({ error: "Market data not found" });
    }

    // Store in database
    await storage.createMarketData({
      tokenMint: mint,
      marketCap: marketData.marketCap,
      price: marketData.price,
      volume24h: marketData.volume24h,
      holderCount: marketData.holderCount,
      liquidity: marketData.liquidity,
      bondingCurveProgress: marketData.bondingCurveProgress,
      isGraduated: marketData.isGraduated,
    });

    res.json(marketData);
  }));

  // ============================================
  // HOLDER SNAPSHOTS
  // ============================================
  app.post("/api/snapshot", asyncHandler(async (req, res) => {
    const validation = snapshotRequestSchema.safeParse(req.body);
    if (!validation.success) {
      return res.status(400).json({ error: validation.error.errors });
    }

    const { tokenMint } = validation.data;

    // Log activity
    const activityLog = await storage.createActivityLog({
      type: "snapshot",
      action: "take_snapshot",
      thought: "Taking holder snapshot for airdrop eligibility",
      description: `Creating holder snapshot for token ${tokenMint}`,
      tokenMint,
      status: "pending",
    });

    // Get holders from Helius
    const holders = await solanaService.getTokenHolders(tokenMint);
    
    if (holders.length === 0) {
      await storage.updateActivityLog(activityLog.id, {
        status: "failed",
        metadata: { error: "No holders found or Helius API unavailable" },
      });
      return res.status(404).json({ error: "No holders found" });
    }

    // Calculate total supply held
    const totalHeld = holders.reduce((sum, h) => sum + parseFloat(h.balance), 0);

    // Create snapshot
    const snapshot = await storage.createHolderSnapshot({
      tokenMint,
      snapshotData: holders,
      holderCount: holders.length,
      totalSupplyHeld: totalHeld.toString(),
    });

    await storage.updateActivityLog(activityLog.id, {
      status: "success",
      metadata: { snapshotId: snapshot.id, holderCount: holders.length },
    });

    res.json({
      id: snapshot.id,
      holderCount: snapshot.holderCount,
      totalSupplyHeld: snapshot.totalSupplyHeld,
      createdAt: snapshot.createdAt,
    });
  }));

  app.get("/api/snapshot/:id", asyncHandler(async (req, res) => {
    const { id } = req.params;
    const snapshot = await storage.getHolderSnapshot(id);
    
    if (!snapshot) {
      return res.status(404).json({ error: "Snapshot not found" });
    }

    res.json(snapshot);
  }));

  app.get("/api/snapshots/:tokenMint", asyncHandler(async (req, res) => {
    const { tokenMint } = req.params;
    const limit = parseInt(req.query.limit as string) || 50;
    
    const snapshots = await storage.getSnapshotHistory(tokenMint, limit);
    res.json(snapshots);
  }));

  // ============================================
  // AIRDROP
  // ============================================
  app.post("/api/airdrop", asyncHandler(async (req, res) => {
    const validation = airdropRequestSchema.safeParse(req.body);
    if (!validation.success) {
      return res.status(400).json({ error: validation.error.errors });
    }

    const airdropData = validation.data;
    const treasuryWallet = await storage.getTreasuryWallet();

    if (!treasuryWallet) {
      return res.status(400).json({ error: "Treasury wallet not configured" });
    }

    // Calculate total amount
    const totalAmount = airdropData.recipients.reduce((sum, r) => sum + r.amount, 0);

    // Create airdrop record
    const airdrop = await storage.createAirdrop({
      type: airdropData.type,
      tokenMint: airdropData.tokenMint,
      totalAmount: totalAmount.toString(),
      recipientCount: airdropData.recipients.length,
      distributionData: [],
      snapshotId: airdropData.snapshotId,
      status: "processing",
    });

    // Log activity
    const activityLog = await storage.createActivityLog({
      type: "airdrop",
      action: `airdrop_${airdropData.type}`,
      thought: `Distributing ${airdropData.type === "sol" ? "SOL" : "tokens"} to ${airdropData.recipients.length} holders`,
      description: `Airdropping ${totalAmount} ${airdropData.type === "sol" ? "SOL" : "tokens"} to ${airdropData.recipients.length} recipients`,
      amount: totalAmount.toString(),
      tokenMint: airdropData.tokenMint,
      status: "pending",
    });

    // Execute airdrop
    let results;
    if (airdropData.type === "sol") {
      results = await solanaService.batchAirdropSol(
        treasuryWallet.encryptedPrivateKey,
        airdropData.recipients
      );
    } else {
      if (!airdropData.tokenMint) {
        return res.status(400).json({ error: "Token mint required for token airdrop" });
      }
      results = await solanaService.batchAirdropTokens(
        treasuryWallet.encryptedPrivateKey,
        airdropData.tokenMint,
        airdropData.recipients
      );
    }

    // Process results
    const successCount = results.filter(r => r.result.success).length;
    const distributionData = results.map((r, i) => ({
      wallet: r.wallet,
      amount: airdropData.recipients[i].amount,
      txSignature: r.result.txSignature,
      success: r.result.success,
      error: r.result.error,
    }));

    // Update airdrop record
    await storage.updateAirdrop(airdrop.id, {
      distributionData,
      status: successCount === results.length ? "completed" : "partial",
      completedAt: new Date(),
    });

    await storage.updateActivityLog(activityLog.id, {
      status: successCount > 0 ? "success" : "failed",
      metadata: { successCount, failCount: results.length - successCount },
    });

    res.json({
      id: airdrop.id,
      successCount,
      failCount: results.length - successCount,
      distributions: distributionData,
    });
  }));

  app.get("/api/airdrops", asyncHandler(async (req, res) => {
    const limit = parseInt(req.query.limit as string) || 50;
    const airdrops = await storage.getAirdrops(limit);
    res.json(airdrops);
  }));

  // ============================================
  // BURN
  // ============================================
  app.post("/api/burn", asyncHandler(async (req, res) => {
    const validation = burnRequestSchema.safeParse(req.body);
    if (!validation.success) {
      return res.status(400).json({ error: validation.error.errors });
    }

    const { tokenMint, amount, reason } = validation.data;
    const treasuryWallet = await storage.getTreasuryWallet();

    if (!treasuryWallet) {
      return res.status(400).json({ error: "Treasury wallet not configured" });
    }

    // Create burn record
    const burnRecord = await storage.createBurnRecord({
      tokenMint,
      amount: amount.toString(),
      reason,
      status: "pending",
    });

    // Log activity
    const activityLog = await storage.createActivityLog({
      type: "burn",
      action: "burn_tokens",
      thought: reason || "Reducing token supply to increase scarcity",
      description: `Burning ${amount} tokens`,
      amount: amount.toString(),
      tokenMint,
      status: "pending",
    });

    // Execute burn
    const result = await solanaService.burnTokens(
      treasuryWallet.encryptedPrivateKey,
      tokenMint,
      amount
    );

    await storage.updateBurnRecord(burnRecord.id, {
      status: result.success ? "success" : "failed",
      txSignature: result.txSignature,
    });

    await storage.updateActivityLog(activityLog.id, {
      status: result.success ? "success" : "failed",
      txSignature: result.txSignature,
    });

    if (result.success) {
      res.json({
        success: true,
        txSignature: result.txSignature,
        amount: amount.toString(),
      });
    } else {
      res.status(500).json({ error: result.error });
    }
  }));

  app.get("/api/burns", asyncHandler(async (req, res) => {
    const tokenMint = req.query.tokenMint as string | undefined;
    const burns = await storage.getBurnRecords(tokenMint);
    res.json(burns);
  }));

  // ============================================
  // BUYBACK
  // ============================================
  app.post("/api/buyback", asyncHandler(async (req, res) => {
    const validation = buybackRequestSchema.safeParse(req.body);
    if (!validation.success) {
      return res.status(400).json({ error: validation.error.errors });
    }

    const { tokenMint, solAmount, reason } = validation.data;
    const treasuryWallet = await storage.getTreasuryWallet();

    if (!treasuryWallet) {
      return res.status(400).json({ error: "Treasury wallet not configured" });
    }

    // Create buyback record
    const buybackRecord = await storage.createBuybackRecord({
      tokenMint,
      solSpent: solAmount.toString(),
      reason,
      status: "pending",
    });

    // Log activity
    const activityLog = await storage.createActivityLog({
      type: "buyback",
      action: "buyback_tokens",
      thought: reason || "Buying back tokens to support price",
      description: `Buying back tokens with ${solAmount} SOL`,
      amount: solAmount.toString(),
      tokenMint,
      status: "pending",
    });

    // Execute buyback via PumpPortal
    const result = await pumpPortalService.buyToken(
      treasuryWallet.encryptedPrivateKey,
      tokenMint,
      solAmount
    );

    await storage.updateBuybackRecord(buybackRecord.id, {
      status: result.success ? "success" : "failed",
      txSignature: result.txSignature,
    });

    await storage.updateActivityLog(activityLog.id, {
      status: result.success ? "success" : "failed",
      txSignature: result.txSignature,
    });

    if (result.success) {
      res.json({
        success: true,
        txSignature: result.txSignature,
        solSpent: solAmount.toString(),
      });
    } else {
      res.status(500).json({ error: result.error });
    }
  }));

  app.get("/api/buybacks", asyncHandler(async (req, res) => {
    const tokenMint = req.query.tokenMint as string | undefined;
    const buybacks = await storage.getBuybackRecords(tokenMint);
    res.json(buybacks);
  }));

  // ============================================
  // CREATOR REWARDS
  // ============================================
  app.post("/api/rewards/claim", asyncHandler(async (req, res) => {
    const validation = claimRewardsRequestSchema.safeParse(req.body);
    if (!validation.success) {
      return res.status(400).json({ error: validation.error.errors });
    }

    const { tokenMint } = validation.data;
    const treasuryWallet = await storage.getTreasuryWallet();

    if (!treasuryWallet) {
      return res.status(400).json({ error: "Treasury wallet not configured" });
    }

    // Get pending rewards amount
    const pendingAmount = await pumpPortalService.getPendingRewards(tokenMint);

    // Create reward record
    const rewardRecord = await storage.createCreatorReward({
      tokenMint,
      amount: pendingAmount.toString(),
      status: "pending",
    });

    // Log activity
    const activityLog = await storage.createActivityLog({
      type: "claim_rewards",
      action: "claim_creator_rewards",
      thought: "Claiming creator rewards to fund treasury operations",
      description: `Claiming ${pendingAmount} SOL in creator rewards`,
      amount: pendingAmount.toString(),
      tokenMint,
      status: "pending",
    });

    // Execute claim
    const result = await pumpPortalService.claimCreatorRewards(
      treasuryWallet.encryptedPrivateKey,
      tokenMint
    );

    await storage.updateCreatorReward(rewardRecord.id, {
      status: result.success ? "claimed" : "failed",
      claimTxSignature: result.txSignature,
      claimedAt: result.success ? new Date() : undefined,
    });

    await storage.updateActivityLog(activityLog.id, {
      status: result.success ? "success" : "failed",
      txSignature: result.txSignature,
    });

    if (result.success) {
      res.json({
        success: true,
        txSignature: result.txSignature,
        amount: pendingAmount.toString(),
      });
    } else {
      res.status(500).json({ error: result.error });
    }
  }));

  app.get("/api/rewards/pending/:tokenMint", asyncHandler(async (req, res) => {
    const { tokenMint } = req.params;
    const pendingAmount = await pumpPortalService.getPendingRewards(tokenMint);
    res.json({ tokenMint, pendingAmount });
  }));

  app.get("/api/rewards", asyncHandler(async (req, res) => {
    const tokenMint = req.query.tokenMint as string | undefined;
    const rewards = await storage.getCreatorRewards(tokenMint);
    res.json(rewards);
  }));

  // ============================================
  // ACTIVITY LOGS
  // ============================================
  app.get("/api/activity", asyncHandler(async (req, res) => {
    const limit = parseInt(req.query.limit as string) || 100;
    const offset = parseInt(req.query.offset as string) || 0;
    
    const logs = await storage.getActivityLogs(limit, offset);
    res.json(logs);
  }));

  app.get("/api/activity/:type", asyncHandler(async (req, res) => {
    const { type } = req.params;
    const limit = parseInt(req.query.limit as string) || 50;
    
    const logs = await storage.getActivityLogsByType(type, limit);
    res.json(logs);
  }));

  app.post("/api/activity/thought", asyncHandler(async (req, res) => {
    const { thought, action, metadata } = req.body;

    if (!thought) {
      return res.status(400).json({ error: "Thought is required" });
    }

    const log = await storage.createActivityLog({
      type: "thought",
      action: action || "ai_thought",
      thought,
      description: thought,
      metadata,
      status: "success",
    });

    res.json(log);
  }));

  // ============================================
  // TREASURY
  // ============================================
  app.get("/api/treasury", asyncHandler(async (req, res) => {
    const treasuryWallet = await storage.getTreasuryWallet();
    const treasuryState = await storage.getTreasuryState();
    const activeToken = await storage.getActiveToken();

    if (!treasuryWallet) {
      return res.status(404).json({ error: "Treasury not configured" });
    }

    // Get fresh balances
    const solBalance = await solanaService.getSolBalance(treasuryWallet.publicKey);
    let tokenBalance = 0;

    if (activeToken) {
      tokenBalance = await solanaService.getTokenBalance(
        treasuryWallet.publicKey,
        activeToken.mint
      );
    }

    // Update treasury state
    await storage.updateTreasuryState({
      solBalance: solBalance.toString(),
      tokenBalance: tokenBalance.toString(),
      tokenMint: activeToken?.mint,
    });

    res.json({
      publicKey: treasuryWallet.publicKey,
      solBalance: solBalance.toString(),
      tokenBalance: tokenBalance.toString(),
      tokenMint: activeToken?.mint,
      lastUpdated: new Date().toISOString(),
    });
  }));

  app.post("/api/treasury/refresh", asyncHandler(async (req, res) => {
    const treasuryWallet = await storage.getTreasuryWallet();

    if (!treasuryWallet) {
      return res.status(404).json({ error: "Treasury not configured" });
    }

    const activeToken = await storage.getActiveToken();
    const solBalance = await solanaService.getSolBalance(treasuryWallet.publicKey);
    
    let tokenBalance = 0;
    let marketData = null;

    if (activeToken) {
      tokenBalance = await solanaService.getTokenBalance(
        treasuryWallet.publicKey,
        activeToken.mint
      );
      marketData = await pumpPortalService.getMarketData(activeToken.mint);

      if (marketData) {
        await storage.createMarketData({
          tokenMint: activeToken.mint,
          marketCap: marketData.marketCap,
          price: marketData.price,
          volume24h: marketData.volume24h,
          holderCount: marketData.holderCount,
          liquidity: marketData.liquidity,
          bondingCurveProgress: marketData.bondingCurveProgress,
          isGraduated: marketData.isGraduated,
        });
      }
    }

    await storage.updateTreasuryState({
      solBalance: solBalance.toString(),
      tokenBalance: tokenBalance.toString(),
      tokenMint: activeToken?.mint,
    });

    res.json({
      solBalance: solBalance.toString(),
      tokenBalance: tokenBalance.toString(),
      tokenMint: activeToken?.mint,
      marketData,
      lastUpdated: new Date().toISOString(),
    });
  }));

  // ============================================
  // TOKENS LIST
  // ============================================
  app.get("/api/tokens", asyncHandler(async (req, res) => {
    const tokens = await storage.getAllTokens();
    res.json(tokens);
  }));

  // ============================================
  // GROK AI ENDPOINTS
  // ============================================
  app.post("/api/ai/analyze-sentiment", asyncHandler(async (req, res) => {
    const { posts } = req.body;
    
    if (!posts || !Array.isArray(posts) || posts.length === 0) {
      res.status(400).json({ error: "Posts array is required" });
      return;
    }

    const sentiment = await grokService.analyzeCommunitysentiment(posts);

    // Log AI activity
    await storage.createActivityLog({
      type: "thought",
      action: "sentiment_analysis",
      thought: `Analyzed ${posts.length} posts. Overall sentiment: ${sentiment.overall} (${sentiment.score})`,
      description: `Community sentiment analysis: ${sentiment.overall}`,
      metadata: { sentiment, postCount: posts.length },
      status: "success",
    });

    res.json(sentiment);
  }));

  app.post("/api/ai/get-decision", asyncHandler(async (req, res) => {
    const { marketData, sentiment, treasuryBalance } = req.body;
    
    if (!marketData) {
      res.status(400).json({ error: "Market data is required" });
      return;
    }

    const decision = await grokService.getDecision(
      marketData,
      sentiment || { overall: "neutral", score: 0, keyTopics: [], urgency: "low" },
      treasuryBalance || 0
    );

    // Log AI decision
    await storage.createActivityLog({
      type: "thought",
      action: "ai_decision",
      thought: decision.thought,
      description: `AI Decision: ${decision.action} - ${decision.reason}`,
      metadata: { decision, marketData, sentiment },
      status: "success",
    });

    res.json(decision);
  }));

  app.post("/api/ai/generate-response", asyncHandler(async (req, res) => {
    const { context, tone = "friendly" } = req.body;
    
    if (!context) {
      res.status(400).json({ error: "Context is required" });
      return;
    }

    const response = await grokService.generateResponse(context, tone);
    res.json({ response });
  }));

  app.post("/api/ai/community-insight", asyncHandler(async (req, res) => {
    const { posts, marketData, treasuryBalance } = req.body;

    if (!posts || !Array.isArray(posts)) {
      res.status(400).json({ error: "Posts array is required" });
      return;
    }

    const insight = await grokService.getCommunityInsight(
      posts,
      marketData || {
        marketCap: 0,
        volume24h: 0,
        priceChange24h: 0,
        holderCount: 0,
        bondingCurveProgress: 0,
      },
      treasuryBalance || 0
    );

    // Log insight
    await storage.createActivityLog({
      type: "thought",
      action: "community_insight",
      thought: insight.suggestedAction.thought,
      description: insight.summary,
      metadata: { insight },
      status: "success",
    });

    res.json(insight);
  }));

  // ============================================
  // X (TWITTER) API ENDPOINTS
  // ============================================
  app.get("/api/x/status", asyncHandler(async (req, res) => {
    res.json({
      configured: twitterService.isConfigured(),
      message: twitterService.isConfigured()
        ? "X API is configured and ready"
        : "X API credentials not configured. Set X_BEARER_TOKEN, X_API_KEY, X_API_SECRET, X_ACCESS_TOKEN, X_ACCESS_SECRET",
    });
  }));

  app.get("/api/x/mentions", asyncHandler(async (req, res) => {
    const query = (req.query.query as string) || "groked OR groked.dev";
    const maxResults = parseInt(req.query.maxResults as string) || 100;
    
    const result = await twitterService.searchMentions(query, maxResults);
    
    // Log activity
    await storage.createActivityLog({
      type: "thought",
      action: "x_mentions_fetch",
      description: `Fetched ${result.resultCount} mentions from X`,
      metadata: { query, resultCount: result.resultCount },
      status: "success",
    });

    res.json(result);
  }));

  app.post("/api/x/analyze-and-respond", asyncHandler(async (req, res) => {
    const { query = "groked OR groked.dev", autoReply = false } = req.body;

    // Fetch recent mentions
    const mentions = await twitterService.searchMentions(query, 50);

    if (mentions.tweets.length === 0) {
      res.json({ message: "No recent mentions found", analyzed: [] });
      return;
    }

    // Analyze with Grok AI
    const posts = mentions.tweets.map(t => t.text);
    const insight = await grokService.getCommunityInsight(
      posts,
      { marketCap: 0, volume24h: 0, priceChange24h: 0, holderCount: 0, bondingCurveProgress: 0 },
      0
    );

    // Analyze individual posts for response
    const analyzed = [];
    for (const tweet of mentions.tweets.slice(0, 10)) { // Limit to 10
      const analysis = await grokService.analyzePost(tweet.text);
      analyzed.push({
        tweet,
        analysis,
      });

      // Auto-reply if enabled and actionable
      if (autoReply && analysis.isActionable && analysis.suggestedReply) {
        const replyResult = await twitterService.replyToTweet(tweet.id, analysis.suggestedReply);
        if (replyResult.success) {
          await storage.createActivityLog({
            type: "thought",
            action: "x_auto_reply",
            description: `Replied to tweet ${tweet.id}`,
            metadata: { tweetId: tweet.id, reply: analysis.suggestedReply },
            status: "success",
          });
        }
      }
    }

    // Log activity
    await storage.createActivityLog({
      type: "thought",
      action: "x_analysis",
      thought: insight.suggestedAction.thought,
      description: `Analyzed ${mentions.tweets.length} tweets. Sentiment: ${insight.sentiment.overall}`,
      metadata: { insight, analyzedCount: analyzed.length },
      status: "success",
    });

    res.json({
      insight,
      analyzed,
      totalMentions: mentions.resultCount,
    });
  }));

  app.post("/api/x/post", asyncHandler(async (req, res) => {
    const { text } = req.body;

    if (!text) {
      res.status(400).json({ error: "Tweet text is required" });
      return;
    }

    const result = await twitterService.postTweet(text);

    if (result.success) {
      await storage.createActivityLog({
        type: "thought",
        action: "x_post",
        description: `Posted tweet: ${text.substring(0, 50)}...`,
        metadata: { tweetId: result.tweetId, text },
        status: "success",
      });
    }

    res.json(result);
  }));

  app.post("/api/x/reply", asyncHandler(async (req, res) => {
    const { tweetId, text } = req.body;

    if (!tweetId || !text) {
      res.status(400).json({ error: "Tweet ID and text are required" });
      return;
    }

    const result = await twitterService.replyToTweet(tweetId, text);

    if (result.success) {
      await storage.createActivityLog({
        type: "thought",
        action: "x_reply",
        description: `Replied to tweet ${tweetId}`,
        metadata: { tweetId, replyTweetId: result.tweetId, text },
        status: "success",
      });
    }

    res.json(result);
  }));

  // ============================================
  // AUTONOMOUS AGENT LOOP
  // ============================================
  app.post("/api/agent/run-cycle", asyncHandler(async (req, res) => {
    const treasuryWallet = await storage.getTreasuryWallet();
    const activeToken = await storage.getActiveToken();

    if (!treasuryWallet) {
      res.status(400).json({ error: "Treasury wallet not configured" });
      return;
    }

    // 1. Fetch X mentions
    const mentions = await twitterService.searchMentions("groked OR groked.dev", 50);
    const posts = mentions.tweets.map(t => t.text);

    // 2. Get market data
    let marketData = {
      marketCap: 0,
      volume24h: 0,
      priceChange24h: 0,
      holderCount: 0,
      bondingCurveProgress: 0,
    };

    if (activeToken) {
      const pumpData = await pumpPortalService.getMarketData(activeToken.mint);
      if (pumpData) {
        marketData = {
          marketCap: parseFloat(pumpData.marketCap),
          volume24h: parseFloat(pumpData.volume24h),
          priceChange24h: 0, // Would need historical data
          holderCount: pumpData.holderCount,
          bondingCurveProgress: parseFloat(pumpData.bondingCurveProgress),
        };
      }
    }

    // 3. Get treasury balance
    const treasuryBalance = await solanaService.getSolBalance(treasuryWallet.publicKey);

    // 4. Get AI insight
    const insight = await grokService.getCommunityInsight(posts, marketData, treasuryBalance);

    // 5. Log the cycle
    await storage.createActivityLog({
      type: "thought",
      action: "agent_cycle",
      thought: insight.suggestedAction.thought,
      description: `Agent cycle complete. Recommendation: ${insight.suggestedAction.action}`,
      metadata: {
        mentionsCount: mentions.resultCount,
        sentiment: insight.sentiment,
        decision: insight.suggestedAction,
        treasuryBalance,
        marketData,
      },
      status: "success",
    });

    res.json({
      cycle: {
        timestamp: new Date().toISOString(),
        mentionsAnalyzed: mentions.resultCount,
        treasuryBalance,
        marketData,
      },
      insight,
      recommendation: insight.suggestedAction,
    });
  }));

  return httpServer;
}

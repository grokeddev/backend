import { sql } from "drizzle-orm";
import { pgTable, text, varchar, numeric, timestamp, boolean, integer, jsonb } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// ============================================
// WALLET MANAGEMENT
// ============================================
export const wallets = pgTable("wallets", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  publicKey: text("public_key").notNull().unique(),
  encryptedPrivateKey: text("encrypted_private_key").notNull(),
  type: text("type").notNull().default("treasury"), // treasury, airdrop, temp
  label: text("label"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertWalletSchema = createInsertSchema(wallets).omit({ id: true, createdAt: true });
export type InsertWallet = z.infer<typeof insertWalletSchema>;
export type Wallet = typeof wallets.$inferSelect;

// ============================================
// TOKEN MANAGEMENT
// ============================================
export const tokens = pgTable("tokens", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  mint: text("mint").notNull().unique(),
  name: text("name").notNull(),
  symbol: text("symbol").notNull(),
  description: text("description"),
  imageUri: text("image_uri"),
  metadataUri: text("metadata_uri"),
  creatorWallet: text("creator_wallet").notNull(),
  bondingCurveAddress: text("bonding_curve_address"),
  deployTxSignature: text("deploy_tx_signature"),
  status: text("status").notNull().default("active"), // active, graduated, failed
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertTokenSchema = createInsertSchema(tokens).omit({ id: true, createdAt: true });
export type InsertToken = z.infer<typeof insertTokenSchema>;
export type Token = typeof tokens.$inferSelect;

// ============================================
// TREASURY STATE
// ============================================
export const treasuryState = pgTable("treasury_state", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  solBalance: numeric("sol_balance", { precision: 20, scale: 9 }).notNull().default("0"),
  tokenBalance: numeric("token_balance", { precision: 20, scale: 9 }).notNull().default("0"),
  tokenMint: text("token_mint"),
  lastUpdated: timestamp("last_updated").defaultNow().notNull(),
});

export const insertTreasuryStateSchema = createInsertSchema(treasuryState).omit({ id: true, lastUpdated: true });
export type InsertTreasuryState = z.infer<typeof insertTreasuryStateSchema>;
export type TreasuryState = typeof treasuryState.$inferSelect;

// ============================================
// MARKET DATA
// ============================================
export const marketData = pgTable("market_data", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  tokenMint: text("token_mint").notNull(),
  marketCap: numeric("market_cap", { precision: 30, scale: 9 }),
  price: numeric("price", { precision: 30, scale: 18 }),
  volume24h: numeric("volume_24h", { precision: 30, scale: 9 }),
  holderCount: integer("holder_count"),
  liquidity: numeric("liquidity", { precision: 30, scale: 9 }),
  bondingCurveProgress: numeric("bonding_curve_progress", { precision: 5, scale: 2 }),
  isGraduated: boolean("is_graduated").default(false),
  timestamp: timestamp("timestamp").defaultNow().notNull(),
});

export const insertMarketDataSchema = createInsertSchema(marketData).omit({ id: true, timestamp: true });
export type InsertMarketData = z.infer<typeof insertMarketDataSchema>;
export type MarketData = typeof marketData.$inferSelect;

// ============================================
// HOLDER SNAPSHOTS
// ============================================
export const holderSnapshots = pgTable("holder_snapshots", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  tokenMint: text("token_mint").notNull(),
  snapshotData: jsonb("snapshot_data").notNull(), // Array of {wallet, balance}
  holderCount: integer("holder_count").notNull(),
  totalSupplyHeld: numeric("total_supply_held", { precision: 20, scale: 9 }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertHolderSnapshotSchema = createInsertSchema(holderSnapshots).omit({ id: true, createdAt: true });
export type InsertHolderSnapshot = z.infer<typeof insertHolderSnapshotSchema>;
export type HolderSnapshot = typeof holderSnapshots.$inferSelect;

// ============================================
// ACTIVITY LOG
// ============================================
export const activityLogs = pgTable("activity_logs", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  type: text("type").notNull(), // deploy, burn, buyback, airdrop, claim_rewards, snapshot, thought
  action: text("action").notNull(),
  description: text("description"),
  thought: text("thought"), // AI reasoning/thinking
  txSignature: text("tx_signature"),
  amount: numeric("amount", { precision: 20, scale: 9 }),
  tokenMint: text("token_mint"),
  metadata: jsonb("metadata"), // Additional context
  status: text("status").notNull().default("pending"), // pending, success, failed
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertActivityLogSchema = createInsertSchema(activityLogs).omit({ id: true, createdAt: true });
export type InsertActivityLog = z.infer<typeof insertActivityLogSchema>;
export type ActivityLog = typeof activityLogs.$inferSelect;

// ============================================
// AIRDROPS
// ============================================
export const airdrops = pgTable("airdrops", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  type: text("type").notNull(), // token, sol
  tokenMint: text("token_mint"),
  totalAmount: numeric("total_amount", { precision: 20, scale: 9 }).notNull(),
  recipientCount: integer("recipient_count").notNull(),
  distributionData: jsonb("distribution_data").notNull(), // Array of {wallet, amount, txSignature}
  snapshotId: text("snapshot_id"),
  status: text("status").notNull().default("pending"), // pending, processing, completed, failed
  createdAt: timestamp("created_at").defaultNow().notNull(),
  completedAt: timestamp("completed_at"),
});

export const insertAirdropSchema = createInsertSchema(airdrops).omit({ id: true, createdAt: true, completedAt: true });
export type InsertAirdrop = z.infer<typeof insertAirdropSchema>;
export type Airdrop = typeof airdrops.$inferSelect;

// ============================================
// CREATOR REWARDS
// ============================================
export const creatorRewards = pgTable("creator_rewards", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  tokenMint: text("token_mint").notNull(),
  amount: numeric("amount", { precision: 20, scale: 9 }).notNull(),
  claimTxSignature: text("claim_tx_signature"),
  status: text("status").notNull().default("pending"), // pending, claimed, failed
  claimedAt: timestamp("claimed_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertCreatorRewardSchema = createInsertSchema(creatorRewards).omit({ id: true, createdAt: true, claimedAt: true });
export type InsertCreatorReward = z.infer<typeof insertCreatorRewardSchema>;
export type CreatorReward = typeof creatorRewards.$inferSelect;

// ============================================
// BURN RECORDS
// ============================================
export const burnRecords = pgTable("burn_records", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  tokenMint: text("token_mint").notNull(),
  amount: numeric("amount", { precision: 20, scale: 9 }).notNull(),
  txSignature: text("tx_signature"),
  reason: text("reason"),
  status: text("status").notNull().default("pending"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertBurnRecordSchema = createInsertSchema(burnRecords).omit({ id: true, createdAt: true });
export type InsertBurnRecord = z.infer<typeof insertBurnRecordSchema>;
export type BurnRecord = typeof burnRecords.$inferSelect;

// ============================================
// BUYBACK RECORDS
// ============================================
export const buybackRecords = pgTable("buyback_records", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  tokenMint: text("token_mint").notNull(),
  solSpent: numeric("sol_spent", { precision: 20, scale: 9 }).notNull(),
  tokensReceived: numeric("tokens_received", { precision: 20, scale: 9 }),
  txSignature: text("tx_signature"),
  reason: text("reason"),
  status: text("status").notNull().default("pending"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertBuybackRecordSchema = createInsertSchema(buybackRecords).omit({ id: true, createdAt: true });
export type InsertBuybackRecord = z.infer<typeof insertBuybackRecordSchema>;
export type BuybackRecord = typeof buybackRecords.$inferSelect;

// ============================================
// API REQUEST VALIDATION SCHEMAS
// ============================================

// Token Deploy Request
export const deployTokenRequestSchema = z.object({
  name: z.string().min(1).max(32),
  symbol: z.string().min(1).max(10),
  description: z.string().max(1000).optional(),
  imageUri: z.string().url().optional(),
  twitter: z.string().optional(),
  telegram: z.string().optional(),
  website: z.string().url().optional(),
  initialBuyAmount: z.number().min(0).optional(), // SOL amount for initial buy
});
export type DeployTokenRequest = z.infer<typeof deployTokenRequestSchema>;

// Airdrop Request
export const airdropRequestSchema = z.object({
  type: z.enum(["token", "sol"]),
  tokenMint: z.string().optional(),
  recipients: z.array(z.object({
    wallet: z.string(),
    amount: z.number().positive(),
  })).min(1),
  useSnapshot: z.boolean().optional(),
  snapshotId: z.string().optional(),
});
export type AirdropRequest = z.infer<typeof airdropRequestSchema>;

// Burn Request
export const burnRequestSchema = z.object({
  tokenMint: z.string(),
  amount: z.number().positive(),
  reason: z.string().optional(),
});
export type BurnRequest = z.infer<typeof burnRequestSchema>;

// Buyback Request
export const buybackRequestSchema = z.object({
  tokenMint: z.string(),
  solAmount: z.number().positive(),
  reason: z.string().optional(),
});
export type BuybackRequest = z.infer<typeof buybackRequestSchema>;

// Snapshot Request
export const snapshotRequestSchema = z.object({
  tokenMint: z.string(),
});
export type SnapshotRequest = z.infer<typeof snapshotRequestSchema>;

// Claim Rewards Request
export const claimRewardsRequestSchema = z.object({
  tokenMint: z.string(),
});
export type ClaimRewardsRequest = z.infer<typeof claimRewardsRequestSchema>;

// ============================================
// RESPONSE TYPES
// ============================================

export interface DashboardStats {
  treasurySol: string;
  treasuryToken: string;
  marketCap: string;
  volume24h: string;
  holderCount: number;
  bondingCurveProgress: string;
  isGraduated: boolean;
  tokenMint: string | null;
}

export interface HolderInfo {
  wallet: string;
  balance: string;
  percentage: string;
}

export interface TransactionResult {
  success: boolean;
  txSignature?: string;
  error?: string;
}

// Legacy User types (keeping for compatibility)
export const users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
});

export const insertUserSchema = createInsertSchema(users).pick({
  username: true,
  password: true,
});

export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;

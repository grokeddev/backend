import { randomUUID } from "crypto";
import type {
  User, InsertUser,
  Wallet, InsertWallet,
  Token, InsertToken,
  TreasuryState, InsertTreasuryState,
  MarketData, InsertMarketData,
  HolderSnapshot, InsertHolderSnapshot,
  ActivityLog, InsertActivityLog,
  Airdrop, InsertAirdrop,
  CreatorReward, InsertCreatorReward,
  BurnRecord, InsertBurnRecord,
  BuybackRecord, InsertBuybackRecord,
} from "@shared/schema";

export interface IStorage {
  // Users
  getUser(id: string): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;

  // Wallets
  getWallet(id: string): Promise<Wallet | undefined>;
  getWalletByPublicKey(publicKey: string): Promise<Wallet | undefined>;
  getWalletsByType(type: string): Promise<Wallet[]>;
  createWallet(wallet: InsertWallet): Promise<Wallet>;
  getTreasuryWallet(): Promise<Wallet | undefined>;

  // Tokens
  getToken(id: string): Promise<Token | undefined>;
  getTokenByMint(mint: string): Promise<Token | undefined>;
  getAllTokens(): Promise<Token[]>;
  createToken(token: InsertToken): Promise<Token>;
  updateToken(id: string, updates: Partial<Token>): Promise<Token | undefined>;
  getActiveToken(): Promise<Token | undefined>;

  // Treasury State
  getTreasuryState(): Promise<TreasuryState | undefined>;
  updateTreasuryState(updates: Partial<TreasuryState>): Promise<TreasuryState>;

  // Market Data
  getLatestMarketData(tokenMint: string): Promise<MarketData | undefined>;
  getMarketDataHistory(tokenMint: string, limit?: number): Promise<MarketData[]>;
  createMarketData(data: InsertMarketData): Promise<MarketData>;

  // Holder Snapshots
  getHolderSnapshot(id: string): Promise<HolderSnapshot | undefined>;
  getLatestSnapshot(tokenMint: string): Promise<HolderSnapshot | undefined>;
  getSnapshotHistory(tokenMint: string, limit?: number): Promise<HolderSnapshot[]>;
  createHolderSnapshot(snapshot: InsertHolderSnapshot): Promise<HolderSnapshot>;

  // Activity Logs
  getActivityLog(id: string): Promise<ActivityLog | undefined>;
  getActivityLogs(limit?: number, offset?: number): Promise<ActivityLog[]>;
  getActivityLogsByType(type: string, limit?: number): Promise<ActivityLog[]>;
  createActivityLog(log: InsertActivityLog): Promise<ActivityLog>;
  updateActivityLog(id: string, updates: Partial<ActivityLog>): Promise<ActivityLog | undefined>;

  // Airdrops
  getAirdrop(id: string): Promise<Airdrop | undefined>;
  getAirdrops(limit?: number): Promise<Airdrop[]>;
  createAirdrop(airdrop: InsertAirdrop): Promise<Airdrop>;
  updateAirdrop(id: string, updates: Partial<Airdrop>): Promise<Airdrop | undefined>;

  // Creator Rewards
  getCreatorReward(id: string): Promise<CreatorReward | undefined>;
  getCreatorRewards(tokenMint?: string): Promise<CreatorReward[]>;
  getPendingRewards(tokenMint: string): Promise<CreatorReward[]>;
  createCreatorReward(reward: InsertCreatorReward): Promise<CreatorReward>;
  updateCreatorReward(id: string, updates: Partial<CreatorReward>): Promise<CreatorReward | undefined>;

  // Burn Records
  getBurnRecord(id: string): Promise<BurnRecord | undefined>;
  getBurnRecords(tokenMint?: string): Promise<BurnRecord[]>;
  createBurnRecord(record: InsertBurnRecord): Promise<BurnRecord>;
  updateBurnRecord(id: string, updates: Partial<BurnRecord>): Promise<BurnRecord | undefined>;

  // Buyback Records
  getBuybackRecord(id: string): Promise<BuybackRecord | undefined>;
  getBuybackRecords(tokenMint?: string): Promise<BuybackRecord[]>;
  createBuybackRecord(record: InsertBuybackRecord): Promise<BuybackRecord>;
  updateBuybackRecord(id: string, updates: Partial<BuybackRecord>): Promise<BuybackRecord | undefined>;
}

export class MemStorage implements IStorage {
  private users: Map<string, User>;
  private wallets: Map<string, Wallet>;
  private tokens: Map<string, Token>;
  private treasuryState: TreasuryState | undefined;
  private marketData: Map<string, MarketData>;
  private holderSnapshots: Map<string, HolderSnapshot>;
  private activityLogs: Map<string, ActivityLog>;
  private airdrops: Map<string, Airdrop>;
  private creatorRewards: Map<string, CreatorReward>;
  private burnRecords: Map<string, BurnRecord>;
  private buybackRecords: Map<string, BuybackRecord>;

  constructor() {
    this.users = new Map();
    this.wallets = new Map();
    this.tokens = new Map();
    this.marketData = new Map();
    this.holderSnapshots = new Map();
    this.activityLogs = new Map();
    this.airdrops = new Map();
    this.creatorRewards = new Map();
    this.burnRecords = new Map();
    this.buybackRecords = new Map();
  }

  // Users
  async getUser(id: string): Promise<User | undefined> {
    return this.users.get(id);
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    return Array.from(this.users.values()).find(user => user.username === username);
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const id = randomUUID();
    const user: User = { ...insertUser, id };
    this.users.set(id, user);
    return user;
  }

  // Wallets
  async getWallet(id: string): Promise<Wallet | undefined> {
    return this.wallets.get(id);
  }

  async getWalletByPublicKey(publicKey: string): Promise<Wallet | undefined> {
    return Array.from(this.wallets.values()).find(w => w.publicKey === publicKey);
  }

  async getWalletsByType(type: string): Promise<Wallet[]> {
    return Array.from(this.wallets.values()).filter(w => w.type === type);
  }

  async createWallet(insertWallet: InsertWallet): Promise<Wallet> {
    const id = randomUUID();
    const wallet: Wallet = {
      ...insertWallet,
      id,
      createdAt: new Date(),
    };
    this.wallets.set(id, wallet);
    return wallet;
  }

  async getTreasuryWallet(): Promise<Wallet | undefined> {
    return Array.from(this.wallets.values()).find(w => w.type === "treasury");
  }

  // Tokens
  async getToken(id: string): Promise<Token | undefined> {
    return this.tokens.get(id);
  }

  async getTokenByMint(mint: string): Promise<Token | undefined> {
    return Array.from(this.tokens.values()).find(t => t.mint === mint);
  }

  async getAllTokens(): Promise<Token[]> {
    return Array.from(this.tokens.values());
  }

  async createToken(insertToken: InsertToken): Promise<Token> {
    const id = randomUUID();
    const token: Token = {
      ...insertToken,
      id,
      createdAt: new Date(),
    };
    this.tokens.set(id, token);
    return token;
  }

  async updateToken(id: string, updates: Partial<Token>): Promise<Token | undefined> {
    const token = this.tokens.get(id);
    if (!token) return undefined;
    const updated = { ...token, ...updates };
    this.tokens.set(id, updated);
    return updated;
  }

  async getActiveToken(): Promise<Token | undefined> {
    return Array.from(this.tokens.values()).find(t => t.status === "active");
  }

  // Treasury State
  async getTreasuryState(): Promise<TreasuryState | undefined> {
    return this.treasuryState;
  }

  async updateTreasuryState(updates: Partial<TreasuryState>): Promise<TreasuryState> {
    if (!this.treasuryState) {
      this.treasuryState = {
        id: randomUUID(),
        solBalance: "0",
        tokenBalance: "0",
        tokenMint: null,
        lastUpdated: new Date(),
      };
    }
    this.treasuryState = {
      ...this.treasuryState,
      ...updates,
      lastUpdated: new Date(),
    };
    return this.treasuryState;
  }

  // Market Data
  async getLatestMarketData(tokenMint: string): Promise<MarketData | undefined> {
    const all = Array.from(this.marketData.values())
      .filter(m => m.tokenMint === tokenMint)
      .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
    return all[0];
  }

  async getMarketDataHistory(tokenMint: string, limit = 100): Promise<MarketData[]> {
    return Array.from(this.marketData.values())
      .filter(m => m.tokenMint === tokenMint)
      .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
      .slice(0, limit);
  }

  async createMarketData(insertData: InsertMarketData): Promise<MarketData> {
    const id = randomUUID();
    const data: MarketData = {
      ...insertData,
      id,
      timestamp: new Date(),
    };
    this.marketData.set(id, data);
    return data;
  }

  // Holder Snapshots
  async getHolderSnapshot(id: string): Promise<HolderSnapshot | undefined> {
    return this.holderSnapshots.get(id);
  }

  async getLatestSnapshot(tokenMint: string): Promise<HolderSnapshot | undefined> {
    const all = Array.from(this.holderSnapshots.values())
      .filter(s => s.tokenMint === tokenMint)
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
    return all[0];
  }

  async getSnapshotHistory(tokenMint: string, limit = 50): Promise<HolderSnapshot[]> {
    return Array.from(this.holderSnapshots.values())
      .filter(s => s.tokenMint === tokenMint)
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
      .slice(0, limit);
  }

  async createHolderSnapshot(insertSnapshot: InsertHolderSnapshot): Promise<HolderSnapshot> {
    const id = randomUUID();
    const snapshot: HolderSnapshot = {
      ...insertSnapshot,
      id,
      createdAt: new Date(),
    };
    this.holderSnapshots.set(id, snapshot);
    return snapshot;
  }

  // Activity Logs
  async getActivityLog(id: string): Promise<ActivityLog | undefined> {
    return this.activityLogs.get(id);
  }

  async getActivityLogs(limit = 100, offset = 0): Promise<ActivityLog[]> {
    return Array.from(this.activityLogs.values())
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
      .slice(offset, offset + limit);
  }

  async getActivityLogsByType(type: string, limit = 50): Promise<ActivityLog[]> {
    return Array.from(this.activityLogs.values())
      .filter(l => l.type === type)
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
      .slice(0, limit);
  }

  async createActivityLog(insertLog: InsertActivityLog): Promise<ActivityLog> {
    const id = randomUUID();
    const log: ActivityLog = {
      ...insertLog,
      id,
      createdAt: new Date(),
    };
    this.activityLogs.set(id, log);
    return log;
  }

  async updateActivityLog(id: string, updates: Partial<ActivityLog>): Promise<ActivityLog | undefined> {
    const log = this.activityLogs.get(id);
    if (!log) return undefined;
    const updated = { ...log, ...updates };
    this.activityLogs.set(id, updated);
    return updated;
  }

  // Airdrops
  async getAirdrop(id: string): Promise<Airdrop | undefined> {
    return this.airdrops.get(id);
  }

  async getAirdrops(limit = 50): Promise<Airdrop[]> {
    return Array.from(this.airdrops.values())
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
      .slice(0, limit);
  }

  async createAirdrop(insertAirdrop: InsertAirdrop): Promise<Airdrop> {
    const id = randomUUID();
    const airdrop: Airdrop = {
      ...insertAirdrop,
      id,
      createdAt: new Date(),
      completedAt: null,
    };
    this.airdrops.set(id, airdrop);
    return airdrop;
  }

  async updateAirdrop(id: string, updates: Partial<Airdrop>): Promise<Airdrop | undefined> {
    const airdrop = this.airdrops.get(id);
    if (!airdrop) return undefined;
    const updated = { ...airdrop, ...updates };
    this.airdrops.set(id, updated);
    return updated;
  }

  // Creator Rewards
  async getCreatorReward(id: string): Promise<CreatorReward | undefined> {
    return this.creatorRewards.get(id);
  }

  async getCreatorRewards(tokenMint?: string): Promise<CreatorReward[]> {
    let rewards = Array.from(this.creatorRewards.values());
    if (tokenMint) {
      rewards = rewards.filter(r => r.tokenMint === tokenMint);
    }
    return rewards.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  }

  async getPendingRewards(tokenMint: string): Promise<CreatorReward[]> {
    return Array.from(this.creatorRewards.values())
      .filter(r => r.tokenMint === tokenMint && r.status === "pending");
  }

  async createCreatorReward(insertReward: InsertCreatorReward): Promise<CreatorReward> {
    const id = randomUUID();
    const reward: CreatorReward = {
      ...insertReward,
      id,
      createdAt: new Date(),
      claimedAt: null,
    };
    this.creatorRewards.set(id, reward);
    return reward;
  }

  async updateCreatorReward(id: string, updates: Partial<CreatorReward>): Promise<CreatorReward | undefined> {
    const reward = this.creatorRewards.get(id);
    if (!reward) return undefined;
    const updated = { ...reward, ...updates };
    this.creatorRewards.set(id, updated);
    return updated;
  }

  // Burn Records
  async getBurnRecord(id: string): Promise<BurnRecord | undefined> {
    return this.burnRecords.get(id);
  }

  async getBurnRecords(tokenMint?: string): Promise<BurnRecord[]> {
    let records = Array.from(this.burnRecords.values());
    if (tokenMint) {
      records = records.filter(r => r.tokenMint === tokenMint);
    }
    return records.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  }

  async createBurnRecord(insertRecord: InsertBurnRecord): Promise<BurnRecord> {
    const id = randomUUID();
    const record: BurnRecord = {
      ...insertRecord,
      id,
      createdAt: new Date(),
    };
    this.burnRecords.set(id, record);
    return record;
  }

  async updateBurnRecord(id: string, updates: Partial<BurnRecord>): Promise<BurnRecord | undefined> {
    const record = this.burnRecords.get(id);
    if (!record) return undefined;
    const updated = { ...record, ...updates };
    this.burnRecords.set(id, updated);
    return updated;
  }

  // Buyback Records
  async getBuybackRecord(id: string): Promise<BuybackRecord | undefined> {
    return this.buybackRecords.get(id);
  }

  async getBuybackRecords(tokenMint?: string): Promise<BuybackRecord[]> {
    let records = Array.from(this.buybackRecords.values());
    if (tokenMint) {
      records = records.filter(r => r.tokenMint === tokenMint);
    }
    return records.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  }

  async createBuybackRecord(insertRecord: InsertBuybackRecord): Promise<BuybackRecord> {
    const id = randomUUID();
    const record: BuybackRecord = {
      ...insertRecord,
      id,
      createdAt: new Date(),
    };
    this.buybackRecords.set(id, record);
    return record;
  }

  async updateBuybackRecord(id: string, updates: Partial<BuybackRecord>): Promise<BuybackRecord | undefined> {
    const record = this.buybackRecords.get(id);
    if (!record) return undefined;
    const updated = { ...record, ...updates };
    this.buybackRecords.set(id, updated);
    return updated;
  }
}

export const storage = new MemStorage();

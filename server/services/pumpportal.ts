import { Keypair, VersionedTransaction, Connection } from "@solana/web3.js";
import bs58 from "bs58";
import type { DeployTokenRequest, TransactionResult } from "@shared/schema";

// PumpPortal API endpoints
const PUMPPORTAL_API = "https://pumpportal.fun/api";
const PUMP_FUN_API = "https://frontend-api-v3.pump.fun";

// Solana RPC
const SOLANA_RPC_URL = process.env.SOLANA_RPC_URL || "https://api.mainnet-beta.solana.com";
const HELIUS_API_KEY = process.env.HELIUS_API_KEY;
const HELIUS_RPC_URL = HELIUS_API_KEY
  ? `https://mainnet.helius-rpc.com/?api-key=${HELIUS_API_KEY}`
  : null;

const connection = new Connection(HELIUS_RPC_URL || SOLANA_RPC_URL, "confirmed");

export interface PumpTokenData {
  mint: string;
  name: string;
  symbol: string;
  description?: string;
  image_uri?: string;
  metadata_uri?: string;
  twitter?: string;
  telegram?: string;
  website?: string;
  bonding_curve?: string;
  associated_bonding_curve?: string;
  creator?: string;
  created_timestamp?: number;
  raydium_pool?: string;
  complete?: boolean;
  virtual_sol_reserves?: number;
  virtual_token_reserves?: number;
  total_supply?: number;
  market_cap?: number;
  usd_market_cap?: number;
}

export interface MarketDataResponse {
  marketCap: string;
  price: string;
  volume24h: string;
  holderCount: number;
  liquidity: string;
  bondingCurveProgress: string;
  isGraduated: boolean;
}

export class PumpPortalService {
  private connection: Connection;

  constructor() {
    this.connection = connection;
  }

  /**
   * Deploy a new token on Pump.fun via PumpPortal
   * Documentation: https://pumpportal.fun/creation
   */
  async deployToken(
    creatorPrivateKey: string,
    tokenData: DeployTokenRequest,
    imageFile?: Buffer
  ): Promise<{ success: boolean; mint?: string; signature?: string; error?: string }> {
    try {
      const creatorKeypair = Keypair.fromSecretKey(bs58.decode(creatorPrivateKey));
      const mintKeypair = Keypair.generate();

      // Prepare form data for IPFS upload and token creation
      const formData = new FormData();
      formData.append("name", tokenData.name);
      formData.append("symbol", tokenData.symbol);
      if (tokenData.description) formData.append("description", tokenData.description);
      if (tokenData.twitter) formData.append("twitter", tokenData.twitter);
      if (tokenData.telegram) formData.append("telegram", tokenData.telegram);
      if (tokenData.website) formData.append("website", tokenData.website);
      formData.append("showName", "true");

      // If image file provided, upload it
      if (imageFile) {
        const blob = new Blob([imageFile], { type: "image/png" });
        formData.append("file", blob, "token-image.png");
      } else if (tokenData.imageUri) {
        // Use provided image URI
        formData.append("imageUrl", tokenData.imageUri);
      }

      // Create IPFS metadata via PumpPortal
      const metadataResponse = await fetch(`${PUMPPORTAL_API}/ipfs`, {
        method: "POST",
        body: formData,
      });

      if (!metadataResponse.ok) {
        throw new Error(`Failed to create metadata: ${metadataResponse.statusText}`);
      }

      const metadataResult = await metadataResponse.json();

      // Now create the token transaction
      const createTokenResponse = await fetch(`${PUMPPORTAL_API}/trade-local`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          publicKey: creatorKeypair.publicKey.toBase58(),
          action: "create",
          tokenMetadata: {
            name: metadataResult.metadata.name,
            symbol: metadataResult.metadata.symbol,
            uri: metadataResult.metadataUri,
          },
          mint: mintKeypair.publicKey.toBase58(),
          denominatedInSol: "true",
          amount: tokenData.initialBuyAmount || 0, // Initial buy amount in SOL
          slippage: 10,
          priorityFee: 0.0005,
          pool: "pump",
        }),
      });

      if (!createTokenResponse.ok) {
        throw new Error(`Failed to create token: ${createTokenResponse.statusText}`);
      }

      // Get the transaction bytes
      const txData = await createTokenResponse.arrayBuffer();
      const tx = VersionedTransaction.deserialize(new Uint8Array(txData));

      // Sign with both creator and mint keypairs
      tx.sign([mintKeypair, creatorKeypair]);

      // Send transaction
      const signature = await this.connection.sendTransaction(tx);
      await this.connection.confirmTransaction(signature, "confirmed");

      return {
        success: true,
        mint: mintKeypair.publicKey.toBase58(),
        signature,
      };
    } catch (error: any) {
      console.error("Error deploying token:", error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Get token data from Pump.fun API
   */
  async getTokenData(mintAddress: string): Promise<PumpTokenData | null> {
    try {
      const response = await fetch(`${PUMP_FUN_API}/coins/${mintAddress}`);
      
      if (!response.ok) {
        if (response.status === 404) return null;
        throw new Error(`Pump.fun API error: ${response.statusText}`);
      }

      return await response.json();
    } catch (error) {
      console.error("Error getting token data:", error);
      return null;
    }
  }

  /**
   * Get market data for a token
   */
  async getMarketData(mintAddress: string): Promise<MarketDataResponse | null> {
    try {
      const tokenData = await this.getTokenData(mintAddress);
      
      if (!tokenData) return null;

      const isGraduated = tokenData.complete || !!tokenData.raydium_pool;
      
      // Calculate bonding curve progress
      let bondingCurveProgress = "0";
      if (tokenData.virtual_sol_reserves && !isGraduated) {
        // Bonding curve typically graduates at ~85 SOL
        const progress = Math.min((tokenData.virtual_sol_reserves / 85) * 100, 100);
        bondingCurveProgress = progress.toFixed(2);
      } else if (isGraduated) {
        bondingCurveProgress = "100";
      }

      return {
        marketCap: tokenData.usd_market_cap?.toString() || tokenData.market_cap?.toString() || "0",
        price: tokenData.virtual_token_reserves && tokenData.virtual_sol_reserves
          ? (tokenData.virtual_sol_reserves / tokenData.virtual_token_reserves).toString()
          : "0",
        volume24h: "0", // Would need separate API call
        holderCount: 0, // Would need Helius API
        liquidity: tokenData.virtual_sol_reserves?.toString() || "0",
        bondingCurveProgress,
        isGraduated,
      };
    } catch (error) {
      console.error("Error getting market data:", error);
      return null;
    }
  }

  /**
   * Claim creator rewards from Pump.fun
   * Documentation: https://pumpportal.fun/creator-fee/
   */
  async claimCreatorRewards(
    creatorPrivateKey: string,
    mintAddress: string
  ): Promise<TransactionResult> {
    try {
      const creatorKeypair = Keypair.fromSecretKey(bs58.decode(creatorPrivateKey));

      // Get the claim transaction from PumpPortal
      const claimResponse = await fetch(`${PUMPPORTAL_API}/claim-creator-fee`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          publicKey: creatorKeypair.publicKey.toBase58(),
          mint: mintAddress,
        }),
      });

      if (!claimResponse.ok) {
        const errorText = await claimResponse.text();
        throw new Error(`Failed to claim rewards: ${errorText}`);
      }

      // Get the transaction bytes
      const txData = await claimResponse.arrayBuffer();
      const tx = VersionedTransaction.deserialize(new Uint8Array(txData));

      // Sign the transaction
      tx.sign([creatorKeypair]);

      // Send transaction
      const signature = await this.connection.sendTransaction(tx);
      await this.connection.confirmTransaction(signature, "confirmed");

      return { success: true, txSignature: signature };
    } catch (error: any) {
      console.error("Error claiming creator rewards:", error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Execute a buy on Pump.fun
   */
  async buyToken(
    buyerPrivateKey: string,
    mintAddress: string,
    solAmount: number
  ): Promise<TransactionResult> {
    try {
      const buyerKeypair = Keypair.fromSecretKey(bs58.decode(buyerPrivateKey));

      const buyResponse = await fetch(`${PUMPPORTAL_API}/trade-local`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          publicKey: buyerKeypair.publicKey.toBase58(),
          action: "buy",
          mint: mintAddress,
          denominatedInSol: "true",
          amount: solAmount,
          slippage: 10,
          priorityFee: 0.0005,
          pool: "pump",
        }),
      });

      if (!buyResponse.ok) {
        throw new Error(`Failed to buy token: ${buyResponse.statusText}`);
      }

      const txData = await buyResponse.arrayBuffer();
      const tx = VersionedTransaction.deserialize(new Uint8Array(txData));

      tx.sign([buyerKeypair]);

      const signature = await this.connection.sendTransaction(tx);
      await this.connection.confirmTransaction(signature, "confirmed");

      return { success: true, txSignature: signature };
    } catch (error: any) {
      console.error("Error buying token:", error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Execute a sell on Pump.fun
   */
  async sellToken(
    sellerPrivateKey: string,
    mintAddress: string,
    tokenAmount: number
  ): Promise<TransactionResult> {
    try {
      const sellerKeypair = Keypair.fromSecretKey(bs58.decode(sellerPrivateKey));

      const sellResponse = await fetch(`${PUMPPORTAL_API}/trade-local`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          publicKey: sellerKeypair.publicKey.toBase58(),
          action: "sell",
          mint: mintAddress,
          denominatedInSol: "false",
          amount: tokenAmount,
          slippage: 10,
          priorityFee: 0.0005,
          pool: "pump",
        }),
      });

      if (!sellResponse.ok) {
        throw new Error(`Failed to sell token: ${sellResponse.statusText}`);
      }

      const txData = await sellResponse.arrayBuffer();
      const tx = VersionedTransaction.deserialize(new Uint8Array(txData));

      tx.sign([sellerKeypair]);

      const signature = await this.connection.sendTransaction(tx);
      await this.connection.confirmTransaction(signature, "confirmed");

      return { success: true, txSignature: signature };
    } catch (error: any) {
      console.error("Error selling token:", error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Get pending creator rewards amount
   */
  async getPendingRewards(mintAddress: string): Promise<number> {
    try {
      const response = await fetch(`${PUMPPORTAL_API}/creator-fee-info?mint=${mintAddress}`);
      
      if (!response.ok) {
        return 0;
      }

      const data = await response.json();
      return data.pendingAmount || 0;
    } catch (error) {
      console.error("Error getting pending rewards:", error);
      return 0;
    }
  }
}

export const pumpPortalService = new PumpPortalService();

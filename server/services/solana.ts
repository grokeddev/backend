import {
  Connection,
  Keypair,
  PublicKey,
  Transaction,
  SystemProgram,
  LAMPORTS_PER_SOL,
  sendAndConfirmTransaction,
  TransactionInstruction,
  ComputeBudgetProgram,
} from "@solana/web3.js";
import {
  createTransferInstruction,
  getAssociatedTokenAddress,
  createAssociatedTokenAccountInstruction,
  TOKEN_PROGRAM_ID,
  ASSOCIATED_TOKEN_PROGRAM_ID,
  createBurnInstruction,
  getAccount,
  getMint,
} from "@solana/spl-token";
import bs58 from "bs58";
import type { TransactionResult, HolderInfo } from "@shared/schema";

// Solana RPC endpoints
const SOLANA_RPC_URL = process.env.SOLANA_RPC_URL || "https://api.mainnet-beta.solana.com";
const HELIUS_API_KEY = process.env.HELIUS_API_KEY;
const HELIUS_RPC_URL = HELIUS_API_KEY
  ? `https://mainnet.helius-rpc.com/?api-key=${HELIUS_API_KEY}`
  : null;

// Use Helius if available, otherwise default RPC
const connection = new Connection(HELIUS_RPC_URL || SOLANA_RPC_URL, "confirmed");

export class SolanaService {
  private connection: Connection;

  constructor() {
    this.connection = connection;
  }

  /**
   * Generate a new Solana keypair
   */
  generateWallet(): { publicKey: string; privateKey: string } {
    const keypair = Keypair.generate();
    return {
      publicKey: keypair.publicKey.toBase58(),
      privateKey: bs58.encode(keypair.secretKey),
    };
  }

  /**
   * Restore keypair from private key
   */
  getKeypairFromPrivateKey(privateKey: string): Keypair {
    const secretKey = bs58.decode(privateKey);
    return Keypair.fromSecretKey(secretKey);
  }

  /**
   * Get SOL balance for a wallet
   */
  async getSolBalance(publicKey: string): Promise<number> {
    try {
      const balance = await this.connection.getBalance(new PublicKey(publicKey));
      return balance / LAMPORTS_PER_SOL;
    } catch (error) {
      console.error("Error getting SOL balance:", error);
      return 0;
    }
  }

  /**
   * Get token decimals from mint account
   */
  async getTokenDecimals(tokenMint: string): Promise<number> {
    try {
      const mint = new PublicKey(tokenMint);
      const mintInfo = await getMint(this.connection, mint);
      return mintInfo.decimals;
    } catch (error) {
      console.error("Error getting token decimals:", error);
      return 6; // Default fallback
    }
  }

  /**
   * Get SPL token balance for a wallet
   */
  async getTokenBalance(walletAddress: string, tokenMint: string): Promise<number> {
    try {
      const wallet = new PublicKey(walletAddress);
      const mint = new PublicKey(tokenMint);
      const tokenAccount = await getAssociatedTokenAddress(mint, wallet);
      
      const account = await getAccount(this.connection, tokenAccount);
      const decimals = await this.getTokenDecimals(tokenMint);
      return Number(account.amount) / Math.pow(10, decimals);
    } catch (error) {
      console.error("Error getting token balance:", error);
      return 0;
    }
  }

  /**
   * Transfer SOL to another wallet
   */
  async transferSol(
    fromPrivateKey: string,
    toAddress: string,
    amount: number
  ): Promise<TransactionResult> {
    try {
      const fromKeypair = this.getKeypairFromPrivateKey(fromPrivateKey);
      const toPublicKey = new PublicKey(toAddress);

      const transaction = new Transaction().add(
        SystemProgram.transfer({
          fromPubkey: fromKeypair.publicKey,
          toPubkey: toPublicKey,
          lamports: Math.floor(amount * LAMPORTS_PER_SOL),
        })
      );

      const signature = await sendAndConfirmTransaction(
        this.connection,
        transaction,
        [fromKeypair]
      );

      return { success: true, txSignature: signature };
    } catch (error: any) {
      console.error("Error transferring SOL:", error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Transfer SPL tokens to another wallet
   */
  async transferToken(
    fromPrivateKey: string,
    toAddress: string,
    tokenMint: string,
    amount: number
  ): Promise<TransactionResult> {
    try {
      const fromKeypair = this.getKeypairFromPrivateKey(fromPrivateKey);
      const toPublicKey = new PublicKey(toAddress);
      const mintPublicKey = new PublicKey(tokenMint);

      const fromTokenAccount = await getAssociatedTokenAddress(
        mintPublicKey,
        fromKeypair.publicKey
      );
      const toTokenAccount = await getAssociatedTokenAddress(
        mintPublicKey,
        toPublicKey
      );

      const transaction = new Transaction();

      // Check if recipient has token account, if not create it
      try {
        await getAccount(this.connection, toTokenAccount);
      } catch {
        transaction.add(
          createAssociatedTokenAccountInstruction(
            fromKeypair.publicKey,
            toTokenAccount,
            toPublicKey,
            mintPublicKey
          )
        );
      }

      // Get token decimals dynamically
      const decimals = await this.getTokenDecimals(tokenMint);

      // Add transfer instruction
      transaction.add(
        createTransferInstruction(
          fromTokenAccount,
          toTokenAccount,
          fromKeypair.publicKey,
          Math.floor(amount * Math.pow(10, decimals))
        )
      );

      const signature = await sendAndConfirmTransaction(
        this.connection,
        transaction,
        [fromKeypair]
      );

      return { success: true, txSignature: signature };
    } catch (error: any) {
      console.error("Error transferring tokens:", error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Burn SPL tokens
   */
  async burnTokens(
    ownerPrivateKey: string,
    tokenMint: string,
    amount: number
  ): Promise<TransactionResult> {
    try {
      const ownerKeypair = this.getKeypairFromPrivateKey(ownerPrivateKey);
      const mintPublicKey = new PublicKey(tokenMint);

      const tokenAccount = await getAssociatedTokenAddress(
        mintPublicKey,
        ownerKeypair.publicKey
      );

      // Get token decimals dynamically
      const decimals = await this.getTokenDecimals(tokenMint);

      const transaction = new Transaction().add(
        createBurnInstruction(
          tokenAccount,
          mintPublicKey,
          ownerKeypair.publicKey,
          Math.floor(amount * Math.pow(10, decimals))
        )
      );

      const signature = await sendAndConfirmTransaction(
        this.connection,
        transaction,
        [ownerKeypair]
      );

      return { success: true, txSignature: signature };
    } catch (error: any) {
      console.error("Error burning tokens:", error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Get token holders using Helius API
   */
  async getTokenHolders(tokenMint: string): Promise<HolderInfo[]> {
    if (!HELIUS_API_KEY) {
      console.warn("Helius API key not configured, cannot fetch holders");
      return [];
    }

    try {
      const response = await fetch(
        `https://api.helius.xyz/v0/token-metadata?api-key=${HELIUS_API_KEY}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            mintAccounts: [tokenMint],
            includeOffChain: true,
            disableCache: false,
          }),
        }
      );

      if (!response.ok) {
        throw new Error(`Helius API error: ${response.statusText}`);
      }

      // Get token accounts
      const holdersResponse = await fetch(
        `https://api.helius.xyz/v0/addresses/${tokenMint}/token-accounts?api-key=${HELIUS_API_KEY}`
      );

      if (!holdersResponse.ok) {
        throw new Error(`Helius holders API error: ${holdersResponse.statusText}`);
      }

      const holdersData = await holdersResponse.json();
      
      // Calculate total supply held
      let totalHeld = 0;
      const holders: HolderInfo[] = [];

      // Get decimals for proper balance calculation
      const decimals = await this.getTokenDecimals(tokenMint);

      for (const account of holdersData.token_accounts || []) {
        const balance = Number(account.amount) / Math.pow(10, decimals);
        totalHeld += balance;
        holders.push({
          wallet: account.owner,
          balance: balance.toString(),
          percentage: "0", // Will be calculated after
        });
      }

      // Calculate percentages
      for (const holder of holders) {
        const balance = parseFloat(holder.balance);
        holder.percentage = totalHeld > 0
          ? ((balance / totalHeld) * 100).toFixed(4)
          : "0";
      }

      // Sort by balance descending
      holders.sort((a, b) => parseFloat(b.balance) - parseFloat(a.balance));

      return holders;
    } catch (error) {
      console.error("Error getting token holders:", error);
      return [];
    }
  }

  /**
   * Get recent signatures for a wallet (for activity tracking)
   */
  async getRecentSignatures(
    walletAddress: string,
    limit: number = 10
  ): Promise<string[]> {
    try {
      const signatures = await this.connection.getSignaturesForAddress(
        new PublicKey(walletAddress),
        { limit }
      );
      return signatures.map((s) => s.signature);
    } catch (error) {
      console.error("Error getting recent signatures:", error);
      return [];
    }
  }

  /**
   * Batch airdrop SOL to multiple wallets
   */
  async batchAirdropSol(
    fromPrivateKey: string,
    recipients: Array<{ wallet: string; amount: number }>
  ): Promise<Array<{ wallet: string; result: TransactionResult }>> {
    const results = [];

    for (const recipient of recipients) {
      const result = await this.transferSol(
        fromPrivateKey,
        recipient.wallet,
        recipient.amount
      );
      results.push({ wallet: recipient.wallet, result });
      // Add small delay to avoid rate limiting
      await new Promise((resolve) => setTimeout(resolve, 100));
    }

    return results;
  }

  /**
   * Batch airdrop tokens to multiple wallets
   */
  async batchAirdropTokens(
    fromPrivateKey: string,
    tokenMint: string,
    recipients: Array<{ wallet: string; amount: number }>
  ): Promise<Array<{ wallet: string; result: TransactionResult }>> {
    const results = [];

    for (const recipient of recipients) {
      const result = await this.transferToken(
        fromPrivateKey,
        recipient.wallet,
        tokenMint,
        recipient.amount
      );
      results.push({ wallet: recipient.wallet, result });
      // Add small delay to avoid rate limiting
      await new Promise((resolve) => setTimeout(resolve, 100));
    }

    return results;
  }

  /**
   * Get connection instance
   */
  getConnection(): Connection {
    return this.connection;
  }
}

export const solanaService = new SolanaService();

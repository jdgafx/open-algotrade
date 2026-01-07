"use client";

import { useState } from "react";
import { ethers } from "ethers";
import { Keypair } from "@solana/web3.js";
import bs58 from "bs58";
import { useAccount, useSendTransaction } from "wagmi";
import { ConnectButton } from "@rainbow-me/rainbowkit";
import { parseEther } from "viem";
import { Eye, EyeOff, Wallet, RefreshCw, ArrowRight, ShieldCheck, Terminal } from "lucide-react";
import { cn } from "@/lib/utils";

interface GeneratedWallet {
  address: string;
  privateKey: string;
}

export function WalletManager() {
  const [ethWallet, setEthWallet] = useState<GeneratedWallet | null>(null);
  const [solWallet, setSolWallet] = useState<GeneratedWallet | null>(null);
  const [isVisible, setIsVisible] = useState(false);
  
  const { address, isConnected } = useAccount();
  const { sendTransaction, isPending: isFunding } = useSendTransaction();

  const generateWallets = () => {
    const eth = ethers.Wallet.createRandom();
    const sol = Keypair.generate();
    
    setEthWallet({
      address: eth.address,
      privateKey: eth.privateKey,
    });
    
    setSolWallet({
      address: sol.publicKey.toBase58(),
      privateKey: bs58.encode(sol.secretKey),
    });
    
    setIsVisible(false); 
  };

  const fundBot = () => {
    if (!ethWallet || !address) return;
    
    sendTransaction({
      to: ethWallet.address as `0x${string}`,
      value: parseEther("0.01"), 
    });
  };

  return (
    <div className="w-full bg-moon-card border border-moon-border rounded-xl p-8 shadow-2xl backdrop-blur-sm relative overflow-hidden group">
      <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-moon-green via-moon-cyan to-moon-green opacity-50 group-hover:opacity-100 transition-opacity" />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
        <div className="space-y-6">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 bg-moon-bg rounded-lg border border-moon-border">
              <Wallet className="w-6 h-6 text-moon-cyan" />
            </div>
            <h2 className="text-2xl font-bold text-moon-text">Controller Wallet</h2>
          </div>
          
          <p className="text-moon-text-dim text-sm">
            Connect Controller Wallet to authorize KAIROS operations.
          </p>

          <div className="p-4 bg-moon-bg/50 rounded-lg border border-moon-border/50 hover:border-moon-cyan/30 transition-colors">
            <ConnectButton 
              showBalance={true}
              accountStatus="full"
              chainStatus="icon"
            />
          </div>
        </div>

        <div className="space-y-6 relative">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 bg-moon-bg rounded-lg border border-moon-border">
              <Terminal className="w-6 h-6 text-moon-green" />
            </div>
            <h2 className="text-2xl font-bold text-moon-text">Bot Agent</h2>
          </div>

          {!ethWallet ? (
            <div className="flex flex-col items-center justify-center h-48 border-2 border-dashed border-moon-border rounded-xl bg-moon-bg/30 gap-4">
              <button
                onClick={generateWallets}
                className="flex items-center gap-2 px-6 py-3 bg-moon-green/10 text-moon-green border border-moon-green/20 rounded-lg hover:bg-moon-green/20 hover:scale-105 transition-all font-mono font-bold"
              >
                <RefreshCw className="w-4 h-4" />
                INITIALIZE_AGENT
              </button>
              <p className="text-xs text-moon-text-dim font-mono">Generates local ETH + SOL keys</p>
            </div>
          ) : (
            <div className="space-y-4 animate-in fade-in slide-in-from-bottom-4 duration-500">
              <div className="p-4 bg-moon-bg rounded-lg border border-moon-border group/card hover:border-moon-green/30 transition-all">
                <div className="flex justify-between items-center mb-2">
                  <span className="text-xs font-mono text-moon-green">ETH / HYPERLIQUID</span>
                  <ShieldCheck className="w-4 h-4 text-moon-green/50" />
                </div>
                <div className="font-mono text-sm text-moon-text truncate mb-2 select-all">
                  {ethWallet.address}
                </div>
                <div className="relative">
                  <div className="font-mono text-xs text-moon-text-dim truncate pr-8 bg-moon-card/50 p-2 rounded border border-moon-border/50">
                    {isVisible ? ethWallet.privateKey : "•".repeat(64)}
                  </div>
                  <button 
                    onClick={() => setIsVisible(!isVisible)}
                    className="absolute right-2 top-2 text-moon-text-dim hover:text-moon-text"
                  >
                    {isVisible ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
                  </button>
                </div>
              </div>

              <div className="p-4 bg-moon-bg rounded-lg border border-moon-border group/card hover:border-moon-cyan/30 transition-all">
                <div className="flex justify-between items-center mb-2">
                  <span className="text-xs font-mono text-moon-cyan">SOLANA</span>
                  <ShieldCheck className="w-4 h-4 text-moon-cyan/50" />
                </div>
                <div className="font-mono text-sm text-moon-text truncate mb-2 select-all">
                  {solWallet?.address}
                </div>
                <div className="relative">
                  <div className="font-mono text-xs text-moon-text-dim truncate pr-8 bg-moon-card/50 p-2 rounded border border-moon-border/50">
                    {isVisible ? solWallet?.privateKey : "•".repeat(88)}
                  </div>
                </div>
              </div>

              <div className="pt-2 flex gap-3">
                 <button
                  onClick={generateWallets}
                  className="flex-1 flex items-center justify-center gap-2 px-4 py-2 text-xs bg-moon-border/50 text-moon-text hover:bg-moon-border transition-colors rounded"
                >
                  <RefreshCw className="w-3 h-3" />
                  Rotate Keys
                </button>
                
                {isConnected && (
                  <button
                    onClick={fundBot}
                    disabled={isFunding}
                    className="flex-[2] flex items-center justify-center gap-2 px-4 py-2 text-xs bg-moon-green text-moon-bg font-bold hover:bg-moon-green/90 transition-colors rounded"
                  >
                    {isFunding ? "Processing..." : "Fund Agent (0.01 ETH)"}
                    <ArrowRight className="w-3 h-3" />
                  </button>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

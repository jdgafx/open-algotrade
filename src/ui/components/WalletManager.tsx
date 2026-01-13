"use client";

import { useState } from "react";
import { Eye, EyeOff, Wallet, RefreshCw, ArrowRight, ShieldCheck, Terminal, Copy } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";

interface GeneratedWallet {
  address: string;
  privateKey: string;
  type: "ETH" | "SOL";
}

export function WalletManager() {
  const [ethWallet, setEthWallet] = useState<GeneratedWallet | null>(null);
  const [solWallet, setSolWallet] = useState<GeneratedWallet | null>(null);
  const [isVisible, setIsVisible] = useState(false);
  const [isFunding, setIsFunding] = useState(false);
  const { toast } = useToast();

  const generateWallets = () => {
    // Simple Mock Wallets
    setEthWallet({
      address: "0x71C7656EC7ab88b098defB751B7401B5f6d8976F",
      privateKey: "0x" + Array(64).fill("a").join(""),
      type: "ETH"
    });
    
    setSolWallet({
      address: "5U6sBLD2QZ8d8...3k8d",
      privateKey: "5K...",
      type: "SOL"
    });
    
    setIsVisible(false);
    toast({
      title: "Agents Initialized",
      description: "Secure trading wallets have been generated locally.",
    });
  };

  const fundBot = () => {
    if (!ethWallet) return;
    setIsFunding(true);
    setTimeout(() => {
      setIsFunding(false);
      toast({
        title: "Funding Successful",
        description: "Transferred 0.01 ETH to Controller Agent.",
      });
    }, 1500);
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast({
      title: "Copied",
      description: "Address copied to clipboard",
    });
  };

  return (
    <Card className="w-full bg-card/50 backdrop-blur-sm border-border/40 shadow-xl overflow-hidden relative group">
      <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-green-500 via-emerald-500 to-green-500 opacity-50 group-hover:opacity-100 transition-opacity" />
      
      <CardContent className="p-8">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
          
          {/* Controller Section */}
          <div className="space-y-6">
            <div className="flex items-center gap-3 mb-2">
              <div className="p-2 bg-primary/10 rounded-lg border border-primary/20">
                <Wallet className="w-6 h-6 text-primary" />
              </div>
              <div>
                <h2 className="text-2xl font-bold tracking-tight">Controller Wallet</h2>
                <p className="text-muted-foreground text-sm">
                  Master control for KAIROS operations
                </p>
              </div>
            </div>
            
            <div className="p-6 bg-muted/30 rounded-lg border border-border/50 hover:border-primary/30 transition-colors flex items-center justify-center flex-col gap-4">
               <div className="w-12 h-12 bg-muted rounded-full flex items-center justify-center">
                 <ShieldCheck className="w-6 h-6 text-muted-foreground" />
               </div>
               <div className="text-center">
                 <p className="font-mono text-sm">Simulation Mode</p>
                 <Badge variant="secondary" className="mt-2">CONNECTED</Badge>
               </div>
            </div>
          </div>

          {/* Bot Agent Section */}
          <div className="space-y-6 relative">
            <div className="flex items-center gap-3 mb-2">
              <div className="p-2 bg-primary/10 rounded-lg border border-primary/20">
                <Terminal className="w-6 h-6 text-green-500" />
              </div>
              <div>
                <h2 className="text-2xl font-bold tracking-tight">Bot Agent</h2>
                <p className="text-muted-foreground text-sm">
                  Autonomous trading execution unit
                </p>
              </div>
            </div>

            {!ethWallet ? (
              <div className="flex flex-col items-center justify-center h-48 border-2 border-dashed border-border/50 rounded-xl bg-muted/10 gap-4">
                <Button
                  onClick={generateWallets}
                  variant="outline"
                  className="gap-2 border-green-500/20 text-green-500 hover:text-green-600 hover:bg-green-500/10 font-mono font-bold"
                >
                  <RefreshCw className="w-4 h-4" />
                  INITIALIZE_AGENT
                </Button>
                <p className="text-xs text-muted-foreground font-mono">Generates local ETH + SOL keys</p>
              </div>
            ) : (
              <div className="space-y-4 animate-in fade-in slide-in-from-bottom-4 duration-500">
                
                {/* ETH Wallet */}
                <div className="p-4 bg-card rounded-lg border border-border group/card hover:border-green-500/30 transition-all">
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-xs font-mono text-green-500">ETH / HYPERLIQUID</span>
                    <ShieldCheck className="w-4 h-4 text-green-500/50" />
                  </div>
                  <div className="flex items-center justify-between gap-2 bg-muted/50 p-2 rounded mb-2">
                    <div className="font-mono text-xs truncate select-all">
                      {ethWallet.address}
                    </div>
                    <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => copyToClipboard(ethWallet.address)}>
                      <Copy className="h-3 w-3" />
                    </Button>
                  </div>
                  <div className="relative">
                    <div className="font-mono text-xs text-muted-foreground truncate pr-8 bg-muted/30 p-2 rounded border border-border/50">
                      {isVisible ? ethWallet.privateKey : "•".repeat(42)}
                    </div>
                    <button 
                      onClick={() => setIsVisible(!isVisible)}
                      className="absolute right-2 top-2 text-muted-foreground hover:text-foreground"
                    >
                      {isVisible ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
                    </button>
                  </div>
                </div>

                {/* SOL Wallet */}
                <div className="p-4 bg-card rounded-lg border border-border group/card hover:border-blue-500/30 transition-all">
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-xs font-mono text-blue-500">SOLANA</span>
                    <ShieldCheck className="w-4 h-4 text-blue-500/50" />
                  </div>
                  <div className="flex items-center justify-between gap-2 bg-muted/50 p-2 rounded mb-2">
                     <div className="font-mono text-xs truncate select-all">
                      {solWallet?.address}
                    </div>
                    <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => copyToClipboard(solWallet?.address || "")}>
                      <Copy className="h-3 w-3" />
                    </Button>
                  </div>
                </div>

                <div className="pt-2 flex gap-3">
                   <Button
                    onClick={generateWallets}
                    variant="outline"
                    size="sm"
                    className="flex-1 gap-2 text-xs"
                  >
                    <RefreshCw className="w-3 h-3" />
                    Rotate Keys
                  </Button>
                  
                  <Button
                    onClick={fundBot}
                    disabled={isFunding}
                    size="sm"
                    className="flex-[2] gap-2 text-xs bg-green-600 hover:bg-green-700 text-white font-bold"
                  >
                    {isFunding ? "Processing..." : "Fund Agent (0.01 ETH)"}
                    <ArrowRight className="w-3 h-3" />
                  </Button>
                </div>
              </div>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

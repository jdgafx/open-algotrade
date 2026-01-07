import { WalletManager } from "@/components/WalletManager";

export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-8 md:p-24 relative overflow-hidden">
      <div className="absolute top-0 left-0 w-full h-full bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-moon-green/5 via-moon-bg to-moon-bg pointer-events-none" />
      
      <div className="z-10 w-full max-w-5xl space-y-12">
        <div className="text-center space-y-6">
          <div className="inline-block px-3 py-1 rounded-full border border-moon-green/20 bg-moon-green/5 text-moon-green text-xs font-mono mb-2">
            v2.0.0 NEURAL // LOCAL_MODE
          </div>
          <h1 className="text-6xl md:text-7xl font-bold tracking-tighter text-transparent bg-clip-text bg-gradient-to-r from-moon-text via-moon-text to-moon-text/50">
            KAIROS<span className="text-moon-green">.</span>CC
          </h1>
          <p className="text-moon-text-dim text-xl max-w-2xl mx-auto">
            Advanced algorithmic trading system with neural memory persistence.
            Manage keys, monitor agents, and execute strategies.
          </p>
        </div>

        <WalletManager />
        
        <div className="text-center">
             <p className="text-xs text-moon-text-dim/30 font-mono">
                SYSTEM STATUS: OPERATIONAL • ENCRYPTION: LOCAL • NET: MAINNET
             </p>
        </div>
      </div>
    </main>
  );
}

import { useState } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { LayoutDashboard, TrendingUp, ShoppingCart, Wheat, Table2 } from 'lucide-react';
import EconomicDashboard from './pages/EconomicDashboard';
import MarketPrices      from './pages/MarketPrices';
import CommodityTracker  from './pages/CommodityTracker';
import DataTable         from './pages/DataTable';

const qc = new QueryClient({ defaultOptions: { queries: { retry: 1, staleTime: 60000 } } });

const tabs = [
  { id: 'economic',   label: 'Economic Indicators', icon: TrendingUp },
  { id: 'market',     label: 'Market Prices',        icon: ShoppingCart },
  { id: 'commodity',  label: 'Commodity Tracker',    icon: Wheat },
  { id: 'data',       label: 'All Data',             icon: Table2 },
];

export default function App() {
  const [activeTab, setActiveTab] = useState('economic');

  const renderPage = () => {
    switch (activeTab) {
      case 'economic':  return <EconomicDashboard />;
      case 'market':    return <MarketPrices />;
      case 'commodity': return <CommodityTracker />;
      case 'data':      return <DataTable />;
      default:          return <EconomicDashboard />;
    }
  };

  return (
    <QueryClientProvider client={qc}>
      <div className="min-h-screen bg-gray-50">

        {/* ── Header ── */}
        <header className="bg-white border-b border-gray-100 shadow-sm sticky top-0 z-10">
          <div className="max-w-7xl mx-auto px-6 py-3">
            <div className="flex items-center justify-between gap-4">

              {/* Logo */}
              <div className="flex items-center gap-3 shrink-0">
                <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-indigo-600 to-violet-600 flex items-center justify-center text-white font-bold text-sm shadow">
                  SG
                </div>
                <div>
                  <p className="text-sm font-bold text-gray-900 leading-none">SG Datalytics</p>
                  <p className="text-[10px] text-gray-400 mt-0.5 tracking-wide uppercase">Ghana Market Intelligence</p>
                </div>
              </div>

              {/* Tab navigation */}
              <nav className="flex items-center gap-1 bg-gray-100 rounded-xl p-1 overflow-x-auto">
                {tabs.map(({ id, label, icon: Icon }) => (
                  <button
                    key={id}
                    onClick={() => setActiveTab(id)}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition ${
                      activeTab === id
                        ? 'bg-white text-indigo-600 shadow-sm'
                        : 'text-gray-500 hover:text-gray-700'
                    }`}
                  >
                    <Icon size={13} />
                    {label}
                  </button>
                ))}
              </nav>

              {/* Live badge */}
              <div className="flex items-center gap-3 shrink-0">
                <span className="text-xs text-gray-400 hidden lg:block">Ghana · 2000–Present</span>
                <span className="flex items-center gap-1.5 text-[10px] text-emerald-600 bg-emerald-50 border border-emerald-200 px-2 py-1 rounded-full font-medium">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                  Live
                </span>
              </div>
            </div>
          </div>
        </header>

        {/* ── Main ── */}
        <main className="max-w-7xl mx-auto px-6 py-6">
          {renderPage()}
        </main>

        {/* ── Footer ── */}
        <footer className="border-t border-gray-100 mt-16 py-5 text-center text-xs text-gray-400">
          © {new Date().getFullYear()} SG Datalytics · Ghana Market Intelligence Platform ·{' '}
          <span className="text-indigo-400">#SGDatalytics</span>
        </footer>
      </div>
    </QueryClientProvider>
  );
}

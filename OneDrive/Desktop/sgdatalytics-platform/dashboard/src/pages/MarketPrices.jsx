import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  BarChart, Bar, LineChart, Line, XAxis, YAxis,
  CartesianGrid, Tooltip, ResponsiveContainer, Legend
} from 'recharts';
import { Loader2, TrendingUp, TrendingDown, Minus, ShoppingCart } from 'lucide-react';
import api from '../api';

const fmtGHS = n => n != null ? `GHS ${Number(n).toLocaleString('en-GH', { minimumFractionDigits: 2 })}` : '—';
const CATEGORY_COLORS = {
  Electronics:    '#6366f1',
  Appliances:     '#3b82f6',
  Vehicles:       '#f59e0b',
  'Vehicle Parts':'#f97316',
  Building:       '#84cc16',
};

function TrendBadge({ pct }) {
  if (pct === null || pct === undefined) return null;
  const n = parseFloat(pct);
  if (n > 0)  return <span className="text-xs text-red-500 flex items-center gap-0.5"><TrendingUp size={11}/> +{n.toFixed(1)}%</span>;
  if (n < 0)  return <span className="text-xs text-emerald-500 flex items-center gap-0.5"><TrendingDown size={11}/> {n.toFixed(1)}%</span>;
  return <span className="text-xs text-gray-400 flex items-center gap-0.5"><Minus size={11}/> Flat</span>;
}

export default function MarketPrices() {
  const [selectedCategory, setSelectedCategory] = useState('');
  const [selectedLabel,    setSelectedLabel]    = useState(null);

  const { data: summary = [], isLoading } = useQuery({
    queryKey: ['market-summary'],
    queryFn:  () => api.get('/market/summary').then(r => r.data),
  });

  const { data: weeklyData = [] } = useQuery({
    queryKey: ['market-weekly', selectedLabel],
    queryFn:  () => api.get('/market/weekly', { params: { label: selectedLabel } }).then(r => r.data),
    enabled:  !!selectedLabel,
  });

  const categories = [...new Set(summary.map(s => s.product_category).filter(Boolean))];
  const filtered   = selectedCategory ? summary.filter(s => s.product_category === selectedCategory) : summary;

  const chartData = weeklyData.map(w => ({
    week:     `W${w.week_number}/${w.year}`,
    avg:      w.avg_price_ghs ? parseFloat(w.avg_price_ghs) : null,
    median:   w.median_price_ghs ? parseFloat(w.median_price_ghs) : null,
    listings: w.total_listings,
  }));

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold text-gray-900">Market Price Index</h2>
        <p className="text-sm text-gray-400 mt-0.5">Weekly price surveys across Ghana's online marketplaces</p>
      </div>

      {/* Category filter */}
      <div className="flex flex-wrap gap-2">
        <button
          onClick={() => setSelectedCategory('')}
          className={`px-3 py-1.5 rounded-full text-xs font-medium border transition ${
            !selectedCategory ? 'bg-indigo-600 text-white border-transparent' : 'bg-white border-gray-200 text-gray-600'
          }`}
        >All Categories</button>
        {categories.map(cat => (
          <button
            key={cat}
            onClick={() => setSelectedCategory(cat)}
            className={`px-3 py-1.5 rounded-full text-xs font-medium border transition ${
              selectedCategory === cat
                ? 'text-white border-transparent'
                : 'bg-white border-gray-200 text-gray-600'
            }`}
            style={selectedCategory === cat ? { backgroundColor: CATEGORY_COLORS[cat] || '#6366f1' } : {}}
          >{cat}</button>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

        {/* Product cards */}
        <div className="lg:col-span-1 space-y-2 max-h-[600px] overflow-y-auto pr-1">
          {isLoading ? (
            <div className="flex items-center justify-center py-12 text-gray-400">
              <Loader2 size={20} className="animate-spin mr-2"/> Loading…
            </div>
          ) : filtered.map(item => (
            <button
              key={item.search_label}
              onClick={() => setSelectedLabel(item.search_label)}
              className={`w-full text-left p-4 rounded-xl border transition ${
                selectedLabel === item.search_label
                  ? 'border-indigo-300 bg-indigo-50'
                  : 'border-gray-100 bg-white hover:border-indigo-200'
              }`}
            >
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-sm font-semibold text-gray-800">{item.search_label}</p>
                  <p className="text-xs text-gray-400 mt-0.5">{item.product_category}</p>
                </div>
                <span
                  className="text-[10px] px-2 py-0.5 rounded-full text-white font-medium"
                  style={{ backgroundColor: CATEGORY_COLORS[item.product_category] || '#6366f1' }}
                >
                  {item.total_listings} listings
                </span>
              </div>
              <p className="text-lg font-bold text-gray-900 mt-2">{fmtGHS(item.avg_price_ghs)}</p>
              <div className="flex items-center justify-between mt-1">
                <TrendBadge pct={item.price_trend_pct} />
                <p className="text-[10px] text-gray-400">W{item.week_number}/{item.year}</p>
              </div>
            </button>
          ))}
        </div>

        {/* Chart panel */}
        <div className="lg:col-span-2">
          {!selectedLabel ? (
            <div className="h-full min-h-[400px] flex flex-col items-center justify-center bg-white rounded-xl border border-gray-100 text-gray-400">
              <ShoppingCart size={40} className="mb-3 opacity-20"/>
              <p className="text-sm">Select a product to view price trend</p>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="bg-white rounded-xl border border-gray-100 p-5">
                <h3 className="text-sm font-semibold text-gray-900 mb-4">
                  {selectedLabel} — Weekly Average Price (GHS)
                </h3>
                {chartData.length === 0 ? (
                  <div className="h-64 flex items-center justify-center text-gray-400 text-sm">
                    No weekly data available yet
                  </div>
                ) : (
                  <ResponsiveContainer width="100%" height={280}>
                    <LineChart data={chartData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0"/>
                      <XAxis dataKey="week" tick={{ fontSize: 10 }}/>
                      <YAxis tick={{ fontSize: 11 }} tickFormatter={v => `GHS ${v.toLocaleString()}`} width={80}/>
                      <Tooltip formatter={(v) => [`GHS ${Number(v).toLocaleString()}`, '']} contentStyle={{ fontSize: 12, borderRadius: 8 }}/>
                      <Legend wrapperStyle={{ fontSize: 11 }}/>
                      <Line type="monotone" dataKey="avg"    name="Avg Price"    stroke="#6366f1" strokeWidth={2} dot={false} connectNulls/>
                      <Line type="monotone" dataKey="median" name="Median Price" stroke="#10b981" strokeWidth={2} dot={false} strokeDasharray="4 2" connectNulls/>
                    </LineChart>
                  </ResponsiveContainer>
                )}
              </div>

              <div className="bg-white rounded-xl border border-gray-100 p-5">
                <h3 className="text-sm font-semibold text-gray-900 mb-4">Listing Volume by Week</h3>
                {chartData.length === 0 ? (
                  <div className="h-40 flex items-center justify-center text-gray-400 text-sm">No data</div>
                ) : (
                  <ResponsiveContainer width="100%" height={160}>
                    <BarChart data={chartData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0"/>
                      <XAxis dataKey="week" tick={{ fontSize: 10 }}/>
                      <YAxis tick={{ fontSize: 11 }}/>
                      <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8 }}/>
                      <Bar dataKey="listings" name="Listings" fill="#a5b4fc" radius={[3,3,0,0]}/>
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

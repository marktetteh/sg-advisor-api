import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  LineChart, Line, BarChart, Bar,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer
} from 'recharts';
import { Loader2, TrendingUp, TrendingDown, Minus, Wheat } from 'lucide-react';
import api from '../api';

const fmtGHS = n => n != null ? `GHS ${Number(n).toLocaleString('en-GH', { minimumFractionDigits: 2 })}` : '—';

const CATEGORY_COLORS = {
  Grains:     '#f59e0b',
  Vegetables: '#10b981',
  Crops:      '#84cc16',
  Oils:       '#f97316',
};

function ChangeBadge({ pct }) {
  if (pct === null || pct === undefined) return <span className="text-xs text-gray-400">—</span>;
  const n = parseFloat(pct);
  if (n > 0)  return <span className="text-xs text-red-500 flex items-center gap-0.5"><TrendingUp size={11}/> +{n.toFixed(1)}%</span>;
  if (n < 0)  return <span className="text-xs text-emerald-600 flex items-center gap-0.5"><TrendingDown size={11}/> {n.toFixed(1)}%</span>;
  return <span className="text-xs text-gray-400 flex items-center gap-0.5"><Minus size={11}/> Flat</span>;
}

export default function CommodityTracker() {
  const [selected, setSelected] = useState(null);
  const [category, setCategory] = useState('');

  const { data: commodities = [], isLoading } = useQuery({
    queryKey: ['commodities', category],
    queryFn:  () => api.get('/commodities', { params: category ? { category } : {} }).then(r => r.data),
  });

  const { data: detail } = useQuery({
    queryKey: ['commodity-detail', selected],
    queryFn:  () => api.get(`/commodities/${selected}`, { params: { days: 180 } }).then(r => r.data),
    enabled:  !!selected,
  });

  const categories = [...new Set(commodities.map(c => c.category).filter(Boolean))];

  // Build chart data from price history
  const chartData = detail?.prices
    ? Object.values(
        detail.prices.reduce((acc, p) => {
          const key = p.price_date?.split('T')[0] || p.price_date;
          if (!acc[key]) acc[key] = { date: key };
          acc[key][p.region || 'Ghana'] = parseFloat(p.price_ghs);
          return acc;
        }, {})
      ).sort((a, b) => a.date.localeCompare(b.date))
    : [];

  const regions = detail?.prices
    ? [...new Set(detail.prices.map(p => p.region || 'Ghana'))]
    : [];

  const regionColors = ['#6366f1','#f59e0b','#10b981','#f97316','#3b82f6','#84cc16'];

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold text-gray-900">Agricultural Commodity Tracker</h2>
        <p className="text-sm text-gray-400 mt-0.5">Weekly food prices by market and region · MoFA Ghana</p>
      </div>

      {/* Category filter */}
      <div className="flex flex-wrap gap-2">
        <button
          onClick={() => setCategory('')}
          className={`px-3 py-1.5 rounded-full text-xs font-medium border transition ${
            !category ? 'bg-amber-500 text-white border-transparent' : 'bg-white border-gray-200 text-gray-600'
          }`}
        >All</button>
        {categories.map(cat => (
          <button
            key={cat}
            onClick={() => setCategory(cat)}
            className={`px-3 py-1.5 rounded-full text-xs font-medium border transition ${
              category === cat ? 'text-white border-transparent' : 'bg-white border-gray-200 text-gray-600'
            }`}
            style={category === cat ? { backgroundColor: CATEGORY_COLORS[cat] || '#f59e0b' } : {}}
          >{cat}</button>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

        {/* Commodity list */}
        <div className="lg:col-span-1 space-y-2 max-h-[600px] overflow-y-auto pr-1">
          {isLoading ? (
            <div className="flex items-center justify-center py-12 text-gray-400">
              <Loader2 size={20} className="animate-spin mr-2"/> Loading…
            </div>
          ) : commodities.map(c => (
            <button
              key={c.code}
              onClick={() => setSelected(c.code)}
              className={`w-full text-left p-4 rounded-xl border transition ${
                selected === c.code
                  ? 'border-amber-300 bg-amber-50'
                  : 'border-gray-100 bg-white hover:border-amber-200'
              }`}
            >
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-sm font-semibold text-gray-800">{c.name}</p>
                  <p className="text-xs text-gray-400 mt-0.5">{c.category} · per {c.unit}</p>
                </div>
                <span
                  className="text-[10px] px-2 py-0.5 rounded-full text-white font-medium"
                  style={{ backgroundColor: CATEGORY_COLORS[c.category] || '#f59e0b' }}
                >{c.category}</span>
              </div>
              <p className="text-lg font-bold text-gray-900 mt-2">{fmtGHS(c.latest_price)}</p>
              <div className="flex items-center justify-between mt-1">
                <ChangeBadge pct={c.change_pct} />
                <p className="text-[10px] text-gray-400">{c.market || '—'}</p>
              </div>
            </button>
          ))}
        </div>

        {/* Chart panel */}
        <div className="lg:col-span-2">
          {!selected ? (
            <div className="h-full min-h-[400px] flex flex-col items-center justify-center bg-white rounded-xl border border-gray-100 text-gray-400">
              <Wheat size={40} className="mb-3 opacity-20"/>
              <p className="text-sm">Select a commodity to view price history</p>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="bg-white rounded-xl border border-gray-100 p-5">
                <h3 className="text-sm font-semibold text-gray-900 mb-1">
                  {detail?.commodity?.name} — Price by Region (GHS)
                </h3>
                <p className="text-xs text-gray-400 mb-4">per {detail?.commodity?.unit}</p>
                {chartData.length === 0 ? (
                  <div className="h-64 flex items-center justify-center text-gray-400 text-sm">
                    No price history available
                  </div>
                ) : (
                  <ResponsiveContainer width="100%" height={280}>
                    <LineChart data={chartData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0"/>
                      <XAxis dataKey="date" tick={{ fontSize: 9 }} tickFormatter={d => d?.slice(0,7)}/>
                      <YAxis tick={{ fontSize: 11 }} tickFormatter={v => `${v}`} width={55}/>
                      <Tooltip
                        formatter={(v, name) => [`GHS ${v}`, name]}
                        contentStyle={{ fontSize: 12, borderRadius: 8 }}
                      />
                      {regions.map((r, i) => (
                        <Line
                          key={r} type="monotone" dataKey={r}
                          stroke={regionColors[i % regionColors.length]}
                          strokeWidth={2} dot={false} connectNulls
                        />
                      ))}
                    </LineChart>
                  </ResponsiveContainer>
                )}
              </div>

              {/* Latest prices table */}
              {detail?.prices && (
                <div className="bg-white rounded-xl border border-gray-100 p-5">
                  <h3 className="text-sm font-semibold text-gray-900 mb-3">Latest Prices by Market</h3>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-gray-50">
                          <th className="text-left pb-2 text-xs font-semibold text-gray-500">Market</th>
                          <th className="text-left pb-2 text-xs font-semibold text-gray-500">Region</th>
                          <th className="text-right pb-2 text-xs font-semibold text-gray-500">Price (GHS)</th>
                          <th className="text-right pb-2 text-xs font-semibold text-gray-500">Date</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-50">
                        {detail.prices.slice(0, 10).map((p, i) => (
                          <tr key={i}>
                            <td className="py-2 text-xs text-gray-700">{p.market}</td>
                            <td className="py-2 text-xs text-gray-500">{p.region}</td>
                            <td className="py-2 text-xs font-semibold text-gray-900 text-right">{fmtGHS(p.price_ghs)}</td>
                            <td className="py-2 text-xs text-gray-400 text-right">
                              {p.price_date ? new Date(p.price_date).toLocaleDateString('en-GH', { day:'2-digit', month:'short', year:'numeric' }) : '—'}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  LineChart, Line, AreaChart, Area, BarChart, Bar,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer
} from 'recharts';
import { TrendingUp, TrendingDown, Minus, Loader2, RefreshCw } from 'lucide-react';
import api from '../api';

const SECTOR_COLORS = {
  economy:     '#6366f1',
  monetary:    '#3b82f6',
  trade:       '#10b981',
  social:      '#f59e0b',
  agriculture: '#84cc16',
  environment: '#22d3ee',
};

const fmt = (value, format) => {
  if (value === null || value === undefined) return '—';
  const n = parseFloat(value);
  if (isNaN(n)) return '—';
  switch (format) {
    case 'pct': return `${n.toFixed(1)}%`;
    case 'B':   return `$${(n / 1e9).toFixed(1)}B`;
    case 'M':   return `${(n / 1e6).toFixed(1)}M`;
    case 'K':   return `${(n / 1e3).toFixed(1)}K`;
    case 'dec': return n.toFixed(2);
    default:    return n.toLocaleString();
  }
};

// ── KPI Card ──────────────────────────────────────────────────
function KpiCard({ indicator, onClick, active }) {
  const latest = indicator.latest;
  const prev   = indicator.prev;
  const change = (latest && prev) ? ((latest - prev) / Math.abs(prev) * 100) : null;
  const up     = change > 0;
  const down   = change < 0;

  return (
    <button
      onClick={onClick}
      className={`w-full text-left p-4 rounded-xl border transition ${
        active
          ? 'border-indigo-300 bg-indigo-50 shadow-sm'
          : 'border-gray-100 bg-white hover:border-indigo-200 hover:shadow-sm'
      }`}
    >
      <div className="flex items-start justify-between mb-2">
        <p className="text-xs text-gray-500 leading-tight pr-2">{indicator.name}</p>
        <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-gray-100 text-gray-500 shrink-0">
          {indicator.source?.split(' ').map(w => w[0]).join('')}
        </span>
      </div>
      <p className="text-xl font-bold text-gray-900">{fmt(latest, indicator.fmt)}</p>
      {change !== null && (
        <p className={`flex items-center gap-1 text-xs mt-1 ${up ? 'text-red-500' : down ? 'text-emerald-500' : 'text-gray-400'}`}>
          {up ? <TrendingUp size={11}/> : down ? <TrendingDown size={11}/> : <Minus size={11}/>}
          {Math.abs(change).toFixed(1)}% YoY
        </p>
      )}
      <p className="text-[10px] text-gray-400 mt-1">{indicator.year_to}</p>
    </button>
  );
}

export default function EconomicDashboard() {
  const [selectedSector, setSelectedSector] = useState('economy');
  const [selectedIndicator, setSelectedIndicator] = useState(null);
  const [yearFrom, setYearFrom] = useState(2000);

  // Load sectors
  const { data: sectors = [] } = useQuery({
    queryKey: ['sectors'],
    queryFn: () => api.get('/sectors').then(r => r.data),
  });

  // Load indicators for selected sector
  const { data: indicators = [], isLoading: loadingInd } = useQuery({
    queryKey: ['indicators', selectedSector],
    queryFn: () => api.get('/indicators', { params: { sector: selectedSector } }).then(r => r.data),
    enabled: !!selectedSector,
  });

  // Load time series for selected indicator
  const { data: timeSeries, isLoading: loadingTs } = useQuery({
    queryKey: ['indicator-series', selectedIndicator, yearFrom],
    queryFn: () => api.get(`/indicators/${selectedIndicator}`, { params: { from: yearFrom, to: 2024 } }).then(r => r.data),
    enabled: !!selectedIndicator,
  });

  const chartData = timeSeries?.data?.map(d => ({
    year:  d.year,
    value: d.value !== null ? parseFloat(d.value) : null,
  })) || [];

  const indObj = indicators.find(i => i.code === selectedIndicator);
  const sectorColor = SECTOR_COLORS[selectedSector] || '#6366f1';

  return (
    <div className="space-y-6">

      {/* ── Page header ── */}
      <div>
        <h2 className="text-xl font-bold text-gray-900">Economic Indicators</h2>
        <p className="text-sm text-gray-400 mt-0.5">Ghana · World Bank, Bank of Ghana & GSS · 2000–Present</p>
      </div>

      {/* ── Sector tabs ── */}
      <div className="flex flex-wrap gap-2">
        {sectors.filter(s => s.code !== 'market').map(s => (
          <button
            key={s.code}
            onClick={() => { setSelectedSector(s.code); setSelectedIndicator(null); }}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium border transition ${
              selectedSector === s.code
                ? 'text-white border-transparent shadow-sm'
                : 'bg-white border-gray-200 text-gray-600 hover:border-indigo-200'
            }`}
            style={selectedSector === s.code ? { backgroundColor: SECTOR_COLORS[s.code] || '#6366f1' } : {}}
          >
            <span>{s.icon}</span> {s.name}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

        {/* ── Indicator list ── */}
        <div className="lg:col-span-1 space-y-2">
          {loadingInd ? (
            <div className="flex items-center justify-center py-12 text-gray-400">
              <Loader2 size={20} className="animate-spin mr-2" /> Loading…
            </div>
          ) : indicators.map(ind => (
            <KpiCard
              key={ind.code}
              indicator={{ ...ind, latest: null, prev: null }}
              active={selectedIndicator === ind.code}
              onClick={() => setSelectedIndicator(ind.code)}
            />
          ))}
        </div>

        {/* ── Chart panel ── */}
        <div className="lg:col-span-2">
          {!selectedIndicator ? (
            <div className="h-full min-h-[400px] flex flex-col items-center justify-center bg-white rounded-xl border border-gray-100 text-gray-400">
              <TrendingUp size={40} className="mb-3 opacity-20" />
              <p className="text-sm">Select an indicator to see the trend chart</p>
            </div>
          ) : loadingTs ? (
            <div className="h-full min-h-[400px] flex items-center justify-center bg-white rounded-xl border border-gray-100 text-gray-400">
              <Loader2 size={24} className="animate-spin mr-2" /> Loading chart…
            </div>
          ) : (
            <div className="bg-white rounded-xl border border-gray-100 p-5">
              <div className="flex items-start justify-between mb-4">
                <div>
                  <h3 className="text-sm font-semibold text-gray-900">{indObj?.name}</h3>
                  <p className="text-xs text-gray-400 mt-0.5">
                    {indObj?.source} · {indObj?.unit} · Ghana
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  {[2000, 2010, 2015].map(y => (
                    <button
                      key={y}
                      onClick={() => setYearFrom(y)}
                      className={`text-xs px-2 py-1 rounded-md border transition ${
                        yearFrom === y ? 'bg-indigo-50 text-indigo-600 border-indigo-200' : 'border-gray-200 text-gray-500'
                      }`}
                    >
                      {y}+
                    </button>
                  ))}
                </div>
              </div>

              {chartData.length === 0 ? (
                <div className="h-64 flex items-center justify-center text-gray-400 text-sm">
                  No data available for this indicator
                </div>
              ) : (
                <ResponsiveContainer width="100%" height={320}>
                  <AreaChart data={chartData} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
                    <defs>
                      <linearGradient id="colorVal" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%"  stopColor={sectorColor} stopOpacity={0.15}/>
                        <stop offset="95%" stopColor={sectorColor} stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                    <XAxis dataKey="year" tick={{ fontSize: 11 }} />
                    <YAxis tick={{ fontSize: 11 }} width={55}
                      tickFormatter={v => fmt(v, indObj?.fmt)}
                    />
                    <Tooltip
                      formatter={(v) => [fmt(v, indObj?.fmt), indObj?.name]}
                      labelFormatter={l => `Year: ${l}`}
                      contentStyle={{ fontSize: 12, borderRadius: 8 }}
                    />
                    <Area
                      type="monotone" dataKey="value"
                      stroke={sectorColor} strokeWidth={2}
                      fill="url(#colorVal)"
                      dot={{ r: 3, fill: sectorColor }}
                      activeDot={{ r: 5 }}
                      connectNulls
                    />
                  </AreaChart>
                </ResponsiveContainer>
              )}

              {/* Stats bar */}
              {chartData.length > 0 && (() => {
                const vals = chartData.filter(d => d.value !== null).map(d => d.value);
                const min  = Math.min(...vals);
                const max  = Math.max(...vals);
                const last = vals[vals.length - 1];
                return (
                  <div className="grid grid-cols-3 gap-3 mt-4 pt-4 border-t border-gray-50">
                    {[
                      { label: 'Latest', value: fmt(last, indObj?.fmt) },
                      { label: 'Min',    value: fmt(min,  indObj?.fmt) },
                      { label: 'Max',    value: fmt(max,  indObj?.fmt) },
                    ].map(s => (
                      <div key={s.label} className="text-center">
                        <p className="text-xs text-gray-400">{s.label}</p>
                        <p className="text-sm font-semibold text-gray-800">{s.value}</p>
                      </div>
                    ))}
                  </div>
                );
              })()}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

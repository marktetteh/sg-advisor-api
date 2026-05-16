import { useState, useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  Search, Filter, Download, ChevronUp, ChevronDown,
  ChevronsLeft, ChevronLeft, ChevronRight, ChevronsRight,
  ArrowUpDown, Loader2
} from 'lucide-react';
import api from '../api';

const fmtGHS  = n => n != null ? `GHS ${Number(n).toLocaleString('en-GH', { minimumFractionDigits: 2 })}` : '—';
const fmtDate = s => s ? new Date(s).toLocaleDateString('en-GH', { day:'2-digit', month:'short', year:'numeric' }) : '—';
const platLabel = src => src === 'jiji' ? 'Platform A' : 'Platform B';
const condLabel = c => ({ new:'Brand New', used:'Used', unknown:'Unknown' }[c] || c || '—');
const condColor = c => ({ new:'bg-emerald-50 text-emerald-700 border-emerald-200', used:'bg-gray-100 text-gray-600 border-gray-200', unknown:'bg-gray-50 text-gray-400 border-gray-100' }[c] || 'bg-gray-50 text-gray-400 border-gray-100');
const platColor = src => src === 'jiji' ? 'bg-indigo-50 text-indigo-700 border-indigo-200' : 'bg-amber-50 text-amber-700 border-amber-200';

function SortIcon({ field, current }) {
  if (current === `${field}_asc`)  return <ChevronUp   size={13} className="text-indigo-500"/>;
  if (current === `${field}_desc`) return <ChevronDown size={13} className="text-indigo-500"/>;
  return <ArrowUpDown size={12} className="text-gray-300"/>;
}

function PagBtn({ onClick, disabled, children }) {
  return (
    <button onClick={onClick} disabled={disabled}
      className="p-1.5 rounded-lg border border-gray-200 text-gray-500 hover:bg-white hover:text-indigo-600 disabled:opacity-30 disabled:cursor-default transition">
      {children}
    </button>
  );
}

export default function DataTable() {
  const [page,      setPage]      = useState(1);
  const [search,    setSearch]    = useState('');
  const [condition, setCondition] = useState('');
  const [location,  setLocation]  = useState('');
  const [label,     setLabel]     = useState('');
  const [category,  setCategory]  = useState('');
  const [week,      setWeek]      = useState('');
  const [sort,      setSort]      = useState('date_desc');
  const [exporting, setExporting] = useState(false);
  const [debouncedSearch, setDebouncedSearch] = useState('');

  const handleSearch = useCallback(val => {
    setSearch(val);
    clearTimeout(window._searchTimer);
    window._searchTimer = setTimeout(() => { setDebouncedSearch(val); setPage(1); }, 400);
  }, []);

  const params = { page, limit: 50, search: debouncedSearch, condition, location, label, category, week, sort };

  const { data, isLoading, isFetching } = useQuery({
    queryKey: ['market-data', params],
    queryFn:  () => api.get('/market/data', { params }).then(r => r.data),
    keepPreviousData: true,
  });

  const rows   = data?.data          || [];
  const total  = data?.total         || 0;
  const pages  = data?.pages         || 1;
  const opts   = data?.filterOptions || {};
  const weeks  = opts.weeks          || [];
  const locs   = opts.locations      || [];
  const labels = opts.labels         || [];

  const toggleSort = field => {
    if (sort === `${field}_asc`)  { setSort(`${field}_desc`); return; }
    if (sort === `${field}_desc`) { setSort('date_desc'); return; }
    setSort(`${field}_asc`);
  };

  const handleExport = async () => {
    setExporting(true);
    try {
      const p = new URLSearchParams({ search: debouncedSearch, condition, location, label, category, week });
      const resp = await api.get(`/market/export?${p}`, { responseType: 'blob' });
      const url  = URL.createObjectURL(new Blob([resp.data], { type: 'text/csv' }));
      const a    = document.createElement('a');
      a.href = url; a.download = `sgdatalytics-market-${label || category || 'all'}.csv`; a.click();
      URL.revokeObjectURL(url);
    } catch (e) { console.error(e); }
    finally { setExporting(false); }
  };

  const resetFilters = () => {
    setSearch(''); setDebouncedSearch('');
    setCondition(''); setLocation('');
    setLabel(''); setCategory('');
    setWeek(''); setSort('date_desc'); setPage(1);
  };

  const hasFilters = debouncedSearch || condition || location || label || category || week;

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold text-gray-900">All Market Records</h2>
          <p className="text-xs text-gray-400 mt-0.5">
            {isFetching ? 'Loading…' : `${total.toLocaleString()} listings found`}
          </p>
        </div>
        <button
          onClick={handleExport} disabled={exporting || total === 0}
          className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white text-sm font-medium rounded-lg transition shadow-sm"
        >
          {exporting ? <Loader2 size={14} className="animate-spin"/> : <Download size={14}/>}
          Export CSV
        </button>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3">
          <div className="relative lg:col-span-2">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"/>
            <input type="text" placeholder="Search product…" value={search}
              onChange={e => handleSearch(e.target.value)}
              className="w-full pl-8 pr-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-300"/>
          </div>

          <select value={category} onChange={e => { setCategory(e.target.value); setLabel(''); setPage(1); }}
            className="text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-300 text-gray-700">
            <option value="">All Categories</option>
            {[...new Set(labels.map(l => l.product_category))].map(c => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>

          <select value={label} onChange={e => { setLabel(e.target.value); setPage(1); }}
            className="text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-300 text-gray-700">
            <option value="">All Products</option>
            {labels.filter(l => !category || l.product_category === category).map(l => (
              <option key={l.search_label} value={l.search_label}>{l.search_label}</option>
            ))}
          </select>

          <select value={condition} onChange={e => { setCondition(e.target.value); setPage(1); }}
            className="text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-300 text-gray-700">
            <option value="">All Conditions</option>
            <option value="new">Brand New</option>
            <option value="used">Used</option>
            <option value="unknown">Unknown</option>
          </select>

          <select value={week} onChange={e => { setWeek(e.target.value); setPage(1); }}
            className="text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-300 text-gray-700">
            <option value="">All Weeks</option>
            {weeks.map(w => (
              <option key={`${w.year}-${w.week_number}`} value={w.week_number}>
                Week {w.week_number}, {w.year}
              </option>
            ))}
          </select>

          <button onClick={resetFilters}
            className={`flex items-center justify-center gap-1.5 px-3 py-2 text-sm rounded-lg border transition ${
              hasFilters ? 'border-indigo-300 text-indigo-600 hover:bg-indigo-50' : 'border-gray-200 text-gray-400 cursor-default'
            }`}>
            <Filter size={13}/> {hasFilters ? 'Clear' : 'Filter'}
          </button>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-100">
              <tr>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">#</th>
                <th className="text-left px-4 py-3">
                  <button onClick={() => toggleSort('title')}
                    className="flex items-center gap-1 text-xs font-semibold text-gray-500 uppercase tracking-wide hover:text-gray-700">
                    Product <SortIcon field="title" current={sort}/>
                  </button>
                </th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Category</th>
                <th className="text-left px-4 py-3">
                  <button onClick={() => toggleSort('price')}
                    className="flex items-center gap-1 text-xs font-semibold text-gray-500 uppercase tracking-wide hover:text-gray-700">
                    Price <SortIcon field="price" current={sort}/>
                  </button>
                </th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Location</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Condition</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Platform</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Week</th>
                <th className="text-left px-4 py-3">
                  <button onClick={() => toggleSort('date')}
                    className="flex items-center gap-1 text-xs font-semibold text-gray-500 uppercase tracking-wide hover:text-gray-700">
                    Date <SortIcon field="date" current={sort}/>
                  </button>
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {isLoading ? (
                <tr><td colSpan={9} className="text-center py-16 text-gray-400">
                  <Loader2 size={24} className="animate-spin mx-auto mb-2"/>
                  <p className="text-sm">Loading data…</p>
                </td></tr>
              ) : rows.length === 0 ? (
                <tr><td colSpan={9} className="text-center py-16 text-gray-400">
                  <Filter size={32} className="mx-auto mb-2 opacity-30"/>
                  <p className="text-sm">No records match your filters.</p>
                  {hasFilters && (
                    <button onClick={resetFilters} className="mt-2 text-xs text-indigo-500 hover:underline">
                      Clear all filters
                    </button>
                  )}
                </td></tr>
              ) : rows.map((row, i) => (
                <tr key={row.id} className="hover:bg-gray-50/60 transition">
                  <td className="px-4 py-3 text-xs text-gray-400">{(page - 1) * 50 + i + 1}</td>
                  <td className="px-4 py-3 font-medium text-gray-800 max-w-[200px]">
                    <span className="block truncate" title={row.title}>{row.title}</span>
                  </td>
                  <td className="px-4 py-3 text-xs text-gray-500">{row.search_label}</td>
                  <td className="px-4 py-3 text-emerald-600 font-semibold whitespace-nowrap">
                    {row.price_ghs ? fmtGHS(row.price_ghs) : <span className="text-gray-400 font-normal">{row.price_raw || '—'}</span>}
                  </td>
                  <td className="px-4 py-3 max-w-[140px]">
                    <span className="block truncate text-xs text-gray-500" title={row.location}>{row.location || '—'}</span>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-0.5 rounded-full text-[11px] font-medium border ${condColor(row.condition)}`}>
                      {condLabel(row.condition)}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-0.5 rounded-full text-[11px] font-medium border ${platColor(row.source)}`}>
                      {platLabel(row.source)}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-xs text-gray-500">W{row.week_number}/{row.year}</td>
                  <td className="px-4 py-3 text-xs text-gray-400 whitespace-nowrap">{fmtDate(row.scraped_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {pages > 1 && (
          <div className="border-t border-gray-100 px-4 py-3 flex items-center justify-between bg-gray-50/50">
            <p className="text-xs text-gray-400">
              Showing {((page - 1) * 50) + 1}–{Math.min(page * 50, total)} of {total.toLocaleString()}
            </p>
            <div className="flex items-center gap-1">
              <PagBtn onClick={() => setPage(1)}         disabled={page === 1}><ChevronsLeft  size={13}/></PagBtn>
              <PagBtn onClick={() => setPage(p => p-1)}  disabled={page === 1}><ChevronLeft   size={13}/></PagBtn>
              <span className="px-3 py-1.5 text-xs font-medium text-gray-700">{page} / {pages}</span>
              <PagBtn onClick={() => setPage(p => p+1)}  disabled={page === pages}><ChevronRight  size={13}/></PagBtn>
              <PagBtn onClick={() => setPage(pages)}     disabled={page === pages}><ChevronsRight size={13}/></PagBtn>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

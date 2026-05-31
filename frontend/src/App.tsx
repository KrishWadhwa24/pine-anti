import { useState, useEffect, useCallback, useMemo } from 'react';
import * as api from './api';
import type { SystemHealth, Signal, Watchlist, Instrument, TelegramSettings } from './types';

type Page = 'dashboard' | 'signals' | 'watchlists' | 'scanners' | 'settings';

type QuoteWSMessage = {
  type: 'quotes';
  quotes: Array<{ token: string; price: number; timestamp: number }>;
};

export default function App() {
  const [authed, setAuthed] = useState(false);
  const [page, setPage] = useState<Page>('dashboard');

  // Check stored credentials
  useEffect(() => {
    const saved = localStorage.getItem('tn_auth');
    if (saved) {
      const { u, p } = JSON.parse(saved);
      api.setAuth(u, p);
      setAuthed(true);
    }
  }, []);

  if (!authed) {
    return <LoginScreen onLogin={(u, p) => {
      localStorage.setItem('tn_auth', JSON.stringify({ u, p }));
      setAuthed(true);
    }} />;
  }

  return (
    <div className="app-layout">
      <Sidebar page={page} setPage={setPage} onLogout={() => {
        api.clearAuth();
        localStorage.removeItem('tn_auth');
        setAuthed(false);
      }} />
      <main className="main-content">
        {page === 'dashboard' && <DashboardPage />}
        {page === 'signals' && <SignalsPage />}
        {page === 'watchlists' && <WatchlistsPage />}
        {page === 'scanners' && <ScannersPage />}
        {page === 'settings' && <SettingsPage />}
      </main>
    </div>
  );
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// LOGIN
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
function LoginScreen({ onLogin }: { onLogin: (u: string, p: string) => void }) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const ok = await api.login(username, password);
      if (ok) onLogin(username, password);
      else setError('Invalid credentials');
    } catch {
      setError('Connection failed');
    }
    setLoading(false);
  };

  return (
    <div className="login-screen">
      <div className="login-card">
        <div className="login-brand">
          <div className="login-brand-icon">⚡</div>
          <div className="login-brand-text">TradeNexus</div>
        </div>
        <form className="login-form" onSubmit={handleSubmit}>
          {error && <div className="login-error">{error}</div>}
          <div className="input-group">
            <label className="input-label">Username</label>
            <input className="input" type="text" value={username}
              onChange={e => setUsername(e.target.value)} autoFocus placeholder="admin" />
          </div>
          <div className="input-group">
            <label className="input-label">Password</label>
            <input className="input" type="password" value={password}
              onChange={e => setPassword(e.target.value)} placeholder="••••••••" />
          </div>
          <button className="btn btn-primary" type="submit" style={{ width: '100%', padding: '10px' }}
            disabled={loading}>
            {loading ? 'Authenticating...' : 'Sign In'}
          </button>
        </form>
      </div>
    </div>
  );
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// SIDEBAR
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
function Sidebar({ page, setPage, onLogout }: { page: Page; setPage: (p: Page) => void; onLogout: () => void }) {
  const items: { id: Page; icon: string; label: string }[] = [
    { id: 'dashboard', icon: '◉', label: 'Dashboard' },
    { id: 'signals', icon: '⚡', label: 'Signals' },
    { id: 'watchlists', icon: '☰', label: 'Watchlists' },
    { id: 'scanners', icon: '⊛', label: 'Scanners' },
    { id: 'settings', icon: '⚙', label: 'Settings' },
  ];

  return (
    <aside className="sidebar">
      <div className="sidebar-brand">
        <div className="sidebar-brand-icon">⚡</div>
        <div className="sidebar-brand-text">TradeNexus</div>
      </div>
      <nav className="sidebar-nav">
        {items.map(item => (
          <button key={item.id}
            className={`sidebar-item ${page === item.id ? 'active' : ''}`}
            onClick={() => setPage(item.id)}>
            <span className="sidebar-item-icon">{item.icon}</span>
            {item.label}
          </button>
        ))}
      </nav>
      <div className="sidebar-footer">
        <button className="sidebar-item" onClick={onLogout}>
          <span className="sidebar-item-icon">↪</span>
          Sign Out
        </button>
      </div>
    </aside>
  );
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// DASHBOARD
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
function DashboardPage() {
  const [health, setHealth] = useState<SystemHealth | null>(null);
  const [signals, setSignals] = useState<Signal[]>([]);
  const [stats, setStats] = useState<Record<string, number>>({});

  const refresh = useCallback(async () => {
    try {
      const [h, s, st] = await Promise.all([api.getHealth(), api.getSignals(), api.getSignalStats()]);
      setHealth(h);
      setSignals(s || []);
      setStats(st);
    } catch { /* ignore */ }
  }, []);

  useEffect(() => { refresh(); const id = setInterval(refresh, 10000); return () => clearInterval(id); }, [refresh]);

  const uptime = health ? formatUptime(health.uptimeSeconds) : '--';
  const totalSignals = (stats['PINE_MOMENTUM'] || 0) + (stats['WEEKLY_CONSOLIDATED'] || 0);

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">Dashboard</h1>
        <p className="page-subtitle">System overview and recent activity</p>
      </div>

      {health && (
        <div className="health-bar animate-in">
          <HealthDot label="WebSocket" ok={health.webSocketConnected} />
          <HealthDot label="MongoDB" ok={health.mongoConnected} />
          <HealthDot label="Redis" ok={health.redisConnected} />
          <HealthDot label="Market" ok={health.marketOpen} />
          <span style={{ marginLeft: 'auto', fontSize: 12, color: 'var(--text-tertiary)' }}>
            Uptime: {uptime}
          </span>
        </div>
      )}

      <div className="stats-grid">
        <div className="stat-card animate-in">
          <div className="stat-label">Total Signals</div>
          <div className="stat-value">{totalSignals}</div>
        </div>
        <div className="stat-card animate-in">
          <div className="stat-label">Pine Momentum</div>
          <div className="stat-value">{stats['PINE_MOMENTUM'] || 0}</div>
        </div>
        <div className="stat-card animate-in">
          <div className="stat-label">Weekly Scanner</div>
          <div className="stat-value">{stats['WEEKLY_CONSOLIDATED'] || 0}</div>
        </div>
        <div className="stat-card animate-in">
          <div className="stat-label">Subscriptions</div>
          <div className="stat-value">{health?.activeSubscriptions || 0}</div>
        </div>
      </div>

      <div className="card">
        <div className="card-header">
          <h3 className="card-title">Recent Signals</h3>
          <span className="card-label">{signals.length} latest</span>
        </div>
        {signals.length === 0 ? (
          <div className="empty-state">
            <div className="empty-state-icon">⚡</div>
            <div className="empty-state-title">No signals yet</div>
            <div className="empty-state-desc">Add stocks to a watchlist and signals will appear here when detected.</div>
          </div>
        ) : (
          <div className="signals-list">
            {signals.slice(0, 10).map(sig => <SignalCard key={sig.signalHash} signal={sig} />)}
          </div>
        )}
      </div>
    </div>
  );
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// SIGNALS PAGE
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
function SignalsPage() {
  const [signals, setSignals] = useState<Signal[]>([]);
  const [filter, setFilter] = useState('');

  useEffect(() => {
    api.getSignals().then(s => setSignals(s || [])).catch(() => {});
  }, []);

  const filtered = filter
    ? signals.filter(s => s.timeframe === filter || s.category === filter)
    : signals;

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">Signals</h1>
        <p className="page-subtitle">All generated trading signals</p>
      </div>

      <div style={{ display: 'flex', gap: 8, marginBottom: 24 }}>
        {['', '4H', '1D', '1W', '1M'].map(tf => (
          <button key={tf} className={`btn btn-sm ${filter === tf ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => setFilter(tf)}>
            {tf || 'All'}
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <div className="empty-state">
          <div className="empty-state-icon">📊</div>
          <div className="empty-state-title">No signals found</div>
          <div className="empty-state-desc">Signals will appear here when detected by the strategy engine.</div>
        </div>
      ) : (
        <div className="signals-list">
          {filtered.map(sig => <SignalCard key={sig.signalHash} signal={sig} expanded />)}
        </div>
      )}
    </div>
  );
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// WATCHLISTS PAGE
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
function WatchlistsPage() {
  const [watchlists, setWatchlists] = useState<Watchlist[]>([]);
  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState('');
  const [showAddStock, setShowAddStock] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<Instrument[]>([]);
  const [expandedWatchlists, setExpandedWatchlists] = useState<Record<string, boolean>>({});
  const [stockPrices, setStockPrices] = useState<Record<string, number>>({});

  const loadWatchlists = useCallback(async () => {
    try {
      const wls = await api.getWatchlists();
      setWatchlists(wls || []);
      setExpandedWatchlists(prev => {
        const next: Record<string, boolean> = {};
        for (const wl of (wls || [])) {
          next[wl.id] = prev[wl.id] ?? false;
        }
        return next;
      });
    } catch {}
  }, []);

  useEffect(() => { loadWatchlists(); }, [loadWatchlists]);

  const handleCreate = async () => {
    if (!newName.trim()) return;
    await api.createWatchlist(newName.trim());
    setNewName('');
    setShowCreate(false);
    loadWatchlists();
  };

  const handleSearch = async (q: string) => {
    setSearchQuery(q);
    if (q.length >= 2) {
      const results = await api.searchSymbols(q);
      setSearchResults(results || []);
    } else {
      setSearchResults([]);
    }
  };

  const handleAddStock = async (wlId: string, inst: Instrument) => {
    await api.addStock(wlId, { symbol: inst.symbol, exchange: inst.exch_seg, name: inst.name });
    setShowAddStock(null);
    setSearchQuery('');
    setSearchResults([]);
    loadWatchlists();
  };

  const handleRemoveStock = async (wlId: string, symbol: string) => {
    await api.removeStock(wlId, symbol);
    loadWatchlists();
  };

  const handleDelete = async (id: string) => {
    await api.deleteWatchlist(id);
    loadWatchlists();
  };

  const watchlistTokens = useMemo(() => {
    const seen = new Set<string>();
    const tokens: string[] = [];
    for (const wl of watchlists) {
      for (const stock of wl.stocks || []) {
        if (!seen.has(stock.token)) {
          seen.add(stock.token);
          tokens.push(stock.token);
        }
      }
    }
    return tokens;
  }, [watchlists]);

  useEffect(() => {
    if (watchlistTokens.length === 0) {
      return;
    }

    const saved = localStorage.getItem('tn_auth');
    if (!saved) {
      return;
    }

    const { u, p } = JSON.parse(saved) as { u?: string; p?: string };
    if (!u || !p) {
      return;
    }

    let ws: WebSocket | null = null;
    let retryTimer: number | undefined;
    let closed = false;

    const connect = () => {
      const protocol = window.location.protocol === 'https:' ? 'wss' : 'ws';
      const params = new URLSearchParams({
        u,
        p,
        tokens: watchlistTokens.join(','),
      });

      ws = new WebSocket(`${protocol}://${window.location.host}/api/quotes/ws?${params.toString()}`);
      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data) as QuoteWSMessage;
          if (data.type !== 'quotes' || !Array.isArray(data.quotes)) {
            return;
          }
          setStockPrices(prev => {
            const next = { ...prev };
            for (const q of data.quotes) {
              if (q.token && Number.isFinite(q.price)) {
                next[q.token] = q.price;
              }
            }
            return next;
          });
        } catch {
          // Ignore malformed ws messages
        }
      };

      ws.onclose = () => {
        if (!closed) {
          retryTimer = window.setTimeout(connect, 2000);
        }
      };
    };

    connect();

    return () => {
      closed = true;
      if (retryTimer) {
        window.clearTimeout(retryTimer);
      }
      if (ws) {
        ws.close();
      }
    };
  }, [watchlistTokens]);

  const toggleWatchlist = (id: string) => {
    setExpandedWatchlists(prev => ({ ...prev, [id]: !prev[id] }));
  };

  return (
    <div>
      <div className="page-header" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <h1 className="page-title">Watchlists</h1>
          <p className="page-subtitle">Manage stocks for signal monitoring</p>
        </div>
        <button className="btn btn-primary" onClick={() => setShowCreate(true)}>+ New Watchlist</button>
      </div>

      {watchlists.length === 0 ? (
        <div className="empty-state">
          <div className="empty-state-icon">☰</div>
          <div className="empty-state-title">No watchlists</div>
          <div className="empty-state-desc">Create a watchlist and add stocks to start receiving signals.</div>
          <button className="btn btn-primary" onClick={() => setShowCreate(true)}>Create Watchlist</button>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {watchlists.map(wl => (
            <div key={wl.id} className="card animate-in">
              <div className="card-header">
                <div>
                  <h3 className="card-title">{wl.name}</h3>
                  <span className="card-label">{wl.stocks?.length || 0} stocks</span>
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button className="btn btn-sm btn-secondary" onClick={() => toggleWatchlist(wl.id)}>
                    {expandedWatchlists[wl.id] ? 'Collapse' : 'Expand'}
                  </button>
                  <button className="btn btn-sm btn-secondary" onClick={() => setShowAddStock(wl.id)}>+ Add Stock</button>
                  <button className="btn btn-sm btn-danger" onClick={() => handleDelete(wl.id)}>Delete</button>
                </div>
              </div>

              {expandedWatchlists[wl.id] && wl.stocks?.length > 0 && (
                <div>
                  {wl.stocks.map(stock => (
                    <div key={stock.symbol} className="watchlist-stock">
                      <div>
                        <div className="watchlist-stock-symbol">{stock.symbol}</div>
                        <div className="watchlist-stock-name">{stock.name} · {stock.exchange}</div>
                      </div>
                      <div className="watchlist-stock-right">
                        <span className="watchlist-stock-price">
                          {stockPrices[stock.token] !== undefined ? `₹${stockPrices[stock.token].toFixed(2)}` : '--'}
                        </span>
                        <button className="btn-icon" title="Remove" onClick={() => handleRemoveStock(wl.id, stock.symbol)}>×</button>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {!expandedWatchlists[wl.id] && wl.stocks?.length > 0 && (
                <div className="watchlist-collapsed-preview">
                  {wl.stocks.slice(0, 3).map(stock => (
                    <div key={stock.token} className="watchlist-stock-preview">
                      <span>{stock.symbol}</span>
                      <span className="watchlist-stock-price">
                        {stockPrices[stock.token] !== undefined ? `₹${stockPrices[stock.token].toFixed(2)}` : '--'}
                      </span>
                    </div>
                  ))}
                </div>
              )}

              {expandedWatchlists[wl.id] && wl.stocks?.length === 0 && (
                <div className="watchlist-collapsed-preview">
                  <div className="watchlist-stock-name">No stocks yet</div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Create Modal */}
      {showCreate && (
        <div className="modal-overlay" onClick={() => setShowCreate(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <h2 className="modal-title">New Watchlist</h2>
            <div className="input-group">
              <label className="input-label">Name</label>
              <input className="input" value={newName} onChange={e => setNewName(e.target.value)}
                placeholder="e.g., Nifty 50 Momentum" autoFocus />
            </div>
            <div className="modal-actions">
              <button className="btn btn-secondary" onClick={() => setShowCreate(false)}>Cancel</button>
              <button className="btn btn-primary" onClick={handleCreate}>Create</button>
            </div>
          </div>
        </div>
      )}

      {/* Add Stock Modal */}
      {showAddStock && (
        <div className="modal-overlay" onClick={() => { setShowAddStock(null); setSearchResults([]); setSearchQuery(''); }}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <h2 className="modal-title">Add Stock</h2>
            <div className="input-group">
              <label className="input-label">Search</label>
              <input className="input" value={searchQuery} onChange={e => handleSearch(e.target.value)}
                placeholder="Search symbol or name..." autoFocus />
            </div>
            <div style={{ maxHeight: 300, overflowY: 'auto', marginTop: 12 }}>
              {searchResults.map(inst => (
                <div key={inst.token} className="watchlist-stock" style={{ cursor: 'pointer' }}
                  onClick={() => handleAddStock(showAddStock, inst)}>
                  <div>
                    <div className="watchlist-stock-symbol">{inst.symbol}</div>
                    <div className="watchlist-stock-name">{inst.name} · {inst.exch_seg}</div>
                  </div>
                  <span style={{ color: 'var(--blue-primary)', fontSize: 13 }}>+ Add</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// SCANNERS PAGE
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
function ScannersPage() {
  const [results, setResults] = useState<any[]>([]);
  const [triggering, setTriggering] = useState(false);

  useEffect(() => {
    api.getScannerResults().then(r => setResults(r || [])).catch(() => {});
  }, []);

  const handleTrigger = async () => {
    setTriggering(true);
    try {
      await api.triggerScanner();
      setTimeout(() => {
        api.getScannerResults().then(r => setResults(r || [])).catch(() => {});
        setTriggering(false);
      }, 3000);
    } catch { setTriggering(false); }
  };

  return (
    <div>
      <div className="page-header" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <h1 className="page-title">Weekly Scanners</h1>
          <p className="page-subtitle">Manual weekly preview using the current available daily candles</p>
        </div>
        <button className="btn btn-primary" onClick={handleTrigger} disabled={triggering}>
          {triggering ? 'Scanning...' : 'Run Manual Scan'}
        </button>
      </div>

      <div className="stats-grid">
        {['WEEKLY_BREAKOUT', 'WEEKLY_CONTINUATION', 'WEEKLY_52WK_HIGH', 'WEEKLY_PRICE_ACTION'].map(type => (
          <div key={type} className="stat-card animate-in">
            <div className="stat-label">{type.replace('WEEKLY_', '').replace(/_/g, ' ')}</div>
            <div className="stat-value">{results.filter(r => r.scannerType === type).length}</div>
            <div className="stat-detail">manual matches</div>
          </div>
        ))}
      </div>

      {results.length === 0 ? (
        <div className="empty-state">
          <div className="empty-state-icon">⊛</div>
          <div className="empty-state-title">No scanner results</div>
          <div className="empty-state-desc">Run the manual weekly scanner to preview current-week matches.</div>
        </div>
      ) : (
        <div className="card">
          <div className="card-header">
            <h3 className="card-title">Scanner Matches</h3>
            <span className="card-label">{results.length} manual results</span>
          </div>
          <div className="signals-list">
            {results.map((r, i) => (
              <div key={i} className="signal-card">
                <div className="signal-header">
                  <span className="signal-symbol">{r.symbol}</span>
                  <span className="tag tag-scanner">{r.scannerType?.replace('WEEKLY_', '')}</span>
                  {r.isPartialWeek && <span className="tag">PARTIAL WEEK</span>}
                </div>
                <div className="signal-meta">
                  <span className="signal-meta-label">Price</span>
                  <span className="signal-meta-value">₹{r.closePrice?.toFixed(2)}</span>
                  <span className="signal-meta-label">Volume</span>
                  <span className="signal-meta-value">{formatNumber(r.volume)}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// SETTINGS PAGE
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
function SettingsPage() {
  const [telegramSettings, setTelegramSettings] = useState<TelegramSettings | null>(null);
  const [botToken, setBotToken] = useState('');
  const [chatId, setChatId] = useState('');
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [message, setMessage] = useState('');

  useEffect(() => {
    api.getTelegramSettings().then(s => setTelegramSettings(s)).catch(() => {});
  }, []);

  const handleSave = async () => {
    setSaving(true);
    setMessage('');
    try {
      await api.saveTelegramSettings(botToken, chatId);
      setMessage('✅ Telegram settings saved');
      setTelegramSettings({ isConfigured: true, testSuccess: false });
    } catch (e: any) {
      setMessage('❌ ' + e.message);
    }
    setSaving(false);
  };

  const handleTest = async () => {
    setTesting(true);
    setMessage('');
    try {
      await api.testTelegram(botToken, chatId);
      setMessage('✅ Test message sent successfully');
    } catch (e: any) {
      setMessage('❌ ' + e.message);
    }
    setTesting(false);
  };

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">Settings</h1>
        <p className="page-subtitle">Configure integrations and preferences</p>
      </div>

      <div className="card" style={{ maxWidth: 560 }}>
        <div className="card-header">
          <h3 className="card-title">📱 Telegram Integration</h3>
          {telegramSettings?.isConfigured && (
            <span className="signal-badge buy">Configured</span>
          )}
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div className="input-group">
            <label className="input-label">Bot Token</label>
            <input className="input" type="password" value={botToken}
              onChange={e => setBotToken(e.target.value)} placeholder="Enter your Telegram bot token" />
          </div>
          <div className="input-group">
            <label className="input-label">Chat ID</label>
            <input className="input" value={chatId}
              onChange={e => setChatId(e.target.value)} placeholder="Enter your chat or group ID" />
          </div>
          {message && (
            <div style={{ fontSize: 13, color: message.startsWith('✅') ? 'var(--green-primary)' : 'var(--red-primary)' }}>
              {message}
            </div>
          )}
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="btn btn-secondary" onClick={handleTest} disabled={testing || !botToken || !chatId}>
              {testing ? 'Sending...' : 'Test Connection'}
            </button>
            <button className="btn btn-primary" onClick={handleSave} disabled={saving || !botToken || !chatId}>
              {saving ? 'Saving...' : 'Save Settings'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// SHARED COMPONENTS
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

function SignalCard({ signal, expanded }: { signal: Signal; expanded?: boolean }) {
  const isBuy = signal.signalType === 'BUY';
  const time = new Date(signal.createdAt).toLocaleString('en-IN', {
    day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit',
  });

  return (
    <div className={`signal-card ${isBuy ? 'buy' : 'sell'} animate-in`}>
      <div className="signal-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span className="signal-symbol">{signal.symbol}</span>
          <span className="tag tag-timeframe">{signal.timeframe}</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span className={`signal-badge ${isBuy ? 'buy' : 'sell'}`}>
            {isBuy ? '▲ BUY' : '▼ SELL'}
          </span>
          {signal.conviction === 'VERY_HIGH' || signal.conviction === 'MAXIMUM' ? (
            <span className="signal-badge very-high">{signal.conviction}</span>
          ) : (
            <span className="signal-badge high">{signal.conviction}</span>
          )}
        </div>
      </div>

      <div className="signal-meta">
        <span className="signal-meta-label">Price</span>
        <span className="signal-meta-value">₹{signal.price.toFixed(2)}</span>
        <span className="signal-meta-label">RSI</span>
        <span className={`signal-meta-value ${signal.rsiValue > 60 ? 'green' : signal.rsiValue < 40 ? 'red' : ''}`}>
          {signal.rsiValue.toFixed(1)}
        </span>
        {expanded && <>
          <span className="signal-meta-label">Volume</span>
          <span className="signal-meta-value">{signal.relativeVolume.toFixed(1)}x avg</span>
          <span className="signal-meta-label">Body/ATR</span>
          <span className="signal-meta-value">{signal.bodyStrength.toFixed(2)}x</span>
          <span className="signal-meta-label">Breakout</span>
          <span className="signal-meta-value">{signal.breakoutReason}</span>
          <span className="signal-meta-label">Trend</span>
          <span className="signal-meta-value">{signal.trendConfirm}</span>
        </>}
        <span className="signal-meta-label">Time</span>
        <span className="signal-meta-value" style={{ fontSize: 12 }}>{time}</span>
      </div>
    </div>
  );
}

function HealthDot({ label, ok }: { label: string; ok: boolean }) {
  return (
    <div className="health-item">
      <span className={`status-dot ${ok ? 'online' : 'offline'}`} />
      {label}
    </div>
  );
}

function formatUptime(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

function formatNumber(value?: number): string {
  return new Intl.NumberFormat('en-IN').format(value || 0);
}

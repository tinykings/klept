import React, { useState, useEffect } from 'react';
import { Plus, Trash2, Settings as SettingsIcon, RefreshCw, Pin, Github, Cloud, CloudOff, CheckCircle, Tag, X, Moon, Sun, Monitor, Bookmark as BookmarkIcon, Pencil, Search, ArrowUpRight } from 'lucide-react';
import type {
  Bookmark,
  Settings,
} from './lib/storage';
import {
  getBookmarks,
  saveBookmarks,
  getSettings,
  saveSettings,
  syncToGist,
  syncFromGist
} from './lib/storage';

function App() {
  const [bookmarks, setBookmarks] = useState<Bookmark[]>([]);
  const [settings, setSettings] = useState<Settings>({ gistId: '', githubToken: '', theme: 'system' });
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [editingBookmark, setEditingBookmark] = useState<Bookmark | null>(null);
  const [editTagsString, setEditTagsString] = useState('');
  const [newTitle, setNewTitle] = useState('');
  const [newUrl, setNewUrl] = useState('');
  const [newTags, setNewTags] = useState('');
  const [isAdding, setIsAdding] = useState(false);
  const [isFormExpanded, setIsFormExpanded] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedTag, setSelectedTag] = useState<string | null>(null);
  const [syncStatus, setSyncStatus] = useState<'idle' | 'syncing' | 'error' | 'success'>('idle');
  const [message, setMessage] = useState({ text: '', type: '' });
  const searchInputRef = React.useRef<HTMLInputElement>(null);
  const urlInputRef = React.useRef<HTMLInputElement>(null);
  const formRef = React.useRef<HTMLFormElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (isFormExpanded && formRef.current && !formRef.current.contains(event.target as Node)) {
        setIsFormExpanded(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isFormExpanded]);

  useEffect(() => {
    const localBookmarks = getBookmarks();
    const localSettings = getSettings();
    setBookmarks(localBookmarks);
    setSettings(localSettings);

    const params = new URLSearchParams(window.location.search);

    const tagParam = params.get('tag');
    if (tagParam) {
      setSelectedTag(tagParam);
    }

    const action = params.get('action');
    const urlParam = params.get('url');
    const titleParam = params.get('title');

    if (action === 'add' && urlParam) {
      setNewUrl(urlParam);
      if (titleParam) setNewTitle(titleParam);
      setIsFormExpanded(true);
    }

    if (localSettings.gistId && localSettings.githubToken) {
      autoPull(localSettings);
    }
  }, []);

  useEffect(() => {
    const root = window.document.documentElement;
    root.classList.remove('light', 'dark');

    if (settings.theme === 'system' || !settings.theme) {
      if (window.matchMedia('(prefers-color-scheme: dark)').matches) {
        root.classList.add('dark');
      } else {
        root.classList.add('light');
      }
    } else {
      root.classList.add(settings.theme);
    }
  }, [settings.theme]);

  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    const handleChange = () => {
      if (settings.theme === 'system' || !settings.theme) {
        const root = window.document.documentElement;
        root.classList.remove('light', 'dark');
        root.classList.add(mediaQuery.matches ? 'dark' : 'light');
      }
    };

    mediaQuery.addEventListener('change', handleChange);
    return () => mediaQuery.removeEventListener('change', handleChange);
  }, [settings.theme]);

  useEffect(() => {
    if (isFormExpanded && urlInputRef.current) {
      urlInputRef.current.focus();
    }
  }, [isFormExpanded]);

  const handleTagClick = (tag: string) => {
    const nextTag = selectedTag === tag ? null : tag;
    setSelectedTag(nextTag);

    const newUrl = new URL(window.location.href);
    if (nextTag) {
      newUrl.searchParams.set('tag', nextTag);
    } else {
      newUrl.searchParams.delete('tag');
    }
    window.history.pushState({}, '', newUrl);
  };

  const getAllTags = () => {
    const tags = new Set<string>();
    bookmarks.forEach(b => b.tags?.forEach(t => tags.add(t)));
    return Array.from(tags).sort();
  };

  const allTags = getAllTags();

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (document.activeElement?.tagName === 'INPUT' || document.activeElement?.tagName === 'TEXTAREA') {
        if (e.key === 'Enter' && document.activeElement === searchInputRef.current) {
           const sorted = getSortedBookmarks();
           if (sorted.length > 0) {
             window.location.href = sorted[0].url;
           }
        }
        if (/^[1-9]$/.test(e.key) && document.activeElement === searchInputRef.current) {
          const sorted = getSortedBookmarks();
          const target = sorted[parseInt(e.key) - 1];
          if (target) {
            e.preventDefault();
            window.location.href = target.url;
          }
        }
        return;
      }

      if (e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey) {
        searchInputRef.current?.focus();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [bookmarks, searchQuery]);

  const autoPull = async (currentSettings: Settings) => {
    setSyncStatus('syncing');
    try {
      const remote = await syncFromGist(currentSettings);
      const local = getBookmarks();

      if (remote.length === 0 && local.length > 0) {
        await syncToGist(local, currentSettings);
      } else {
        setBookmarks(remote);
        saveBookmarks(remote);
      }

      setSyncStatus('success');
      setTimeout(() => setSyncStatus('idle'), 3000);
    } catch (e) {
      console.error(e);
      setSyncStatus('error');
    }
  };

  const updateBookmarks = async (newBookmarks: Bookmark[]) => {
    setBookmarks(newBookmarks);
    saveBookmarks(newBookmarks);

    if (settings.gistId && settings.githubToken) {
      setSyncStatus('syncing');
      try {
        await syncToGist(newBookmarks, settings);
        setSyncStatus('success');
        setTimeout(() => setSyncStatus('idle'), 3000);
      } catch (e) {
        console.error(e);
        setSyncStatus('error');
      }
    }
  };

  const getSortedBookmarks = () => {
    const query = searchQuery.trim().toLowerCase();
    let filtered = bookmarks.filter(b =>
      b.title.toLowerCase().includes(query) ||
      b.url.toLowerCase().includes(query) ||
      b.tags?.some(t => t.toLowerCase().includes(query))
    );

    if (selectedTag) {
      return filtered
        .filter(b => b.tags?.includes(selectedTag))
        .sort((a, b) => a.title.localeCompare(b.title));
    }

    const pinned = filtered.filter(b => b.pinned).sort((a, b) => a.title.localeCompare(b.title));
    const unpinned = filtered.filter(b => !b.pinned).sort((a, b) => b.createdAt - a.createdAt);

    return [...pinned, ...unpinned];
  };

  const showMessage = (text: string, type: 'success' | 'error' = 'success') => {
    setMessage({ text, type });
    setTimeout(() => setMessage({ text: '', type: '' }), 3000);
  };

  const fetchTitle = async (url: string): Promise<string> => {
    let fallbackTitle = url;
    try {
      const urlObj = new URL(url);
      fallbackTitle = urlObj.hostname;
    } catch {
      // invalid url
    }

    try {
      const response = await fetch(`https://api.allorigins.win/get?url=${encodeURIComponent(url)}`);
      if (!response.ok) throw new Error('Proxy error');
      const data = await response.json();
      if (data.contents) {
        const doc = new DOMParser().parseFromString(data.contents, 'text/html');
        const title = doc.querySelector('title')?.textContent;
        if (title) return title.trim();
      }
    } catch (e) {
      console.warn('Failed to fetch title, using fallback:', e);
    }

    return fallbackTitle;
  };

  const handleAddBookmark = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newUrl) return;

    setIsAdding(true);
    const formattedUrl = newUrl.startsWith('http') ? newUrl : `https://${newUrl}`;

    try {
      let title = newTitle;
      if (!title) {
        title = await fetchTitle(formattedUrl);
      }

      const tagsList = newTags
        .split(',')
        .map(t => t.trim())
        .filter(t => t.length > 0);

      const newBookmark: Bookmark = {
        id: crypto.randomUUID(),
        title: title,
        url: formattedUrl,
        createdAt: Date.now(),
        pinned: false,
        tags: tagsList,
      };

      const updated = [newBookmark, ...bookmarks];
      updateBookmarks(updated);
      setNewTitle('');
      setNewUrl('');
      setNewTags('');
      setIsFormExpanded(false);
      showMessage('Bookmark added!');
    } catch (error) {
      console.error(error);
      showMessage('Failed to add bookmark', 'error');
    } finally {
      setIsAdding(false);
    }
  };

  const handleDeleteBookmark = (id: string) => {
    if (!window.confirm('Delete this bookmark?')) return;
    const updated = bookmarks.filter(b => b.id !== id);
    updateBookmarks(updated);
  };

  const handleUpdateBookmark = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingBookmark) return;

    const tagsList = editTagsString.split(',').map(t => t.trim()).filter(t => t.length > 0);
    const updatedBookmark = { ...editingBookmark, tags: tagsList };

    const updated = bookmarks.map(b =>
      b.id === updatedBookmark.id ? updatedBookmark : b
    );
    updateBookmarks(updated);
    setEditingBookmark(null);
    showMessage('Bookmark updated!');
  };

  const handleTogglePin = (id: string) => {
    const updated = bookmarks.map(b =>
      b.id === id ? { ...b, pinned: !b.pinned } : b
    );
    updateBookmarks(updated);
  };

  const handleSaveSettings = (e: React.FormEvent) => {
    e.preventDefault();
    saveSettings(settings);
    setIsSettingsOpen(false);
    showMessage('Settings saved');
    if (settings.gistId && settings.githubToken) {
      autoPull(settings);
    }
  };

  const getDomain = (url: string) => {
    try { return new URL(url).hostname.replace('www.', ''); } catch { return ''; }
  };

  const sortedBookmarks = getSortedBookmarks();

  return (
    <div className="noise min-h-screen bg-paper text-ink font-body dark:bg-ink dark:text-paper transition-colors duration-300">
      {/* Header */}
      <header className="sticky top-0 z-10 bg-paper/80 backdrop-blur-xl border-b border-paper-border dark:bg-ink/80 dark:border-ink-border">
        <div className="max-w-5xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <h1
              className="font-mono text-xl font-bold tracking-tight cursor-pointer hover:text-amber transition-colors flex items-center gap-2.5"
              onClick={() => window.location.href = window.location.origin + window.location.pathname}
            >
              klept
            </h1>

            {/* Sync status */}
            <div className="flex items-center text-xs font-mono">
              {syncStatus === 'syncing' && (
                <span className="flex items-center gap-1.5 text-amber animate-fade-in">
                  <RefreshCw size={12} className="animate-spin" />
                  sync
                </span>
              )}
              {syncStatus === 'success' && (
                <span className="flex items-center gap-1.5 text-green-accent animate-fade-in">
                  <CheckCircle size={12} />
                  synced
                </span>
              )}
              {syncStatus === 'error' && (
                <span className="flex items-center gap-1.5 text-red-accent animate-fade-in" title="Sync failed">
                  <CloudOff size={12} />
                  error
                </span>
              )}
              {syncStatus === 'idle' && settings.gistId && (
                <span className="flex items-center gap-1.5 text-ink-ghost dark:text-ink-subtle">
                  <Cloud size={12} />
                </span>
              )}
            </div>
          </div>

          <div className="flex items-center gap-1">
            <a
              href="https://github.com/tinykings"
              target="_blank"
              rel="noopener noreferrer"
              className="p-2 rounded-md text-ink-subtle hover:text-ink hover:bg-paper-dim transition-all dark:text-ink-ghost dark:hover:text-paper dark:hover:bg-ink-lighter"
              title="GitHub"
            >
              <Github size={16} />
            </a>
            <button
              onClick={() => setIsSettingsOpen(true)}
              className="p-2 rounded-md text-ink-subtle hover:text-ink hover:bg-paper-dim transition-all dark:text-ink-ghost dark:hover:text-paper dark:hover:bg-ink-lighter"
              title="Settings"
            >
              <SettingsIcon size={16} />
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-6 py-8">
        {/* Toast message */}
        {message.text && (
          <div className={`mb-6 animate-slide-down font-mono text-sm px-4 py-2.5 rounded-md border-l-2 ${
            message.type === 'error'
              ? 'bg-red-accent/10 text-red-accent border-red-accent'
              : 'bg-green-accent/10 text-green-accent border-green-accent'
          }`}>
            {message.text}
          </div>
        )}

        {/* Add bookmark */}
        {!isFormExpanded ? (
          <button
            onClick={() => setIsFormExpanded(true)}
            className="w-full py-3 px-4 rounded-lg border border-dashed border-paper-border text-paper-muted hover:text-amber hover:border-amber/40 hover:bg-amber-glow transition-all flex items-center justify-center gap-2 mb-8 font-mono text-sm dark:border-ink-border dark:text-ink-subtle dark:hover:text-amber dark:hover:border-amber/30 dark:hover:bg-amber-glow cursor-pointer animate-fade-up"
          >
            <Plus size={14} />
            steal a link
          </button>
        ) : (
          <form ref={formRef} onSubmit={handleAddBookmark} className="mb-8 animate-slide-down rounded-lg border border-paper-border bg-paper p-5 dark:border-ink-border dark:bg-ink-light">
            <div className="flex flex-col gap-3">
              <input
                ref={urlInputRef}
                type="text"
                placeholder="URL"
                className="w-full px-3 py-2 bg-paper-dim border border-paper-border rounded-md font-mono text-sm focus:outline-none focus:border-amber focus:ring-1 focus:ring-amber dark:bg-ink-lighter dark:border-ink-border dark:text-paper dark:placeholder-ink-muted"
                value={newUrl}
                disabled={isAdding}
                onChange={(e) => setNewUrl(e.target.value)}
              />
              <div className="grid grid-cols-1 md:grid-cols-[1fr,1fr,auto] gap-3">
                <input
                  type="text"
                  placeholder="Title (optional)"
                  className="w-full px-3 py-2 bg-paper-dim border border-paper-border rounded-md text-sm focus:outline-none focus:border-amber focus:ring-1 focus:ring-amber dark:bg-ink-lighter dark:border-ink-border dark:text-paper dark:placeholder-ink-muted"
                  value={newTitle}
                  disabled={isAdding}
                  onChange={(e) => setNewTitle(e.target.value)}
                />
                <div className="relative">
                  <input
                    type="text"
                    placeholder="Tags (comma separated)"
                    className="w-full px-3 py-2 bg-paper-dim border border-paper-border rounded-md text-sm focus:outline-none focus:border-amber focus:ring-1 focus:ring-amber dark:bg-ink-lighter dark:border-ink-border dark:text-paper dark:placeholder-ink-muted"
                    value={newTags}
                    disabled={isAdding}
                    onChange={(e) => setNewTags(e.target.value)}
                    list="tags-list"
                  />
                  <datalist id="tags-list">
                    {allTags.map(tag => (
                      <option key={tag} value={tag} />
                    ))}
                  </datalist>
                </div>
                <button
                  type="submit"
                  disabled={isAdding || !newUrl}
                  className="bg-ink text-paper px-5 py-2 rounded-md text-sm font-medium hover:bg-ink/80 disabled:opacity-30 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-2 min-w-[90px] dark:bg-paper dark:text-ink dark:hover:bg-paper/80"
                >
                  {isAdding ? (
                    <RefreshCw size={14} className="animate-spin" />
                  ) : (
                    <>
                      <Plus size={14} />
                      Add
                    </>
                  )}
                </button>
              </div>
            </div>
          </form>
        )}

        {/* Search */}
        <div className="mb-5 relative animate-fade-up" style={{ animationDelay: '0.05s' }}>
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-paper-muted dark:text-ink-muted pointer-events-none" />
          <input
            ref={searchInputRef}
            autoFocus
            type="text"
            placeholder="Search bookmarks..."
            className="w-full pl-9 pr-4 py-2.5 bg-paper-dim border border-paper-border rounded-lg text-sm focus:outline-none focus:border-amber focus:ring-1 focus:ring-amber transition-colors dark:bg-ink-light dark:border-ink-border dark:text-paper dark:placeholder-ink-muted"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>

        {/* Tags */}
        {allTags.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mb-6 animate-fade-up" style={{ animationDelay: '0.1s' }}>
            {allTags.map(tag => (
              <button
                key={tag}
                onClick={() => handleTagClick(tag)}
                className={`px-2.5 py-1 rounded-md text-xs font-mono transition-all flex items-center gap-1 ${
                  selectedTag === tag
                    ? 'bg-amber/15 text-amber border border-amber/30 font-medium'
                    : 'text-paper-subtle border border-paper-border hover:border-amber/30 hover:text-amber dark:text-ink-ghost dark:border-ink-border dark:hover:border-amber/30 dark:hover:text-amber'
                }`}
              >
                <Tag size={10} />
                {tag}
                {selectedTag === tag && <X size={10} className="ml-0.5" />}
              </button>
            ))}
          </div>
        )}

        {/* Search hints */}
        {searchQuery.trim() && sortedBookmarks.length > 0 && (
          <p className="mb-3 font-mono text-xs text-paper-muted dark:text-ink-muted">
            <span className="opacity-70">↵ opens first result · 1–9 opens by number</span>
          </p>
        )}

        {/* Bookmark list */}
        <div className="space-y-1.5">
          {sortedBookmarks.length === 0 ? (
            <div className="text-center py-16 animate-fade-up">
              <p className="font-mono text-sm text-paper-muted dark:text-ink-muted">
                {searchQuery || selectedTag
                  ? 'Nothing matches.'
                  : 'No bookmarks yet.'}
              </p>
            </div>
          ) : (
            sortedBookmarks.map((bookmark, i) => (
              <div
                key={bookmark.id}
                onClick={() => window.location.href = bookmark.url}
                className="group animate-fade-up rounded-lg border border-paper-border px-4 py-3 flex items-center justify-between cursor-pointer transition-all duration-200 hover:bg-paper-dim dark:border-ink-border dark:hover:bg-ink-light"
                style={{ animationDelay: `${0.04 * Math.min(i, 15)}s` }}
              >
                <div className="flex-1 min-w-0 flex items-center gap-3">
                  {/* Number badge */}
                  {searchQuery.trim() && i < 9 && (
                    <span className="font-mono text-xs text-paper-subtle dark:text-ink-ghost w-4 text-center shrink-0 select-none">
                      {i + 1}
                    </span>
                  )}
                  {/* Favicon */}
                  <img
                    src={`https://www.google.com/s2/favicons?domain=${getDomain(bookmark.url)}&sz=32`}
                    alt=""
                    className="w-4 h-4 rounded-sm shrink-0 opacity-60 group-hover:opacity-100 transition-opacity"
                    onError={(e) => { e.currentTarget.style.display = 'none'; }}
                  />

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      {bookmark.pinned && (
                        <Pin size={10} className="text-amber fill-amber shrink-0" />
                      )}
                      <h3 className="text-sm font-medium truncate group-hover:text-amber transition-colors">
                        {bookmark.title}
                      </h3>
                      <ArrowUpRight size={12} className="shrink-0 opacity-0 group-hover:opacity-50 transition-opacity -ml-0.5" />
                    </div>
                    <div className="flex items-center gap-2 mt-0.5">
                      <p className="text-xs text-paper-muted truncate font-mono dark:text-ink-muted">{getDomain(bookmark.url)}</p>
                      {bookmark.tags && bookmark.tags.length > 0 && (
                        <div className="flex gap-1 shrink-0">
                          {bookmark.tags.map(tag => (
                            <span key={tag} className="text-[10px] font-mono text-paper-subtle bg-paper-dim px-1.5 py-0.5 rounded dark:bg-ink-lighter dark:text-ink-ghost">
                              {tag}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-0.5 ml-3 shrink-0">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setEditingBookmark(bookmark);
                      setEditTagsString(bookmark.tags?.join(', ') || '');
                    }}
                    className="p-1.5 rounded-md text-ink-subtle hover:text-amber hover:bg-amber-glow transition-all dark:text-ink-ghost dark:hover:text-amber"
                    title="Edit"
                  >
                    <Pencil size={13} />
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleTogglePin(bookmark.id);
                    }}
                    className={`p-1.5 rounded-md transition-all ${
                      bookmark.pinned
                        ? 'text-amber'
                        : 'text-ink-subtle hover:text-amber hover:bg-amber-glow dark:text-ink-ghost dark:hover:text-amber'
                    }`}
                    title={bookmark.pinned ? "Unpin" : "Pin"}
                  >
                    <Pin size={13} className={bookmark.pinned ? "fill-current" : ""} />
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDeleteBookmark(bookmark.id);
                    }}
                    className="p-1.5 rounded-md text-ink-subtle hover:text-red-accent hover:bg-red-accent/10 transition-all dark:text-ink-ghost dark:hover:text-red-accent"
                    title="Delete"
                  >
                    <Trash2 size={13} />
                  </button>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Footer count */}
        {bookmarks.length > 0 && (
          <div className="mt-8 pt-6 border-t border-paper-border dark:border-ink-border animate-fade-up" style={{ animationDelay: '0.3s' }}>
            <p className="text-xs font-mono text-paper-muted dark:text-ink-muted">
              {sortedBookmarks.length} of {bookmarks.length} bookmarks
              {selectedTag && <span> in <span className="text-amber">#{selectedTag}</span></span>}
            </p>
          </div>
        )}
      </main>

      {/* Settings modal */}
      {isSettingsOpen && (
        <div className="fixed inset-0 bg-ink/60 flex items-center justify-center z-50 p-4 backdrop-blur-md animate-fade-in">
          <div className="bg-paper rounded-xl border border-paper-border max-w-md w-full p-6 animate-fade-up dark:bg-ink-light dark:border-ink-border">
            <div className="flex justify-between items-center mb-6">
              <h2 className="font-mono text-lg font-bold flex items-center gap-2">
                <SettingsIcon size={18} />
                Settings
              </h2>
              <button onClick={() => setIsSettingsOpen(false)} className="p-1 rounded-md hover:bg-paper-dim dark:hover:bg-ink-lighter transition-colors">
                <X size={16} />
              </button>
            </div>
            <form onSubmit={handleSaveSettings} className="space-y-5">
              {/* Theme */}
              <div>
                <label className="block text-xs font-mono font-medium text-paper-subtle mb-2 uppercase tracking-wider dark:text-ink-ghost">Theme</label>
                <div className="flex gap-1 p-1 bg-paper-dim rounded-lg dark:bg-ink-lighter">
                  {[
                    { key: 'light' as const, icon: Sun, label: 'Light' },
                    { key: 'dark' as const, icon: Moon, label: 'Dark' },
                    { key: 'system' as const, icon: Monitor, label: 'System' },
                  ].map(({ key, icon: Icon, label }) => (
                    <button
                      key={key}
                      type="button"
                      onClick={() => setSettings({ ...settings, theme: key })}
                      className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-md text-xs font-medium transition-all ${
                        (settings.theme === key || (key === 'system' && !settings.theme))
                          ? 'bg-paper text-ink shadow-sm dark:bg-ink dark:text-paper'
                          : 'text-paper-muted hover:text-ink dark:text-ink-muted dark:hover:text-paper'
                      }`}
                    >
                      <Icon size={13} />
                      {label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Bookmarklet */}
              <div className="border-t border-paper-border pt-5 dark:border-ink-border">
                <h3 className="text-xs font-mono font-medium text-paper-subtle mb-2 uppercase tracking-wider flex items-center gap-1.5 dark:text-ink-ghost">
                  <BookmarkIcon size={12} />
                  Bookmarklet
                </h3>
                <p className="text-xs text-paper-muted mb-3 dark:text-ink-muted">
                  Drag to your bookmarks bar:
                </p>
                <div
                  dangerouslySetInnerHTML={{
                    __html: `<a href="javascript:(function(){window.location.href='${window.location.origin}${window.location.pathname}?action=add&url='+encodeURIComponent(window.location.href)+'&title='+encodeURIComponent(document.title)})()" class="inline-block px-3 py-1.5 bg-ink text-paper rounded-md text-xs font-mono font-medium hover:bg-ink/80 dark:bg-paper dark:text-ink dark:hover:bg-paper/80 cursor-grab active:cursor-grabbing transition-colors" onclick="event.preventDefault()">+ Add to Klept</a>`
                  }}
                />
              </div>

              {/* GitHub Sync */}
              <div className="border-t border-paper-border pt-5 dark:border-ink-border">
                <h3 className="text-xs font-mono font-medium text-paper-subtle mb-3 uppercase tracking-wider flex items-center gap-1.5 dark:text-ink-ghost">
                  <Github size={12} />
                  GitHub Sync
                </h3>
                <div className="space-y-3">
                  <div>
                    <label className="block text-xs font-medium text-paper-subtle mb-1 dark:text-ink-ghost">Access Token</label>
                    <input
                      type="password"
                      className="w-full px-3 py-2 bg-paper-dim border border-paper-border rounded-md text-sm font-mono focus:outline-none focus:border-amber focus:ring-1 focus:ring-amber dark:bg-ink-lighter dark:border-ink-border dark:text-paper dark:placeholder-ink-muted"
                      placeholder="ghp_..."
                      value={settings.githubToken}
                      onChange={(e) => setSettings({ ...settings, githubToken: e.target.value })}
                    />
                    <p className="text-[10px] font-mono text-paper-muted mt-1 dark:text-ink-muted">Requires gist scope</p>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-paper-subtle mb-1 dark:text-ink-ghost">Gist ID</label>
                    <input
                      type="text"
                      className="w-full px-3 py-2 bg-paper-dim border border-paper-border rounded-md text-sm font-mono focus:outline-none focus:border-amber focus:ring-1 focus:ring-amber dark:bg-ink-lighter dark:border-ink-border dark:text-paper dark:placeholder-ink-muted"
                      placeholder="5d53f..."
                      value={settings.gistId}
                      onChange={(e) => setSettings({ ...settings, gistId: e.target.value })}
                    />
                  </div>
                </div>
              </div>

              <div className="flex gap-2 pt-3">
                <button
                  type="button"
                  onClick={() => setIsSettingsOpen(false)}
                  className="flex-1 px-4 py-2 border border-paper-border rounded-md text-sm hover:bg-paper-dim transition-colors dark:border-ink-border dark:text-ink-ghost dark:hover:bg-ink-lighter"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 px-4 py-2 bg-ink text-paper rounded-md text-sm font-medium hover:bg-ink/80 transition-colors dark:bg-paper dark:text-ink dark:hover:bg-paper/80"
                >
                  Save
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit modal */}
      {editingBookmark && (
        <div className="fixed inset-0 bg-ink/60 flex items-center justify-center z-50 p-4 backdrop-blur-md animate-fade-in">
          <div className="bg-paper rounded-xl border border-paper-border max-w-md w-full p-6 animate-fade-up dark:bg-ink-light dark:border-ink-border">
            <div className="flex justify-between items-center mb-5">
              <h2 className="font-mono text-lg font-bold">Edit</h2>
              <button onClick={() => setEditingBookmark(null)} className="p-1 rounded-md hover:bg-paper-dim dark:hover:bg-ink-lighter transition-colors">
                <X size={16} />
              </button>
            </div>
            <form onSubmit={handleUpdateBookmark} className="space-y-3">
              <div>
                <label className="block text-xs font-mono font-medium text-paper-subtle mb-1 uppercase tracking-wider dark:text-ink-ghost">URL</label>
                <input
                  type="text"
                  className="w-full px-3 py-2 bg-paper-dim border border-paper-border rounded-md text-sm font-mono focus:outline-none focus:border-amber focus:ring-1 focus:ring-amber dark:bg-ink-lighter dark:border-ink-border dark:text-paper"
                  value={editingBookmark.url}
                  onChange={(e) => setEditingBookmark({ ...editingBookmark, url: e.target.value })}
                />
              </div>
              <div>
                <label className="block text-xs font-mono font-medium text-paper-subtle mb-1 uppercase tracking-wider dark:text-ink-ghost">Title</label>
                <input
                  type="text"
                  className="w-full px-3 py-2 bg-paper-dim border border-paper-border rounded-md text-sm focus:outline-none focus:border-amber focus:ring-1 focus:ring-amber dark:bg-ink-lighter dark:border-ink-border dark:text-paper"
                  value={editingBookmark.title}
                  onChange={(e) => setEditingBookmark({ ...editingBookmark, title: e.target.value })}
                />
              </div>
              <div>
                <label className="block text-xs font-mono font-medium text-paper-subtle mb-1 uppercase tracking-wider dark:text-ink-ghost">Tags</label>
                <input
                  type="text"
                  className="w-full px-3 py-2 bg-paper-dim border border-paper-border rounded-md text-sm focus:outline-none focus:border-amber focus:ring-1 focus:ring-amber dark:bg-ink-lighter dark:border-ink-border dark:text-paper"
                  value={editTagsString}
                  onChange={(e) => setEditTagsString(e.target.value)}
                  list="edit-tags-list"
                />
                <datalist id="edit-tags-list">
                  {allTags.map(tag => (
                    <option key={tag} value={tag} />
                  ))}
                </datalist>
              </div>
              <div className="flex gap-2 pt-3">
                <button
                  type="button"
                  onClick={() => setEditingBookmark(null)}
                  className="flex-1 px-4 py-2 border border-paper-border rounded-md text-sm hover:bg-paper-dim transition-colors dark:border-ink-border dark:text-ink-ghost dark:hover:bg-ink-lighter"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 px-4 py-2 bg-ink text-paper rounded-md text-sm font-medium hover:bg-ink/80 transition-colors dark:bg-paper dark:text-ink dark:hover:bg-paper/80"
                >
                  Save
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;

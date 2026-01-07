import React, { useState, useEffect } from 'react';
import { Plus, Trash2, Settings as SettingsIcon, RefreshCw, Pin, Github, Cloud, CloudOff, CheckCircle, Tag, X, Moon, Sun, Monitor, Bookmark as BookmarkIcon } from 'lucide-react';
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

    // Check URL params
    const params = new URLSearchParams(window.location.search);
    
    // Tag filtering
    const tagParam = params.get('tag');
    if (tagParam) {
      setSelectedTag(tagParam);
    }

    // Bookmarklet / Quick Add support
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

  // Apply theme
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

  // Listen for system theme changes
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
    
    // Update URL without reloading
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
      // If user is typing in an input, don't interfere unless it's Enter in the search box
      if (document.activeElement?.tagName === 'INPUT' || document.activeElement?.tagName === 'TEXTAREA') {
        if (e.key === 'Enter' && document.activeElement === searchInputRef.current) {
           const sorted = getSortedBookmarks();
           if (sorted.length > 0) {
             window.location.href = sorted[0].url;
           }
        }
        return;
      }

      // If typing alphanumerics and not holding modifiers, focus search
      if (e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey) {
        searchInputRef.current?.focus();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [bookmarks, searchQuery]); // Add dependencies to ensure getSortedBookmarks has latest data

  const autoPull = async (currentSettings: Settings) => {
    setSyncStatus('syncing');
    try {
      const remote = await syncFromGist(currentSettings);
      setBookmarks(remote);
      saveBookmarks(remote);
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
    let filtered = bookmarks.filter(b => 
      b.title.toLowerCase().includes(searchQuery.toLowerCase()) || 
      b.url.toLowerCase().includes(searchQuery.toLowerCase()) ||
      b.tags?.some(t => t.toLowerCase().includes(searchQuery.toLowerCase()))
    );

    if (selectedTag) {
      filtered = filtered.filter(b => b.tags?.includes(selectedTag));
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
    // Default fallback: use domain name or full URL
    let fallbackTitle = url;
    try {
      const urlObj = new URL(url);
      fallbackTitle = urlObj.hostname;
    } catch {
      // invalid url, keep original string
    }

    try {
      // Use allorigins.win as a CORS proxy to fetch the page content
      const response = await fetch(`https://api.allorigins.win/get?url=${encodeURIComponent(url)}`);
      
      if (!response.ok) {
        throw new Error('Proxy error');
      }

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
      
      // Only fetch title if one wasn't provided
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
    const updated = bookmarks.filter(b => b.id !== id);
    updateBookmarks(updated);
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
    showMessage('Settings saved locally');
    if (settings.gistId && settings.githubToken) {
      autoPull(settings);
    }
  };

  const sortedBookmarks = getSortedBookmarks();

  return (
    <div className="min-h-screen bg-gray-100 text-gray-900 font-sans dark:bg-gray-900 dark:text-gray-100 transition-colors duration-200">
      <header className="bg-white border-b sticky top-0 z-10 dark:bg-gray-900 dark:border-gray-800">
        <div className="max-w-4xl mx-auto px-4 h-16 flex items-center justify-between">
          <h1 className="text-xl font-bold flex items-center gap-2">
            Klept
          </h1>
          <div className="flex items-center gap-2">
            <div className="flex items-center mr-2 text-sm text-gray-500 dark:text-gray-400">
              {syncStatus === 'syncing' && (
                <span className="flex items-center gap-1 text-indigo-600 dark:text-indigo-400">
                  <RefreshCw size={14} className="animate-spin" />
                  Syncing...
                </span>
              )}
              {syncStatus === 'success' && (
                <span className="flex items-center gap-1 text-green-600 dark:text-green-400">
                  <CheckCircle size={14} />
                  Synced
                </span>
              )}
              {syncStatus === 'error' && (
                <span className="flex items-center gap-1 text-red-500 dark:text-red-400" title="Sync failed. Check settings.">
                  <CloudOff size={14} />
                  Error
                </span>
              )}
              {syncStatus === 'idle' && settings.gistId && (
                <span className="flex items-center gap-1 text-gray-400 dark:text-gray-500">
                  <Cloud size={14} />
                </span>
              )}
            </div>
            <button
              onClick={() => setIsSettingsOpen(true)}
              className="p-2 hover:bg-gray-100 rounded-full transition-colors dark:hover:bg-gray-800"
              title="Settings"
            >
              <SettingsIcon size={20} />
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-8">
        {message.text && (
          <div className={`mb-6 p-3 rounded-md text-sm font-medium ${
            message.type === 'error' 
              ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400' 
              : 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
          }`}>
            {message.text}
          </div>
        )}

        {!isFormExpanded ? (
          <button
            onClick={() => setIsFormExpanded(true)}
            className="w-full bg-white p-4 rounded-xl border border-dashed border-gray-300 text-gray-500 hover:text-indigo-600 hover:border-indigo-300 hover:bg-indigo-50 transition-all flex items-center justify-center gap-2 mb-8 dark:bg-gray-800 dark:border-gray-700 dark:text-gray-400 dark:hover:bg-gray-700/50 dark:hover:text-indigo-400 dark:hover:border-indigo-700"
          >
            Take it for yourself, you deserve it...
          </button>
        ) : (
          <form ref={formRef} onSubmit={handleAddBookmark} className="bg-white p-6 rounded-xl border shadow-sm mb-8 relative dark:bg-gray-800 dark:border-gray-700">
            <div className="flex flex-col gap-4">
              <input
                ref={urlInputRef}
                type="text"
                placeholder="URL (e.g. github.com)"
                className="w-full px-4 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:bg-gray-900 dark:border-gray-700 dark:text-white dark:placeholder-gray-500"
                value={newUrl}
                disabled={isAdding}
                onChange={(e) => setNewUrl(e.target.value)}
              />
              <div className="grid grid-cols-1 md:grid-cols-[1fr,1fr,auto] gap-4">
                <input
                  type="text"
                  placeholder="Title (optional)"
                  className="w-full px-4 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:bg-gray-900 dark:border-gray-700 dark:text-white dark:placeholder-gray-500"
                  value={newTitle}
                  disabled={isAdding}
                  onChange={(e) => setNewTitle(e.target.value)}
                />
                <div className="relative">
                  <input
                    type="text"
                    placeholder="Tags"
                    className="w-full px-4 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:bg-gray-900 dark:border-gray-700 dark:text-white dark:placeholder-gray-500"
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
                  className="bg-indigo-600 text-white px-6 py-2 rounded-md hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2 min-w-[100px] dark:bg-indigo-600 dark:hover:bg-indigo-500"
                >
                  {isAdding ? (
                    <RefreshCw size={20} className="animate-spin" />
                  ) : (
                    <>
                      <Plus size={20} />
                      Add
                    </>
                  )}
                </button>
              </div>
            </div>
          </form>
        )}

        <div className="mb-4">
          <input
            ref={searchInputRef}
            type="text"
            placeholder="Search bookmarks..."
            className="w-full px-4 py-2 bg-white border rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 shadow-sm dark:bg-gray-800 dark:border-gray-700 dark:text-white dark:placeholder-gray-500"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>

        {allTags.length > 0 && (
          <div className="flex flex-wrap gap-2 mb-6">
            {allTags.map(tag => (
              <button
                key={tag}
                onClick={() => handleTagClick(tag)}
                className={`px-3 py-1 rounded-full text-sm font-medium transition-colors flex items-center gap-1 ${
                  selectedTag === tag 
                    ? 'bg-indigo-100 text-indigo-800 ring-2 ring-indigo-500 dark:bg-indigo-900/30 dark:text-indigo-300 dark:ring-indigo-500' 
                    : 'bg-white text-gray-700 hover:bg-gray-50 border border-gray-200 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700 dark:border-gray-700'
                }`}
              >
                <Tag size={12} />
                {tag}
                {selectedTag === tag && <X size={12} className="ml-1" />}
              </button>
            ))}
          </div>
        )}

        <div className="space-y-3">
          {sortedBookmarks.length === 0 ? (
            <div className="text-center py-12 text-gray-500 border-2 border-dashed rounded-xl dark:border-gray-800 dark:text-gray-500">
              <p>
                {searchQuery || selectedTag 
                  ? 'No bookmarks match your filter.' 
                  : 'No bookmarks yet. Add your first link above!'}
              </p>
            </div>
          ) : (
            sortedBookmarks.map((bookmark) => (
              <div 
                key={bookmark.id} 
                onClick={() => window.location.href = bookmark.url}
                className="bg-white p-4 rounded-lg border shadow-sm hover:shadow-md hover:bg-gray-50 transition-all flex items-center justify-between group cursor-pointer dark:bg-gray-800 dark:border-gray-700 dark:hover:bg-gray-700 dark:hover:border-gray-600"
              >
                <div className="flex-1 min-w-0">
                  <h3 className="font-medium truncate group-hover:text-indigo-600 transition-colors block dark:text-gray-100 dark:group-hover:text-indigo-400">
                    {bookmark.title}
                  </h3>
                  <div className="flex items-center gap-2 mt-1">
                    <p className="text-sm text-gray-500 truncate dark:text-gray-400">{bookmark.url}</p>
                    {bookmark.tags && bookmark.tags.length > 0 && (
                      <div className="flex gap-1">
                        {bookmark.tags.map(tag => (
                          <span key={tag} className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full dark:bg-gray-900 dark:text-gray-300">
                            #{tag}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-3 ml-4">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleTogglePin(bookmark.id);
                    }}
                    className={`p-2 rounded-md transition-all ${
                      bookmark.pinned 
                        ? 'text-yellow-500 bg-yellow-50 hover:bg-yellow-100 dark:bg-yellow-900/30 dark:hover:bg-yellow-900/50' 
                        : 'text-gray-400 hover:text-gray-600 hover:bg-gray-50 dark:hover:bg-gray-800 dark:hover:text-gray-300'
                    }`}
                    title={bookmark.pinned ? "Unpin" : "Pin to top"}
                  >
                    <Pin size={18} className={bookmark.pinned ? "fill-current" : ""} />
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDeleteBookmark(bookmark.id);
                    }}
                    className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-md transition-all dark:hover:bg-red-900/30 dark:hover:text-red-400"
                    title="Delete"
                  >
                    <Trash2 size={18} />
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </main>

      {isSettingsOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 backdrop-blur-sm">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-6 dark:bg-gray-900 dark:border dark:border-gray-800">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-xl font-bold flex items-center gap-2 dark:text-white">
                <SettingsIcon size={24} />
                Settings
              </h2>
            </div>
            <form onSubmit={handleSaveSettings} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2 dark:text-gray-300">Theme</label>
                <div className="flex gap-2 p-1 bg-gray-100 rounded-lg dark:bg-gray-800">
                  <button
                    type="button"
                    onClick={() => setSettings({ ...settings, theme: 'light' })}
                    className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-md text-sm font-medium transition-all ${
                      settings.theme === 'light'
                        ? 'bg-white text-indigo-600 shadow-sm dark:bg-gray-700 dark:text-indigo-400'
                        : 'text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200'
                    }`}
                  >
                    <Sun size={16} />
                    Light
                  </button>
                  <button
                    type="button"
                    onClick={() => setSettings({ ...settings, theme: 'dark' })}
                    className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-md text-sm font-medium transition-all ${
                      settings.theme === 'dark'
                        ? 'bg-white text-indigo-600 shadow-sm dark:bg-gray-700 dark:text-indigo-400'
                        : 'text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200'
                    }`}
                  >
                    <Moon size={16} />
                    Dark
                  </button>
                  <button
                    type="button"
                    onClick={() => setSettings({ ...settings, theme: 'system' })}
                    className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-md text-sm font-medium transition-all ${
                      settings.theme === 'system' || !settings.theme
                        ? 'bg-white text-indigo-600 shadow-sm dark:bg-gray-700 dark:text-indigo-400'
                        : 'text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200'
                    }`}
                  >
                    <Monitor size={16} />
                    System
                  </button>
                </div>
              </div>

              <div className="border-t pt-4 dark:border-gray-800">
                <h3 className="font-medium mb-3 flex items-center gap-2 dark:text-gray-200">
                  <BookmarkIcon size={18} />
                  Bookmarklet
                </h3>
                <p className="text-sm text-gray-500 mb-2 dark:text-gray-400">
                  Drag this link to your bookmarks bar to quickly add sites to Klept:
                </p>
                <div
                  dangerouslySetInnerHTML={{
                    __html: `<a href="javascript:(function(){window.location.href='${window.location.origin}${window.location.pathname}?action=add&url='+encodeURIComponent(window.location.href)+'&title='+encodeURIComponent(document.title)})()" class="inline-block px-3 py-1 bg-gray-100 border border-gray-300 rounded text-sm font-medium text-indigo-600 hover:bg-gray-200 dark:bg-gray-800 dark:border-gray-700 dark:text-indigo-400 dark:hover:bg-gray-700 cursor-grab active:cursor-grabbing" onclick="event.preventDefault()">Add to Klept</a>`
                  }}
                />
              </div>

              <div className="border-t pt-4 dark:border-gray-800">
                <h3 className="font-medium mb-3 flex items-center gap-2 dark:text-gray-200">
                  <Github size={18} />
                  GitHub Sync
                </h3>
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1 dark:text-gray-300">Personal Access Token</label>
                    <input
                      type="password"
                      className="w-full px-4 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:bg-gray-800 dark:border-gray-700 dark:text-white dark:placeholder-gray-500"
                      placeholder="ghp_..."
                      value={settings.githubToken}
                      onChange={(e) => setSettings({ ...settings, githubToken: e.target.value })}
                    />
                    <p className="text-xs text-gray-500 mt-1 dark:text-gray-400">Requires 'gist' scope.</p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1 dark:text-gray-300">Gist ID</label>
                    <input
                      type="text"
                      className="w-full px-4 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:bg-gray-800 dark:border-gray-700 dark:text-white dark:placeholder-gray-500"
                      placeholder="e.g. 5d53f..."
                      value={settings.gistId}
                      onChange={(e) => setSettings({ ...settings, gistId: e.target.value })}
                    />
                  </div>
                </div>
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => setIsSettingsOpen(false)}
                  className="flex-1 px-4 py-2 border rounded-md hover:bg-gray-50 transition-colors dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-800"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 transition-colors dark:bg-indigo-600 dark:hover:bg-indigo-500"
                >
                  Save Settings
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
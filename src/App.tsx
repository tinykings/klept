import React, { useState, useEffect } from 'react';
import { Plus, Trash2, Settings as SettingsIcon, RefreshCw, Pin, Github } from 'lucide-react';
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
  const [settings, setSettings] = useState<Settings>({ gistId: '', githubToken: '' });
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newUrl, setNewUrl] = useState('');
  const [isAdding, setIsAdding] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [isSyncing, setIsSyncing] = useState(false);
  const [message, setMessage] = useState({ text: '', type: '' });

  useEffect(() => {
    setBookmarks(getBookmarks());
    setSettings(getSettings());
  }, []);

  const getSortedBookmarks = () => {
    const filtered = bookmarks.filter(b => 
      b.title.toLowerCase().includes(searchQuery.toLowerCase()) || 
      b.url.toLowerCase().includes(searchQuery.toLowerCase())
    );

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
      
      const newBookmark: Bookmark = {
        id: crypto.randomUUID(),
        title: title,
        url: formattedUrl,
        createdAt: Date.now(),
        pinned: false,
      };

      const updated = [newBookmark, ...bookmarks];
      setBookmarks(updated);
      saveBookmarks(updated);
      setNewTitle('');
      setNewUrl('');
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
    setBookmarks(updated);
    saveBookmarks(updated);
  };

  const handleTogglePin = (id: string) => {
    const updated = bookmarks.map(b => 
      b.id === id ? { ...b, pinned: !b.pinned } : b
    );
    setBookmarks(updated);
    saveBookmarks(updated);
  };

  const handleSaveSettings = (e: React.FormEvent) => {
    e.preventDefault();
    saveSettings(settings);
    setIsSettingsOpen(false);
    showMessage('Settings saved locally');
  };

  const handleSyncToGithub = async () => {
    setIsSyncing(true);
    try {
      await syncToGist(bookmarks, settings);
      showMessage('Synced to GitHub Gist!');
    } catch (error: any) {
      showMessage(error.message, 'error');
    } finally {
      setIsSyncing(false);
    }
  };

  const handleSyncFromGithub = async () => {
    setIsSyncing(true);
    try {
      const remoteBookmarks = await syncFromGist(settings);
      setBookmarks(remoteBookmarks);
      saveBookmarks(remoteBookmarks);
      showMessage('Fetched from GitHub Gist!');
    } catch (error: any) {
      showMessage(error.message, 'error');
    } finally {
      setIsSyncing(false);
    }
  };

  const sortedBookmarks = getSortedBookmarks();

  return (
    <div className="min-h-screen bg-gray-50 text-gray-900 font-sans">
      <header className="bg-white border-b sticky top-0 z-10">
        <div className="max-w-4xl mx-auto px-4 h-16 flex items-center justify-between">
          <h1 className="text-xl font-bold flex items-center gap-2">
            <span className="bg-indigo-600 text-white p-1 rounded">Kl</span>
            Klept
          </h1>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setIsSettingsOpen(true)}
              className="p-2 hover:bg-gray-100 rounded-full transition-colors"
              title="Settings"
            >
              <SettingsIcon size={20} />
            </button>
            <div className="flex gap-1">
              <button
                onClick={handleSyncToGithub}
                disabled={isSyncing || !settings.gistId}
                className="flex items-center gap-2 px-3 py-1.5 bg-gray-800 text-white rounded-md text-sm hover:bg-gray-700 disabled:opacity-50 transition-colors"
              >
                <RefreshCw size={16} className={isSyncing ? 'animate-spin' : ''} />
                Push
              </button>
              <button
                onClick={handleSyncFromGithub}
                disabled={isSyncing || !settings.gistId}
                className="flex items-center gap-2 px-3 py-1.5 border border-gray-300 rounded-md text-sm hover:bg-gray-50 disabled:opacity-50 transition-colors"
              >
                Pull
              </button>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-8">
        {message.text && (
          <div className={`mb-6 p-3 rounded-md text-sm font-medium ${
            message.type === 'error' ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'
          }`}>
            {message.text}
          </div>
        )}

        <form onSubmit={handleAddBookmark} className="bg-white p-6 rounded-xl border shadow-sm mb-8">
          <div className="grid grid-cols-1 md:grid-cols-[2fr,1fr,auto] gap-4">
            <input
              type="text"
              placeholder="URL (e.g. github.com)"
              className="w-full px-4 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
              value={newUrl}
              disabled={isAdding}
              onChange={(e) => setNewUrl(e.target.value)}
            />
            <input
              type="text"
              placeholder="Title (optional)"
              className="w-full px-4 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
              value={newTitle}
              disabled={isAdding}
              onChange={(e) => setNewTitle(e.target.value)}
            />
            <button
              type="submit"
              disabled={isAdding || !newUrl}
              className="bg-indigo-600 text-white px-6 py-2 rounded-md hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2 min-w-[100px]"
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
        </form>

        <div className="mb-6">
          <input
            type="text"
            placeholder="Search bookmarks..."
            className="w-full px-4 py-2 bg-white border rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 shadow-sm"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>

        <div className="space-y-3">
          {sortedBookmarks.length === 0 ? (
            <div className="text-center py-12 text-gray-500 border-2 border-dashed rounded-xl">
              <p>{searchQuery ? 'No bookmarks match your search.' : 'No bookmarks yet. Add your first link above!'}</p>
            </div>
          ) : (
            sortedBookmarks.map((bookmark) => (
              <div key={bookmark.id} className="bg-white p-4 rounded-lg border shadow-sm hover:shadow-md transition-shadow flex items-center justify-between group">
                <div className="flex-1 min-w-0">
                  <a
                    href={bookmark.url}
                    target="_blank"
                    rel="noopener noreferrer" 
                    className="font-medium truncate hover:text-indigo-600 transition-colors block"
                  >
                    {bookmark.title}
                  </a>
                  <p className="text-sm text-gray-500 truncate">{bookmark.url}</p>
                </div>
                <div className="flex items-center gap-3 ml-4">
                  <button
                    onClick={() => handleTogglePin(bookmark.id)}
                    className={`p-2 rounded-md transition-all ${
                      bookmark.pinned 
                        ? 'text-yellow-500 bg-yellow-50 hover:bg-yellow-100' 
                        : 'text-gray-400 hover:text-gray-600 hover:bg-gray-50'
                    }`}
                    title={bookmark.pinned ? "Unpin" : "Pin to top"}
                  >
                    <Pin size={18} className={bookmark.pinned ? "fill-current" : ""} />
                  </button>
                  <button
                    onClick={() => handleDeleteBookmark(bookmark.id)}
                    className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-md transition-all"
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
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-6">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-xl font-bold flex items-center gap-2">
                <Github size={24} />
                GitHub Sync Settings
              </h2>
            </div>
            <form onSubmit={handleSaveSettings} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">GitHub Personal Access Token</label>
                <input
                  type="password"
                  className="w-full px-4 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  placeholder="ghp_..."
                  value={settings.githubToken}
                  onChange={(e) => setSettings({ ...settings, githubToken: e.target.value })}
                />
                <p className="text-xs text-gray-500 mt-1">Requires 'gist' scope.</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Gist ID</label>
                <input
                  type="text"
                  className="w-full px-4 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  placeholder="e.g. 5d53f..."
                  value={settings.gistId}
                  onChange={(e) => setSettings({ ...settings, gistId: e.target.value })}
                />
              </div>
              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => setIsSettingsOpen(false)}
                  className="flex-1 px-4 py-2 border rounded-md hover:bg-gray-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 transition-colors"
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
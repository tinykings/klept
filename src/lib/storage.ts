export interface Bookmark {
  id: string;
  title: string;
  url: string;
  createdAt: number;
  pinned?: boolean;
  tags?: string[];
}

export interface Settings {
  gistId: string;
  githubToken: string;
  theme?: 'light' | 'dark' | 'system';
}

const STORAGE_KEY = 'klept_bookmarks';
const SETTINGS_KEY = 'klept_settings';

export const getBookmarks = (): Bookmark[] => {
  const data = localStorage.getItem(STORAGE_KEY);
  return data ? JSON.parse(data) : [];
};

export const saveBookmarks = (bookmarks: Bookmark[]) => {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(bookmarks));
};

export const getSettings = (): Settings => {
  const data = localStorage.getItem(SETTINGS_KEY);
  return data ? JSON.parse(data) : { gistId: '', githubToken: '', theme: 'system' };
};

export const saveSettings = (settings: Settings) => {
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
};

export const syncToGist = async (bookmarks: Bookmark[], settings: Settings) => {
  if (!settings.gistId || !settings.githubToken) {
    throw new Error('Gist ID and GitHub Token are required for syncing');
  }

  const response = await fetch(`https://api.github.com/gists/${settings.gistId}`, {
    method: 'PATCH',
    headers: {
      'Authorization': `token ${settings.githubToken}`,
      'Accept': 'application/vnd.github.v3+json',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      files: {
        'bookmarks.json': {
          content: JSON.stringify(bookmarks, null, 2),
        },
      },
    }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || 'Failed to sync to Gist');
  }
};

export const syncFromGist = async (settings: Settings): Promise<Bookmark[]> => {
  if (!settings.gistId || !settings.githubToken) {
    throw new Error('Gist ID and GitHub Token are required for syncing');
  }

  const response = await fetch(`https://api.github.com/gists/${settings.gistId}`, {
    headers: {
      'Authorization': `token ${settings.githubToken}`,
      'Accept': 'application/vnd.github.v3+json',
    },
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || 'Failed to fetch from Gist');
  }

  const gist = await response.json();
  const file = gist.files['bookmarks.json'];
  if (!file) {
    return [];
  }

  return JSON.parse(file.content);
};

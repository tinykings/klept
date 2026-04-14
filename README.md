<p align="center">
  <img src="public/logo.png" alt="Klept Logo" width="100" />
</p>

<h1 align="center">Klept</h1>

<h3 align="center">A minimalist, self-hosted bookmark manager.</h3>
<p align="center"><a href="https://tinykings.github.io/klept/">https://tinykings.github.io/klept/</a></p>

<p align="center">
  <a href="#features">Features</a> •
  <a href="#getting-started">Getting Started</a> •
  <a href="#deployment">Deployment</a> •
  <a href="#sync-setup">Sync Setup</a>
</p>

---

**Klept** is a small, private bookmark manager that you can host yourself on GitHub Pages, Cloudflare Pages, or run locally. It uses your browser's Local Storage by default and can sync across devices using a private GitHub Gist.

## Features

- 🔖 **Simple Management:** Add, edit, delete, and pin bookmarks.
- 🏷️ **Tags:** Organize bookmarks with tags and filter by them.
- 🔍 **Search:** Fast search through titles, URLs, and tags.
- ⚡ **Auto-Title:** Automatically fetches page titles when adding links.
- 🌓 **Themes:** Light, Dark, and System theme support.
- 🔄 **Sync:** Optional cross-device sync using GitHub Gists.
- 🪄 **Bookmarklet:** Add links from any page with a simple drag-and-drop button.

## Getting Started

### Prerequisites

- Node.js (v20 or later recommended)
- npm

### Clone and Run Locally

1. **Clone the repository:**
   ```bash
   git clone https://github.com/tinykings/klept.git
   cd klept
   ```

2. **Install dependencies:**
   ```bash
   npm install
   ```

3. **Start the development server:**
   ```bash
   npm run dev
   ```
   Open your browser and navigate to `http://localhost:5173`.

## Deployment

### Option 1: GitHub Pages (Recommended)

This repository includes a GitHub Action to automatically deploy to GitHub Pages.

1. **Fork** this repository to your own GitHub account.
2. Go to your repository **Settings** > **Pages**.
3. Under **Build and deployment**, select **GitHub Actions** as the source.
4. Go to the **Actions** tab in your repository and enable workflows if they are disabled.
5. Push a change to `main` or run the "Deploy to GitHub Pages" workflow manually.
6. Your site will be live at `https://<your-username>.github.io/klept/`.

### Option 2: Cloudflare Pages

1. Log in to the Cloudflare Dashboard and go to **Workers & Pages**.
2. Click **Create Application** > **Pages** > **Connect to Git**.
3. Select the `klept` repository.
4. Configure the build settings:
   - **Framework Preset:** `Vite`
   - **Build Command:** `npm run build`
   - **Build Output Directory:** `dist`
5. Click **Save and Deploy**.

## Sync Setup

To sync bookmarks across devices, Klept uses a GitHub Gist as a private storage backend.

1. **Create a GitHub Personal Access Token:**
   - Go to [GitHub Developer Settings > Tokens (Classic)](https://github.com/settings/tokens).
   - Generate a new token (classic).
   - Scopes: Select **`gist`** (Create gists).
   - Copy the generated token.

2. **Create a Gist:**
   - Go to [gist.github.com](https://gist.github.com).
   - Create a new public or secret gist with a file named `bookmarks.json`.
   - Content: `[]` (an empty JSON array).
   - Create the gist and copy its **ID** from the URL (e.g., `https://gist.github.com/user/--> 5d53f... <--`).

3. **Configure Klept:**
   - Open your Klept instance.
   - Click the **Settings** (gear icon).
   - Enter your **Access Token** and **Gist ID**.
   - Click **Save**.

Your bookmarks will now sync to this Gist!

## Tech Stack

- [React](https://react.dev/)
- [Vite](https://vitejs.dev/)
- [Tailwind CSS](https://tailwindcss.com/)
- [Lucide React](https://lucide.dev/) (Icons)

## License

MIT

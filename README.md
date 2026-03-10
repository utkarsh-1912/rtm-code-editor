# Utkristi Colabs 🚀

Utkristi Colabs is a **real-time collaborative code editor** designed for high-performance teams. Built with a focus on speed, persistence, and developer experience, it enables seamless pair programming, technical interviews, and team collaboration.

![Utkristi Colabs Logo](https://raw.githubusercontent.com/utkarsh-1912/rtm-code-editor/main/public/utkristi-colabs.png)

## ✨ Key Features

- **🚀 Pro IDE Workspace**: Transition from single-file rooms to full multi-file projects with persistent directory structures.
- **⚡ Next-Gen Collaboration**: Real-time cursor tracking, Shared Pointer mode, and built-in WebRTC Voice/Video conferencing.
- **🎨 Collaborative Whiteboard**: An integrated architectural sketching tool with dual-canvas synchronization and name-tagged drawing cursors.
- **🔥 Power User Tools**: Support for Vim/Emacs keybindings and real-time linting for JavaScript, HTML, and CSS.
- **💾 Persistent Workspaces**: Built on PostgreSQL (Neon DB), your rooms, projects, chat history, and whiteboards are saved automatically.
- **🛠️ Multi-Language Support**: Execute code in Python, C++, Java, and JavaScript using the Judge0 API.
- **📚 Snippets Library**: Save reusable code snippets to personal or team vaults and import them instantly.
- **📱 Universal Compatibility**: Fully responsive experience on mobile devices with touch-enabled whiteboard and tabbed project views.
- **🛡️ Enterprise Security**: Firebase Authentication with advanced session management. Track and manage active devices.

## 🛠️ Tech Stack

- **Frontend**: React.js, CodeMirror 6, Lucide Icons, React Reflex (Resizables), Tailwind-inspired Custom CSS.
- **Backend**: Node.js, Express.js, Socket.io (WebSockets).
- **Database**: PostgreSQL (via Neon DB Serverless).
- **Auth**: Firebase Authentication.
- **Styles**: Modern CSS with Glassmorphism and Dynamic Theme Support (Dark/Light).

## 🚀 Getting Started

### Prerequisites

- Node.js (version 18 or higher)
- A Neon DB (PostgreSQL) connection string
- Firebase project credentials

### Installation

1. Clone the repository:
   ```bash
   git clone https://github.com/utkarsh-1912/rtm-code-editor.git
   cd rtm-code-editor
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Configure Environment Variables:
   Create a `.env` file in the root directory:
   ```env
   REACT_APP_BACKEND_URL=your_backend_url
   DATABASE_URL=your_neon_db_url
   # Add Firebase config as needed
   ```

4. Start Development:
   ```bash
   # Start Backend
   npm run server:dev

   # Start Frontend
   npm run start:front
   ```

## 📐 Architecture

Utkristi Colabs uses a hybrid synchronization model:
- **State Persistence**: Room metadata, chat history, and snippets are stored in the PostgreSQL database.
- **Real-time Sync**: Operational transformations and cursor movements are handled via WebSockets for zero-lag interaction.

---

Developed with ❤️ by [Utkristi.io](https://utkristi-io.netlify.app) & [utkarsh-1912](https://github.com/utkarsh-1912)

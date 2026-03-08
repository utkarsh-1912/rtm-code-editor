# Utkristi Colabs 🚀

Utkristi Colabs is a **real-time collaborative code editor** designed for high-performance teams. Built with a focus on speed, persistence, and developer experience, it enables seamless pair programming, technical interviews, and team collaboration.

![Utkristi Colabs Logo](https://raw.githubusercontent.com/utkarsh-1912/rtm-code-editor/main/public/utkristi-colabs.png)

## ✨ Key Features

- **⚡ Real-time Collaboration**: Sub-millisecond latency powered by Socket.io. See cursors, selections, and code changes instantly.
- **💾 Persistent Workspaces**: Built on PostgreSQL (Neon DB), your rooms, code, and chat history are saved automatically.
- **🛠️ Multi-Language Support**: Execute code in Python, C++, Java, and JavaScript using the Judge0 API.
- **📚 Snippets Library**: Save reusable code snippets to your personal vault and import them into any room with one click.
- **🛡️ Enterprise Security**: Firebase Authentication with advanced session management. Track active devices and remotely sign out of other sessions.
- **📱 Mobile Optimized**: A dedicated mobile experience with a tabbed interface and a "People" view for collaborator tracking.
- **🏠 Smart Revisit**: Instantly jump back into your last worked-on project directly from the landing page or dashboard.
- **💬 Integrated Chat**: Contextual team chat with persistent history and emoji support.

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

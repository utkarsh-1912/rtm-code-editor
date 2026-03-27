# Utkristi Colabs: Enterprise-Grade Collaborative IDE 🚀

Utkristi Colabs is a **world-class real-time collaborative IDE** engineered for high-performance engineering teams. It merges professional-grade code synchronization with cinematic video conferencing and a premium developer experience.

![Utkristi Colabs Banner](https://utkristi-colabs.onrender.com/utkristi-colabs.png)

## 💎 Premium Features

### 🎨 State-of-the-Art UI/UX
- **Glassmorphism 2.0**: A sophisticated, theme-aware aesthetic with layered blurs, glowing borders, and dynamic saturation.
- **Zen Mode (`Alt + Z`)**: A one-click distraction-free interface that hides sidebars and terminals for deep-focus coding sessions.
- **Command Palette (`Ctrl + K`)**: A powerful fuzzy-search interface to access all IDE actions, file navigation, and settings instantly.

### 🚀 Advanced Workspace
- **Multi-File Persistence**: Full project directory support with hierarchical structures built on Neon PostgreSQL.
- **Real-time Synchronization**: Sub-millisecond multi-cursor precision powered by advanced Operational Transformation (OT).
- **Cinematic Video Chat**: Integrated 4K-ready video conferencing with an intelligent 16:9 grid that auto-scales without clipping.

### 📊 Enterprise Dashboard
- **Activity Timeline**: A horizontal, scrollable carousel tracking your recent project interactions and team contributions.
- **Project Health Hub**: Visualized project cards with language breakdowns, collaborator counts, and metadata.
- **SMTP Relay Diagnostics**: Built-in verification tools for ensuring enterprise email delivery and SMTP health.

## 🛠️ Tech Stack

- **Frontend**: React 18, CodeMirror 6, Lucide Icons, Vanilla CSS (Premium Design System).
- **Backend**: Node.js 22+, Express.js, Socket.io (Real-time Topology).
- **Communication**: Brevo API (Transactional Emails), WebRTC (Direct Media Relay).
- **Database**: PostgreSQL (Neon Serverless).

## 🚀 Quick Start

### Prerequisites
- Node.js v18+
- Neon DB Connection String
- Firebase Project Credentials
- Brevo API Key

### Installation

1. **Clone & Install**:
   ```bash
   git clone https://github.com/utkarsh-1912/rtm-code-editor.git
   cd rtm-code-editor
   npm install
   ```

2. **Configuration (`.env`)**:
   ```env
   DATABASE_URL=your_postgresql_url
   BREVO_API_KEY=your_brevo_key
   BREVO_FROM_EMAIL=noreply@yourdomain.com
   APP_URL=https://your-deployment.com
   ```

3. **Run Development**:
   ```bash
   # Start Production-ready Server
   node server.js
   # In another terminal
   npm start
   ```

## 📐 Enterprise Architecture

Utkristi Colabs uses a **Tri-Sync Topology**:
1. **Keystroke Layer**: WebSockets handle OT synchronization for immediate feedback.
2. **Persistence Layer**: All project artifacts are written to PostgreSQL on every significant change.
3. **Media Layer**: Peer-to-peer WebRTC handles the heavy lifting of video conferencing, offloading server resources.

---

Developed with ❤️ for the global developer community by **[Utkristi.io](https://utkristi-io.netlify.app)**

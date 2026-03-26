# RTM Studio 🚀

RTM Studio (Utkristi Colabs) is a **world-class real-time collaborative IDE** engineered for high-performance engineering teams. It merges professional-grade code synchronization with cinematic video conferencing and a premium developer experience.

![RTM Studio Banner](https://utkristi-colabs.onrender.com/utkristi-colabs.png)

## ✨ Enterprise-Grade Features

- **🎥 Cinematic Video Conferencing**: Low-latency 4K video with an intelligent 16:9 grid that auto-scales across all devices without clipping.
- **🚀 Pro Project Workspaces**: Persistent multi-file directory structures built on Neon PostgreSQL with sub-millisecond Keystroke Sync.
- **🎨 Advanced Architectural Whiteboard**: Real-time sketching with dual-canvas synchronization and user-tagged cursors.
- **🛡️ Enterprise Communication**: A localized email engine using Brevo, featuring high-fidelity invitations and self-service compliance management.
- **📱 Universal Mobile Focus**: Fully optimized mobile IDE with a specialized navigation tray and zero-clutter headers.
- **💾 Global State Persistence**: Automatically saved room states, chat histories, and snippet vaults ensuring zero data loss.
- **🛠️ Multi-Runtime Support**: Instant code execution via Judge0 for Python, C++, Java, and JavaScript.

## 🛠️ Tech Stack

- **Frontend**: React.js, CodeMirror 6, Lucide Icons, React-Router-Dom v6.
- **Backend**: Node.js 22+, Express.js, Socket.io (Real-time).
- **Communication**: Brevo API (Transactional Emails), WebRTC (Video/Audio).
- **Database**: PostgreSQL (Neon Serverless).
- **Security**: Firebase Identity Management with session tracking.

## 🚀 Quick Start

### Prerequisites
- Node.js v18+
- Neon DB Connection String
- Firebase Project Credentials
- Brevo API Key

### Installation
1. Clone & Install:
   ```bash
   git clone https://github.com/utkarsh-1912/rtm-code-editor.git
   cd rtm-code-editor
   npm install
   ```

2. Configuration (`.env`):
   ```env
   DATABASE_URL=your_postgresql_url
   BREVO_API_KEY=your_brevo_key
   BREVO_FROM_EMAIL=noreply@yourdomain.com
   APP_URL=https://your-deployment.com
   ```

3. Run Environment:
   ```bash
   # Production-ready Server
   node server.js
   ```

## 📐 Enterprise Architecture

RTM Studio uses a **Tri-Sync Topology**:
1. **Keystroke Layer**: WebSockets handle OT-like synchronization for immediate feedback.
2. **Persistence Layer**: All project artifacts are written to PostgreSQL on every significant change.
3. **Media Layer**: Peer-to-peer WebRTC handles the heavy lifting of video conferencing, offloading server resources.

---

Developed with ❤️ for the global developer community by **[Utkristi.io](https://utkristi-io.netlify.app)**

# IGTS Veille Réglementaire 2.0 🚀

Welcome to the modernized **IGTS Veille Réglementaire** platform. This project is a complete architectural overhaul of the legacy monolithic Symfony 5 application into a modern, decoupled, and AI-powered stack.

## 🎯 Project Vision
The primary goal of this revamp is to provide a premium user experience (UX/UI), ensure high performance, and automate heavy manual tasks using local AI, all while remaining 100% backward-compatible with the existing database and user credentials.

## 🛠 Tech Stack
- **Frontend:** Next.js (React) + Tailwind CSS (Glassmorphism & modern UI)
- **Backend:** NestJS (TypeScript)
- **Database:** MySQL + Prisma ORM
- **Artificial Intelligence:** Local LLMs via Ollama (Free, secure, and private)

## ✨ Key Features (Phase 1)

### 1. Seamless Legacy Integration
- **Database Mapping:** Fully reverse-engineered over 30 legacy tables (`veille_db.sql`) into a modern Prisma schema without losing any existing data.
- **Backward-Compatible Auth:** Implemented a custom JWT authentication guard in NestJS that correctly validates legacy `argon2id` hashed passwords. Existing clients can log in without resetting their passwords.

### 2. Premium Dashboards
- **Company Portal:** Companies can track their compliance rates, view assigned legal texts, and manage pending actions through a modern interface.
- **Admin Portal:** Administrators have a bird's-eye view of all companies, active texts, and the health of the AI Scraper.
- **Interactive Notifications:** Real-time dropdowns to alert users when a new relevant legal text is detected.

### 3. AI Automation (The Core Innovation)
- **The AI Legal Scraper:** A NestJS Cron Job that runs daily at midnight. It scrapes official portals (e.g., `iort.gov.tn`), feeds the raw legal jargon to Ollama, and asks the AI to extract meaning, generate a 3-sentence summary, and save it directly to the database.
- **RAG Chatbot (Legal Assistant):** Companies have access to an AI chatbot in their dashboard. The bot strictly uses the company's assigned legal texts as context to answer compliance questions, preventing hallucinations and ensuring high accuracy.

## 🚀 Getting Started (Local Development)

### Prerequisites
- Node.js (v18+)
- Docker & Docker Compose
- Ollama (running locally on port `11434`)

### Setup Instructions
1. **Start the Database:**
   ```bash
   docker-compose up -d
   ```
2. **Start the Backend (NestJS):**
   ```bash
   cd backend
   npm install
   npx prisma generate
   npm run start:dev
   ```
3. **Start the Frontend (Next.js):**
   ```bash
   cd frontend
   npm install
   npm run dev
   ```
4. **Access the App:** Open `http://localhost:3000` in your browser.

## 📅 Roadmap (Upcoming)
- **Compliance Evaluations:** Finalize the CRUD for companies to mark texts as Compliant / Non-Compliant.
- **Action Plans:** Complete the Action Plan management UI.
- **WebSockets:** Upgrade the notification system from static to real-time Socket.io push notifications.
- **Mobile Ready:** Ensure API endpoints are documented for a future React Native mobile application.

# 📊 DataViz Pro — Enterprise Data Analytics & Visualization Platform

DataViz Pro is a full-stack, enterprise-grade data analytics and visualization platform designed for data analysts, business intelligence teams, and decision makers. It seamlessly bridges relational databases (MySQL) and flat data files (Excel `.xlsx`/`.xls`, CSV) with automated Exploratory Data Analysis (EDA), AI-driven insights via Google Gemini, and interactive custom dashboards.

---

## ✨ Key Features

- **Multi-Source Data Ingestion**:
  - Direct connection to MySQL instances with schema discovery and table exploration.
  - Drag-and-drop file upload for Excel (`.xlsx`, `.xls`) and CSV files up to 50MB with instant parsing.
- **Automated Exploratory Data Analysis (EDA)**:
  - Dataset health checks, missing value detection, duplicates analysis, and data type inference.
  - Automated summary statistics, numerical distributions, skewness, and IQR anomaly scoring.
  - Intelligent data cleaning engine with one-click outlier & null filtering.
- **AI-Powered Analytics & Narrative**:
  - Integrated Google Gemini AI data analyst providing executive summaries, trend narratives, and prescriptive recommendations.
  - Natural-language Q&A against dataset schemas and distributions.
- **Dynamic Visual Dashboard Builder**:
  - Multi-chart generation (Bar, Line, Scatter, Pie, Doughnut, Radar, Heatmaps).
  - Responsive KPI cards, sparklines, and metric strips.
  - Dark Mode and Light Mode with WCAG-compliant high-contrast themes.
  - Export capabilities for data reports (PDF, Word, PNG charts).
- **Security & Authentication**:
  - Firebase Authentication supporting Email/Password and Google Single Sign-On (SSO).
  - Session management and persistent analyst query history stored in Firestore.

---

## 🛠️ Architecture & Tech Stack

### Frontend
- **Framework**: React 18 with Vite
- **Routing**: React Router v6
- **Styling**: Modern Design System with CSS Custom Properties (Variables), Dark/Light mode tokens, and Lucide React icons
- **State Management**: React Context (`AuthContext`, `DataContext`, `ThemeContext`)
- **Charting**: Chart.js / Recharts with dynamic color palettes

### Backend
- **Framework**: Python 3.10+ / Flask with Flask-CORS
- **Data Processing**: Pandas, NumPy, OpenPyXL, XLRD
- **Database Connector**: PyMySQL, SQLAlchemy
- **AI Engine**: Google Generative AI (`google-generativeai`)
- **Reporting**: Python-Docx

---

## 🚀 Getting Started

### Prerequisites
- Node.js 18+ and npm
- Python 3.10+ and pip
- MySQL Server (optional, for direct database queries)

### 1. Clone & Set Up the Repository
```bash
git clone https://github.com/omurkar/DataViz-Pro.git
cd DataViz-Pro
```

### 2. Backend Setup
```bash
cd backend
python -m venv venv
# On Windows:
venv\Scripts\activate
# On Linux/macOS:
source venv/bin/activate

pip install -r requirements.txt
```

Create a `.env` file in the `backend/` folder (or root) with your Gemini API key:
```env
GEMINI_API_KEY=your_gemini_api_key_here
```

Start the Flask backend:
```bash
python server.py
# Backend runs at http://localhost:5000
```

### 3. Frontend Setup
In a new terminal window:
```bash
# Return to root directory
cd DataViz-Pro

npm install
```

Configure Firebase in `.env` (refer to `.env.example`):
```env
VITE_FIREBASE_API_KEY=your_api_key
VITE_FIREBASE_AUTH_DOMAIN=your_project.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=your_project_id
VITE_FIREBASE_STORAGE_BUCKET=your_project.firebasestorage.app
VITE_FIREBASE_MESSAGING_SENDER_ID=your_sender_id
VITE_FIREBASE_APP_ID=your_app_id
```

Run the development server:
```bash
npm run dev
# Frontend runs at http://localhost:5173
```

---

## 📁 Project Structure

```
DataViz-Pro/
├── backend/
│   ├── server.py              # Flask API (MySQL, Excel, EDA & Gemini endpoints)
│   └── requirements.txt       # Python dependencies
├── src/
│   ├── context/
│   │   ├── AuthContext.jsx    # Firebase auth state & login/logout handlers
│   │   ├── DataContext.jsx    # Global data pipeline state (MySQL & Excel)
│   │   └── ThemeContext.jsx   # Dark / Light mode provider & toggle
│   ├── pages/
│   │   ├── LoginPage.jsx      # Authentication page (Email/Pass & Google SSO)
│   │   ├── MainDashboard.jsx  # Analyst overview, KPI strip, sparklines & recent files
│   │   ├── ConnectionPage.jsx # MySQL connection & Drag-and-Drop Excel upload
│   │   ├── EdaPage.jsx         # Automated EDA, cleaning, and Gemini narrative
│   │   ├── CustomizePage.jsx  # Interactive dashboard designer
│   │   ├── DashboardView.jsx  # Presentation view of assembled charts
│   │   └── HistoryPage.jsx    # Past datasets and saved report logs
│   ├── firebase.js            # Firebase SDK initialization
│   ├── index.css              # Design tokens, variables & responsive utilities
│   ├── main.jsx               # React entry point
│   └── App.jsx                # Router configuration & protected routes
├── .env.example               # Template environment configuration
├── .gitignore                 # Git ignore rules (protects credentials & binaries)
├── package.json
├── vite.config.js
└── README.md
```

---

## 📄 License
MIT License. Open-source for personal and commercial analytics workloads.

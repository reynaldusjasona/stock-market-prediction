# StockWise AI

**FYP-26-S2-26 | University of Wollongong at SIM**

A web-based stock market prediction platform for US equities. Combines real-time market data, technical analysis, news sentiment, and an XGBoost classifier to generate Buy/Sell signals with confidence scores and SHAP-based explanations.

---

## Team

| Name | Role |
|------|------|
| Jason Agnus Dei Liemanta (Agus) | Group leader, backend, ML, integration |
| Jason Anderson Kwarso | Frontend UI |
| Sennett Faria | Frontend admin panel, documentation |
| Dong Xuan Ngoc Hoa (Hana) | ML/backend, documentation |

Supervisor: Mr. Ee Kiam Keong

---

## Tech stack

| Layer | Technology |
|-------|-----------|
| Backend | Python 3.12, FastAPI |
| Frontend | React 18, Vite, D3.js |
| Database | PostgreSQL (Supabase, Singapore region) |
| ML model | XGBoost (binary Buy/Sell classifier) |
| Auth | Custom JWT with bcrypt |
| Real-time data | Finnhub REST API |
| Historical data | Alpha Vantage |
| Training data | yfinance (academic use) |
| Deployment | Render (backend), Vercel (frontend) |

---

## Features

**Guest**: Browse landing page, view FAQs, register an account.

**Investor**: Real-time stock quotes and interactive charts, AI prediction engine with multi-timeframe signals (1d/3d/5d), news feed with sentiment analysis, price alerts and notifications, watchlist and portfolio tracking, personalized stock recommendations, subscription management (Stripe integration), browse and connect with approved traders, submit feedback.

**Trader**: View assigned investor signals, endorse or override AI predictions, respond to stock inquiries from investors.

**Administrator**: Dashboard with platform metrics, manage user accounts (suspend, unsuspend, role changes), approve/reject trader registrations with license verification, manage feedback (approve to landing page testimonials), model performance monitoring with per-class metrics, retrain request management, landing page content editor, API source management, platform alerts monitoring, activity log with user attribution.

---

## Project structure

```
stock-market-prediction/
├── backend/
│   ├── app/
│   │   ├── routers/          # 16 route modules
│   │   ├── services/         # business logic (1:1 with routers)
│   │   ├── core/             # database, security, API clients, email
│   │   └── main.py           # FastAPI app, CORS, router registration
│   ├── ml/
│   │   ├── inference/        # predict.py (SHAP), prediction_service.py
│   │   ├── training/         # features, labeling, train, evaluate
│   │   ├── sentiment_data/   # FinBERT pipeline, historical news scoring
│   │   └── saved_models/     # xgboost_model_latest.joblib
│   ├── tests/
│   │   ├── admin_unit/       # 90 unit tests
│   │   ├── admin_integration/# 67 integration tests
│   │   ├── trader_unit/      # 42 unit tests
│   │   └── trader_integration/# 25 integration tests
│   ├── requirements.txt
│   └── .env.example
├── frontend/
│   ├── src/
│   │   ├── pages/            # 16 investor/guest pages + 31 admin pages
│   │   ├── components/       # reusable UI components
│   │   ├── api/              # api.js (fetch wrapper with JWT injection)
│   │   ├── context/          # AuthContext (subscription gating)
│   │   ├── utils/            # formatting helpers
│   │   └── styles/           # per-page CSS + shared.css
│   ├── vercel.json           # SPA routing rewrites
│   └── vite.config.js
└── docs/
```

---

## Setup

### Prerequisites

- Python 3.12+
- Node.js 18+
- A Supabase project (PostgreSQL)
- Finnhub API key

### Backend

```bash
cd backend
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
cp .env.example .env
# Fill in .env with your credentials
uvicorn app.main:app --reload --port 8000
```

### Frontend

```bash
cd frontend
npm install
npm run dev
```

Runs on `http://localhost:5173`.

### Environment variables

Copy `backend/.env.example` to `backend/.env` and fill in the required values. The example file lists all variables needed for Supabase, JWT, Finnhub, Alpha Vantage, and SMTP configuration.

Frontend environment is set via `frontend/.env` (local) and `frontend/.env.production` (deployed). The only variable is `VITE_API_URL`.

---

## ML pipeline

| Aspect | Detail |
|--------|--------|
| Data source | yfinance — 5 years daily OHLCV, 35 tickers across 7 sectors |
| Features | 37 features: SMA20, EMA20, RSI14, MACD, Bollinger Bands, return windows, volatility, SPY relative metrics, candlestick patterns, news sentiment (FinBERT) |
| Labeling | Triple-barrier: upper/lower barriers at ±1.5× 20-day rolling volatility. Next-day high touching upper → Buy, next-day low touching lower → Sell. Ambiguous days dropped. |
| Split | Time-based (no shuffle): 70% train / 15% validation / 15% test |
| Model | XGBoost with `sample_weight='balanced'` for class imbalance |
| Inference | Single-ticker prediction with SHAP TreeExplainer for feature attribution. 1d signal scaled to 3d/5d via confidence decay heuristic. |
| Deployment | CPU-only inference on Render (512 MB RAM) |

### Training

```bash
cd backend
source venv/bin/activate
python3 -m ml.training.train
```

Model saves to `backend/ml/saved_models/xgboost_model_latest.joblib`.

### Evaluation

```bash
python3 -m ml.training.evaluate
```

Prints classification report and auto-upserts metrics to Supabase `prediction_metrics` table.

---

## API endpoints

All paths relative to `/api`. "Auth" = requires `Authorization: Bearer <jwt>`. "Admin" = auth + admin role.

### Auth
| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/auth/register` | No | Register (investor or trader) |
| POST | `/auth/login` | No | Login, returns JWT + user object |
| GET | `/auth/user/{id}` | No | Get user profile |
| PUT | `/auth/user/{id}` | No | Update name/password |
| DELETE | `/auth/user/{id}` | No | Delete account |

### Stocks
| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/stocks/trending` | No | Trending tickers |
| GET | `/stocks/search?q=` | No | Search by ticker/company |
| GET | `/stocks/movers` | No | Top gainers and losers |
| GET | `/stocks/{ticker}` | No | Stock quote |
| GET | `/stocks/{ticker}/history?period=` | No | OHLCV history (1W/1M/3M/1Y) |
| GET | `/stocks/{ticker}/indicators` | No | Technical indicators |
| GET | `/stocks/{ticker}/fundamentals` | No | Fundamental data |
| GET | `/stocks/{ticker}/chart` | Auth | Combined history + live price |

### Predictions
| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/predictions/{ticker}` | Auth | Run ML model, persist result |
| GET | `/predictions/{ticker}/history` | Auth | Past predictions (limit ≤ 50) |
| GET | `/predictions/{ticker}/recommendation` | Auth | Signal summary |
| GET | `/predictions/{ticker}/details` | Auth | Full reasoning + live data |

### Watchlist, Portfolio, Alerts, Notifications
| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/watchlist` | Auth | List watchlist |
| POST | `/watchlist/{ticker}` | Auth | Add to watchlist |
| DELETE | `/watchlist/{ticker}` | Auth | Remove from watchlist |
| GET | `/portfolio` | Auth | List holdings |
| POST | `/portfolio` | Auth | Add holding |
| DELETE | `/portfolio/{ticker}` | Auth | Remove holding |
| POST | `/alerts/{ticker}` | Auth | Create price alert |
| PATCH | `/alerts/{id}` | Auth | Update alert |
| DELETE | `/alerts/{id}` | Auth | Delete alert |
| GET | `/notifications` | Auth | List notifications |

### Subscription
| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/subscription/plans` | No | Available plans |
| GET | `/subscription` | Auth | Current subscription |
| POST | `/subscription` | Auth | Subscribe |
| POST | `/subscription/cancel` | Auth | Cancel subscription |

### Feedback
| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/feedback` | Auth | Submit feedback (investor only) |
| GET | `/feedback` | Admin | List feedback with filters |
| PATCH | `/feedback/{id}/approve` | Admin | Approve feedback |
| PATCH | `/feedback/{id}/reject` | Admin | Reject feedback |

### Admin
| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/admin/stats` | Admin | Dashboard statistics |
| GET | `/admin/users` | Admin | List all users |
| GET | `/admin/users/search?keywords=` | Admin | Search users |
| PUT | `/admin/users/{id}` | Admin | Update user role/status |
| PATCH | `/admin/users/{id}/suspend` | Admin | Suspend user |
| PATCH | `/admin/users/{id}/approve-trader` | Admin | Approve trader |
| GET | `/admin/model/performance` | Admin | Model metrics |
| GET | `/admin/model/quality` | Admin | Per-class metrics |
| POST | `/admin/model/retrain` | Admin | Request retrain |
| GET | `/admin/landing` | Admin | Landing page content |
| PUT | `/admin/landing` | Admin | Update landing page |
| GET | `/admin/activity-log` | Admin | Activity logs |
| GET | `/admin/platform-alerts` | Admin | Platform alerts |
| GET | `/admin/apis` | Admin | API source management |

---

## Testing

```bash
cd backend
source venv/bin/activate
pytest tests/
```

224 tests across admin and trader modules (132 unit, 92 integration). All passing.

---

## Deployment

| Component | Platform | URL |
|-----------|----------|-----|
| Backend | Render (free tier) | `https://stock-market-prediction-ntko.onrender.com` |
| Frontend | Vercel | `https://stock-market-prediction-lemon.vercel.app` |

The backend free tier sleeps after 15 minutes of inactivity. First request after sleep takes ~30 seconds (cold start).

---

## Git workflow

- Feature branches per module (e.g., `feature/admin-portal`, `feat/watchlist-ui`)
- Branch protection on `main` — all changes via pull request
- Squash merges used

---

## License

MIT

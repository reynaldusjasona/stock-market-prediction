# StockWise AI

**FYP-26-S2-26 | University of Wollongong at SIM**

A web-based stock market forecasting and recommendation platform for the US market. Combines real-time market data, technical analysis, and an XGBoost ML model that generates Buy/Hold/Sell signals with confidence scores.

---

## Team

| Name | Role |
|------|------|
| Jason Agnus Dei Liemanta (Agus) | Backend, ML, Integration |
| Jason Anderson Kwarso | Frontend |
| Sennett Faria | Documentation, Frontend |
| Hana | Documentation, Backend |

Supervisor: Mr. Ee Kiam Keong

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Backend | Python 3.14, FastAPI |
| Frontend | React, D3.js |
| Database | PostgreSQL (Supabase) |
| ML Model | XGBoost (Buy/Hold/Sell classifier) |
| Auth | JWT (custom) |
| Market Data | Finnhub REST API |
| Training Data | yfinance |
| Indicators | Twelve Data, Alpha Vantage |

---

## Core Features

- User registration and login (JWT auth)
- Real-time stock data (Finnhub)
- AI prediction engine (XGBoost, 82% accuracy)
- Interactive charts and technical indicators
- News and sentiment analysis
- Price alerts and in-app notifications
- Top gainers/losers and stock screener
- Simplified order book
- Personalized stock recommendations

---

## Project Structure

```
stock-market-prediction/
├── backend/
│   ├── app/
│   │   ├── routers/        # auth, stocks, predictions, news, alerts, notifications, admin
│   │   ├── services/       # business logic
│   │   ├── schemas/        # Pydantic models
│   │   ├── core/           # config, dependencies
│   │   └── main.py
│   ├── ml/
│   │   ├── features.py     # yfinance fetch + technical indicators + labeling
│   │   ├── train.py        # GridSearchCV + time-based split + model versioning
│   │   ├── evaluate.py     # accuracy, F1, confusion matrix, ROC-AUC
│   │   ├── predict.py      # single-ticker inference
│   │   ├── prediction_service.py  # Supabase upsert
│   │   └── saved_models/   # timestamped .joblib files
│   ├── tests/
│   ├── requirements.txt
│   └── .env.example
└── frontend/
```

---

## Setup

### Prerequisites

- Python 3.14
- Node.js 18+
- A Supabase project
- Finnhub API key (free tier)

### Backend

```bash
cd backend
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
cp .env.example .env
# Fill in .env with your keys
uvicorn app.main:app --reload --port 8000
```

### Train the ML model

```bash
cd backend
source venv/bin/activate
python3 -m ml.train
```

Training runs GridSearchCV over 27 hyperparameter combinations (81 fits across 3 TimeSeriesSplit folds). Takes 10-20 minutes on first run. Model saves to `ml/saved_models/xgboost_model_YYYYMMDD_HHMMSS.joblib` with a `xgboost_model_latest.joblib` copy.

### Frontend

```bash
cd frontend
npm install
npm run dev
```

Runs on `http://localhost:5173`.

---

## Environment Variables

Copy `.env.example` to `.env` and fill in:

```
SUPABASE_URL=
SUPABASE_KEY=
FINNHUB_API_KEY=
JWT_SECRET=
```

---

## ML Pipeline

- **Data**: yfinance, 5 years of daily OHLCV for 10 US tickers
- **Preprocessing**: duplicate removal, forward fill, chronological sort
- **Features**: SMA20, EMA20, RSI14, MACD, Bollinger Bands
- **Labels**: Buy (>+2% next day), Sell (<-2% next day), Hold (within ±2%)
- **Split**: 70% train / 15% val / 15% test (time-based, no shuffle)
- **Model**: XGBoost with GridSearchCV (n_estimators, max_depth, learning_rate)
- **Evaluation**: accuracy, weighted F1, confusion matrix, ROC-AUC (OvR)
- **Versioning**: each trained model saved with timestamp

---

## API Endpoints

Base URL: `http://localhost:8000/api`

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST | `/auth/register` | No | Register account |
| POST | `/auth/login` | No | Login, returns JWT |
| GET | `/stocks/{ticker}` | Yes | Stock quote |
| GET | `/stocks/trending` | Yes | Top movers |
| GET | `/predictions/{ticker}` | Yes | ML prediction |
| POST | `/predictions/batch` | Yes | Batch predictions |
| GET | `/news/{ticker}` | Yes | News + sentiment |
| POST | `/alerts` | Yes | Create price alert |
| GET | `/notifications` | Yes | User notifications |

---

## Running Tests

```bash
cd backend
source venv/bin/activate
pytest tests/
```

---

## Git Workflow

- One feature branch per module (`feature/module-name`)
- All changes via PR — branch protection active on `main`
- PR descriptions include use case references (G01+, I01+, T01+, A01+)

---

## License

MIT

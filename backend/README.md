# GHOST Backend — AI-Native Quantitative Investment Intelligence Platform

## Overview
GHOST is a modular, AI-native quantitative crypto/Web3 investment intelligence platform. It collects market data, detects regimes, generates quantitative signals, models participant behavior, evaluates portfolio risk, studies historical patterns, executes backtests, and delivers explainable investment intelligence.

---

## Directory Structure
```
backend/
├── app/
│   ├── main.py                     # FastAPI application factory & lifecycle
│   ├── core/
│   │   ├── config.py               # Pydantic-settings configuration
│   │   ├── logging.py              # Structured JSON/Console logging with request correlation
│   │   ├── exceptions.py           # Custom exception hierarchy & standard handlers
│   │   └── middleware.py           # Request ID, latency timer, security headers
│   ├── api/
│   │   ├── deps.py                 # Dependency injection providers
│   │   └── v1/
│   │       ├── router.py           # Master v1 API router
│   │       └── routes/
│   │           └── health.py       # Health check routes
│   └── schemas/
│       └── common.py               # Standardized success and error response envelopes
├── tests/
│   ├── conftest.py                 # Test fixtures & test clients
│   ├── unit/                       # Unit tests (config, exceptions)
│   └── api/                        # API & middleware integration tests
├── .env.example                    # Environment template
├── .gitignore                      # Git ignore rules
├── requirements.txt                # Python dependencies
└── README.md                       # Documentation
```

---

## Quickstart

### 1. Prerequisites
- Python 3.11+ (Python 3.14 compatible)
- pip

### 2. Environment Configuration
Copy `.env.example` to `.env`:
```bash
cp .env.example .env
```

### 3. Run the Development Server
From inside the `backend` directory:
```bash
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

### 4. Interactive Documentation
- **Swagger UI:** `http://localhost:8000/docs`
- **ReDoc:** `http://localhost:8000/redoc`
- **OpenAPI Schema:** `http://localhost:8000/api/v1/openapi.json`

### 5. Health Endpoints
- **Root Health:** `GET http://localhost:8000/health`
  ```json
  {
      "status": "healthy",
      "service": "GHOST",
      "version": "0.1.0"
  }
  ```
- **API v1 Health:** `GET http://localhost:8000/api/v1/health`
  ```json
  {
      "success": true,
      "data": {
          "status": "healthy",
          "service": "GHOST",
          "version": "0.1.0",
          "timestamp": "2026-09-19T12:45:00.000000+00:00",
          "environment": "development"
      },
      "metadata": {
          "request_id": "c016c141-ea45-424a-95ec-31d0ebcfbfda"
      }
  }
  ```

---

## Running Tests
Run the complete automated test suite with pytest from inside `backend`:
```bash
pytest -v
```

---

## API Standard Envelopes

### Success Envelope
```json
{
    "success": true,
    "data": {},
    "metadata": {}
}
```

### Error Envelope
```json
{
    "success": false,
    "error": {
        "code": "ERROR_CODE",
        "message": "Human readable message",
        "details": null
    },
    "request_id": "uuid-here"
}
```

---

## Core Principles
1. **Separation of Concerns:** Data, Model, Signal, Risk, Portfolio, and Explanation layers are completely decoupled.
2. **No Fabricated Output:** Probabilistic reasoning and model confidence are strictly distinguished from observed fact.
3. **Observability:** Every request carries an `X-Request-ID` and is correlated across structured logs.

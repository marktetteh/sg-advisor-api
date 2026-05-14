"""
main.py — FastAPI server for SG Data Advisor
Run locally:  uvicorn main:app --reload --port 8000
Deploy:       Railway (see Dockerfile + railway.toml)
"""

import os
from contextlib import asynccontextmanager
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from dotenv import load_dotenv
from agent import run_agent

load_dotenv()


# ── Startup: pre-load catalog so first request is fast ───────────────────────

@asynccontextmanager
async def lifespan(app: FastAPI):
    try:
        from db import load_live_catalog
        catalog = load_live_catalog()
        print(f"[startup] Catalog ready — {len(catalog)} datasets loaded")
    except Exception as e:
        print(f"[startup] WARNING: Could not pre-load catalog: {e}")
    yield


app = FastAPI(title="SG Data Advisor API", version="1.0.0", lifespan=lifespan)

# ── CORS ──────────────────────────────────────────────────────────────────────

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "https://sgdatalytics.org",
        "https://www.sgdatalytics.org",
        "http://localhost:3000",
        "http://localhost:5500",
        "http://127.0.0.1:5500",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ── Request / Response models ─────────────────────────────────────────────────

class Message(BaseModel):
    role: str       # "user" or "assistant"
    content: str

class ChatRequest(BaseModel):
    messages: list[Message]
    api_key: str = ""   # Optional: falls back to GOOGLE_API_KEY env var

class ChatResponse(BaseModel):
    reply: str
    datasets_found: list[dict]
    tool_calls: list[dict]


# ── Endpoints ─────────────────────────────────────────────────────────────────

@app.get("/")
def root():
    return {"status": "SG Data Advisor API is running", "version": "1.0.0"}


@app.get("/health")
def health():
    try:
        from db import load_live_catalog
        catalog = load_live_catalog()
        return {"status": "ok", "datasets_loaded": len(catalog)}
    except Exception:
        return {"status": "ok", "datasets_loaded": 0}


@app.post("/chat", response_model=ChatResponse)
def chat(request: ChatRequest):
    api_key = request.api_key or os.getenv("GOOGLE_API_KEY", "")
    if not api_key:
        raise HTTPException(
            status_code=401,
            detail="No Google API key provided. Set GOOGLE_API_KEY in your environment or pass it in the request.",
        )

    messages = [{"role": m.role, "content": m.content} for m in request.messages]

    try:
        result = run_agent(messages, api_key)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Agent error: {str(e)}")

    return ChatResponse(
        reply=result["reply"],
        datasets_found=result["datasets_found"],
        tool_calls=result["tool_calls"],
    )

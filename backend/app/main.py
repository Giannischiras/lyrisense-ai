from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded
from slowapi.util import get_remote_address

from app.config import get_settings

settings = get_settings()
limiter = Limiter(key_func=get_remote_address, default_limits=[settings.rate_limit])

app = FastAPI(title="Wavelength API", version="0.1.0")
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origin_list,
    allow_methods=["GET", "POST"],
    allow_headers=["Content-Type"],
)


@app.get("/health")
@limiter.exempt
def health(request: Request) -> dict:
    return {
        "status": "ok",
        "llm_provider": settings.llm_provider,
        "llm_configured": bool(
            settings.anthropic_api_key
            if settings.llm_provider == "anthropic"
            else settings.openai_api_key
        ),
    }

"""Unit tests for configuration management."""

from app.core.config import Settings


def test_default_settings() -> None:
    """Verify default settings configuration."""
    cfg = Settings()
    assert cfg.PROJECT_NAME == "GHOST"
    assert cfg.VERSION == "0.1.0"
    assert cfg.API_V1_STR == "/api/v1"
    assert isinstance(cfg.CORS_ORIGINS, list)
    assert len(cfg.CORS_ORIGINS) >= 1


def test_cors_origins_parsing_comma_separated() -> None:
    """Verify CORS parsing from comma-separated string."""
    cfg = Settings(CORS_ORIGINS="http://localhost:3000, https://ghost.io")
    assert cfg.CORS_ORIGINS == ["http://localhost:3000", "https://ghost.io"]


def test_cors_origins_parsing_json() -> None:
    """Verify CORS parsing from JSON list string."""
    cfg = Settings(CORS_ORIGINS='["http://localhost:8080", "http://example.com"]')
    assert cfg.CORS_ORIGINS == ["http://localhost:8080", "http://example.com"]


def test_cors_origins_empty_string() -> None:
    """Verify empty string returns empty list."""
    cfg = Settings(CORS_ORIGINS="")
    assert cfg.CORS_ORIGINS == []

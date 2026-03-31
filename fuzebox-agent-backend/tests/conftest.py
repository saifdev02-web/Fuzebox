"""Shared test fixtures — async DB, mock LLM, test client."""

import asyncio
import uuid
from unittest.mock import AsyncMock, MagicMock, patch

import pytest
import pytest_asyncio
from httpx import ASGITransport, AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

from app.database import Base, get_db
from app.main import app


# ── In-memory SQLite for tests ───────────────────────────────────────────

TEST_DB_URL = "sqlite+aiosqlite:///test.db"

test_engine = create_async_engine(TEST_DB_URL, echo=False)
test_session_factory = async_sessionmaker(
    test_engine, class_=AsyncSession, expire_on_commit=False
)


@pytest_asyncio.fixture
async def db_session():
    """Provide a clean DB session for each test."""
    async with test_engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    async with test_session_factory() as session:
        yield session

    async with test_engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)


@pytest_asyncio.fixture
async def client(db_session):
    """Provide a test HTTP client with DB override."""

    async def _override_get_db():
        yield db_session

    app.dependency_overrides[get_db] = _override_get_db

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        yield ac

    app.dependency_overrides.clear()


# ── Mock LLM response ───────────────────────────────────────────────────

def make_mock_llm_response(content: str, input_tokens: int = 50, output_tokens: int = 30):
    """Create a mock LLM response object."""
    mock = MagicMock()
    mock.content = content
    mock.usage_metadata = {
        "input_tokens": input_tokens,
        "output_tokens": output_tokens,
    }
    return mock


@pytest.fixture
def mock_classify_response():
    return make_mock_llm_response(
        '{"classification": "access_auth", "confidence": 0.92, "reasoning": "Login issue"}'
    )


@pytest.fixture
def mock_triage_response():
    return make_mock_llm_response(
        '{"priority": 4, "rationale": "Urgent login issue", "urgency_signals": ["urgent", "30 minutes"]}'
    )


@pytest.fixture
def mock_draft_response():
    return make_mock_llm_response(
        '{"response": "Thank you for reaching out. We understand the urgency of your login issue. '
        'Our team is looking into this right now and will help you reset your password. '
        'Please check your email for a reset link.", '
        '"sentiment_flag": "negative", "tone_used": "empathetic"}'
    )


@pytest.fixture
def sample_input_text():
    return (
        "I can't log in to my account. I've tried resetting my password three times "
        "and it still says invalid credentials. This is urgent, I need access for a "
        "client meeting in 30 minutes."
    )

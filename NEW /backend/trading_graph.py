"""
TradingGraph: Orchestrates the multi-agent trading system using LangChain and LangGraph.
Patched to support Google Gemini as the LLM provider.
"""
import os
from typing import Dict
from langchain_core.language_models import BaseChatModel

# Optional imports — won't crash if missing
try:
    from langchain_openai import ChatOpenAI
except ImportError:
    ChatOpenAI = None

try:
    from langchain_anthropic import ChatAnthropic
except ImportError:
    ChatAnthropic = None

try:
    from langchain_google_genai import ChatGoogleGenerativeAI
except ImportError:
    ChatGoogleGenerativeAI = None

try:
    from langchain_qwq import ChatQwq
except ImportError:
    ChatQwq = None

from langgraph.prebuilt import ToolNode
from default_config import DEFAULT_CONFIG
from graph_setup import SetGraph
from graph_util import TechnicalTools


class TradingGraph:
    """
    Main orchestrator for the multi-agent trading system.
    Supports OpenAI, Anthropic, Google Gemini, and Qwen providers.
    """

    def __init__(self, config=None):
        self.config = config if config is not None else DEFAULT_CONFIG.copy()

        # Auto-detect provider from available API keys if not set
        if not self.config.get("agent_llm_provider"):
            self.config["agent_llm_provider"] = self._detect_provider()
        if not self.config.get("graph_llm_provider"):
            self.config["graph_llm_provider"] = self._detect_provider()

        self.agent_llm = self._create_llm(
            provider=self.config.get("agent_llm_provider", "google"),
            model=self.config.get("agent_llm_model", "gemini-2.0-flash"),
            temperature=self.config.get("agent_llm_temperature", 0.1),
        )
        self.graph_llm = self._create_llm(
            provider=self.config.get("graph_llm_provider", "google"),
            model=self.config.get("graph_llm_model", "gemini-2.0-flash"),
            temperature=self.config.get("graph_llm_temperature", 0.1),
        )

        self.toolkit = TechnicalTools()

        self.graph_setup = SetGraph(
            self.agent_llm,
            self.graph_llm,
            self.toolkit,
        )
        self.graph = self.graph_setup.set_graph()

    def _detect_provider(self) -> str:
        """Auto-detect which LLM provider to use based on available API keys."""
        if os.environ.get("GOOGLE_API_KEY"):
            return "google"
        elif os.environ.get("ANTHROPIC_API_KEY"):
            return "anthropic"
        elif os.environ.get("OPENAI_API_KEY"):
            return "openai"
        else:
            return "google"  # default, will fail gracefully with clear error

    def _get_api_key(self, provider: str = "google") -> str:
        """Get API key for the specified provider."""
        key_map = {
            "google":    "GOOGLE_API_KEY",
            "openai":    "OPENAI_API_KEY",
            "anthropic": "ANTHROPIC_API_KEY",
            "qwen":      "DASHSCOPE_API_KEY",
        }
        env_var = key_map.get(provider, "GOOGLE_API_KEY")
        api_key = self.config.get("api_key") or os.environ.get(env_var, "")

        if not api_key:
            raise ValueError(
                f"No API key found for provider '{provider}'. "
                f"Set the {env_var} environment variable."
            )
        return api_key

    def _create_llm(self, provider: str, model: str, temperature: float) -> BaseChatModel:
        """Create and return an LLM instance for the given provider."""

        provider = provider.lower()

        # ── Google Gemini (default) ──────────────────────────────────────────
        if provider in ("google", "gemini"):
            if ChatGoogleGenerativeAI is None:
                raise ImportError("Run: pip install langchain-google-genai")
            api_key = self._get_api_key("google")
            return ChatGoogleGenerativeAI(
                model=model if "gemini" in model else "gemini-2.0-flash",
                google_api_key=api_key,
                temperature=temperature,
            )

        # ── OpenAI ───────────────────────────────────────────────────────────
        elif provider == "openai":
            if ChatOpenAI is None:
                raise ImportError("Run: pip install langchain-openai")
            api_key = self._get_api_key("openai")
            return ChatOpenAI(
                model=model,
                api_key=api_key,
                temperature=temperature,
            )

        # ── Anthropic ────────────────────────────────────────────────────────
        elif provider == "anthropic":
            if ChatAnthropic is None:
                raise ImportError("Run: pip install langchain-anthropic")
            api_key = self._get_api_key("anthropic")
            return ChatAnthropic(
                model=model,
                api_key=api_key,
                temperature=temperature,
            )

        # ── Qwen ─────────────────────────────────────────────────────────────
        elif provider == "qwen":
            if ChatQwq is None:
                raise ImportError("langchain_qwq not available")
            api_key = self._get_api_key("qwen")
            return ChatQwq(model=model, api_key=api_key)

        else:
            raise ValueError(f"Unknown provider: '{provider}'. Use google/openai/anthropic/qwen.")
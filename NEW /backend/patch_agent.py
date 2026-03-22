"""
patch_agents.py
Run this ONCE from your backend/ folder:
    python patch_agents.py

It patches all QuantAgent files to use Google Gemini instead of OpenAI.
"""

import os
import re

FILES_TO_PATCH = [
    "indicator_agent.py",
    "pattern_agent.py",
    "trend_agent.py",
    "decision_agent.py",
    "graph_setup.py",
]

REPLACEMENTS = [
    # Replace OpenAI import with Gemini
    (
        r"from langchain_openai import ChatOpenAI",
        "from langchain_google_genai import ChatGoogleGenerativeAI"
    ),
    # Replace ChatOpenAI( with ChatGoogleGenerativeAI(model="gemini-2.0-flash",
    (
        r"ChatOpenAI\(",
        'ChatGoogleGenerativeAI(model="gemini-2.0-flash", '
    ),
    # Remove model= kwarg if it was passed separately (e.g. model="gpt-4o")
    (
        r'model\s*=\s*["\']gpt-[^"\']+["\'],?\s*',
        ""
    ),
    # Remove temperature conflicts (Gemini handles it differently)
    # Keep temperature if present but remove duplicate
]

DEFAULT_CONFIG_REPLACEMENTS = [
    (r'"agent_llm_model"\s*:\s*"[^"]+"', '"agent_llm_model": "gemini-2.0-flash"'),
    (r'"graph_llm_model"\s*:\s*"[^"]+"', '"graph_llm_model": "gemini-2.0-flash"'),
    (r"'agent_llm_model'\s*:\s*'[^']+'", "'agent_llm_model': 'gemini-2.0-flash'"),
    (r"'graph_llm_model'\s*:\s*'[^']+'", "'graph_llm_model': 'gemini-2.0-flash'"),
]

def patch_file(filepath, replacements):
    if not os.path.exists(filepath):
        print(f"  [SKIP] {filepath} not found")
        return

    with open(filepath, "r", encoding="utf-8") as f:
        content = f.read()

    original = content
    for pattern, replacement in replacements:
        content = re.sub(pattern, replacement, content)

    if content != original:
        # Backup original
        with open(filepath + ".bak", "w", encoding="utf-8") as f:
            f.write(original)
        with open(filepath, "w", encoding="utf-8") as f:
            f.write(content)
        print(f"  [PATCHED] {filepath}  (backup saved as {filepath}.bak)")
    else:
        print(f"  [NO CHANGE] {filepath} — may already be patched or uses different syntax")

print("\n=== Patching QuantAgent files to use Google Gemini ===\n")

for fname in FILES_TO_PATCH:
    patch_file(fname, REPLACEMENTS)

print("\n--- Patching default_config.py ---")
patch_file("default_config.py", DEFAULT_CONFIG_REPLACEMENTS)

print("\n=== Done! ===")
print("Now restart: python app.py")
print("Make sure $env:GOOGLE_API_KEY is set in your terminal.\n")
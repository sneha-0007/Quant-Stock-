"""
fix_graph_setup.py - Run once from backend/ folder
Fixes the ChatOpenAI type hints in graph_setup.py
"""
import re

with open("graph_setup.py", "r", encoding="utf-8") as f:
    content = f.read()

# Backup
with open("graph_setup.py.bak2", "w", encoding="utf-8") as f:
    f.write(content)

# Fix 1: Remove ChatOpenAI import if present
content = re.sub(r"from langchain_openai import ChatOpenAI\n", "", content)

# Fix 2: Replace type hints ChatOpenAI -> BaseChatModel
content = content.replace("agent_llm: ChatOpenAI", "agent_llm")
content = content.replace("graph_llm: ChatOpenAI", "graph_llm")

# Fix 3: Add BaseChatModel import if not present
if "BaseChatModel" not in content and "from langchain_core" not in content:
    content = "from langchain_core.language_models import BaseChatModel\n" + content

with open("graph_setup.py", "w", encoding="utf-8") as f:
    f.write(content)

print("[FIXED] graph_setup.py — ChatOpenAI type hints removed")
print("Now run: python app.py")
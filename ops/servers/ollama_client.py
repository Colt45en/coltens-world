# ops/servers/ollama_client.py
from __future__ import annotations

import json
import requests
from typing import Any, Dict, List

OLLAMA_URL = "http://127.0.0.1:11434/api/chat"


class OllamaError(RuntimeError):
    pass


def ollama_chat_json(
    model: str,
    messages: List[Dict[str, str]],
    temperature: float = 0.2,
    timeout_s: int = 120,
) -> Dict[str, Any]:
    """
    Calls Ollama and expects the assistant content to be JSON (string).
    Returns parsed JSON dict.
    """
    payload = {
        "model": model,
        "messages": messages,
        "stream": False,
        # Many Ollama models respect this and will output strict JSON.
        "format": "json",
        "options": {"temperature": temperature},
    }
    try:
        r = requests.post(OLLAMA_URL, json=payload, timeout=timeout_s)
        r.raise_for_status()
        data = r.json()
        content = data.get("message", {}).get("content", "")
        if not content:
            raise OllamaError("Empty Ollama response content")

        # content should be JSON
        try:
            return json.loads(content)
        except json.JSONDecodeError as e:
            raise OllamaError(f"Ollama did not return valid JSON: {e}\nRAW={content[:500]}")
    except requests.RequestException as e:
        raise OllamaError(f"Ollama request failed: {e}")

# server/app/services/ai_client.py
from typing import List, Optional

__all__ = ["chat_with_gemini"]  # not required, but clarifies export

def chat_with_gemini(messages: List[dict], api_key: str, model_name: str) -> str:
    # import inside to avoid import-time errors
    import google.generativeai as genai

    genai.configure(api_key=api_key)

    system_instruction: Optional[str] = None
    rest: list[dict] = []
    for m in messages:
        role = m.get("role", "")
        content = (m.get("content") or "").strip()
        if role == "system" and system_instruction is None:
            if content:
                system_instruction = content
            continue
        if content:
            rest.append({"role": role, "content": content})

    contents = []
    for m in rest:
        r = "user" if m["role"] == "user" else "model"
        contents.append({"role": r, "parts": [{"text": m["content"]}]})

    model = genai.GenerativeModel(model_name, system_instruction=system_instruction)
    resp = model.generate_content(contents)

    if getattr(resp, "text", None):
        return resp.text.strip()
    if getattr(resp, "candidates", None):
        parts = resp.candidates[0].content.parts if resp.candidates else []
        if parts and getattr(parts[0], "text", None):
            return parts[0].text.strip()
    return "sorry, i couldn’t generate a reply."

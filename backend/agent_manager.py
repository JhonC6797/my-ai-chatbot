# agent_manager.py
import os
import json
from openai import OpenAI
from backend.tools import web_search, get_system_date_time

def run_agent_stream(provider: str, local_model_name: str, history_messages: list, user_message: str):
    """מנגנון סוכן ReAct המזרים אותיות ושלבי חשיבה בזמן אמת (Token Stream)"""
    template = """You are the autonomous AI agent of the AgentP platform.
Your job is to assist the user by reasoning step-by-step and using the provided tools when necessary.

CRITICAL MANDATE: Even though this system prompt is in English, you must ALWAYS process the user's input in Hebrew and write your "Final Answer" strictly in fluent, concise, and precise Hebrew, styled cleanly with Markdown.

⚠️ IRON LAW FOR THE YEAR 2026: The current year is 2026.

You have access to the following two tools:
1. duckduckgo_search: A tool to search for up-to-date information on the web. Input: Search keywords.
2. get_system_date_time: An internal tool that retrieves the exact current date and time. No input required (write none).

You must strictly follow the ReAct format below for each step:
Thought: Your thought process regarding the request.
Action: The exact tool name (duckduckgo_search or get_system_date_time).
Action Input: The input argument for the tool.
Observation: The result from the tool.

⚠️ FINAL ANSWER CONSTRAINT: Be concise, direct, sharp, and answer to the point in Hebrew!
Thought: I have found the exact and accurate information needed.
Final Answer: [Your complete, concise response in fluent, natural Hebrew]

Chat history so far:
{chat_history}

Current user message: {input}
"""

    chat_history_str = ""
    for msg in history_messages:
        role_name = "משתמש" if msg["role"] == "user" else "עוזר"
        chat_history_str += f"{role_name}: {msg['content']}\n"
        
    scratchpad = ""
    
    if provider == "openai":
        client = OpenAI()
        model_name = "gpt-4o-mini"
    else:
        client = OpenAI(base_url="http://localhost:11434/v1", api_key="ollama")
        model_name = local_model_name
        
    yield {"type": "status", "text": "הסוכן שוקל את צעדיו ובוחר אסטרטגיה..."}
    
    for turn in range(3):
        full_prompt = template.format(chat_history=chat_history_str, input=user_message) + scratchpad
        
        response = client.chat.completions.create(
            model=model_name,
            messages=[{"role": "user", "content": full_prompt}],
            temperature=0,
            stream=True
        )
        
        turn_output = ""
        has_reached_final = False
        
        for chunk in response:
            delta = chunk.choices[0].delta.content or ""
            if not delta:
                continue
            
            turn_output += delta
            
            if "Final Answer:" in turn_output:
                if not has_reached_final:
                    has_reached_final = True
                    yield {"type": "status", "text": "מנסח תשובה סופית..."}
                    final_part = turn_output.split("Final Answer:")[-1]
                    if final_part:
                        yield {"type": "final_chunk", "text": final_part}
                else:
                    yield {"type": "final_chunk", "text": delta}
            else:
                yield {"type": "thought_chunk", "text": delta}
        
        scratchpad += "\n" + turn_output
        
        if "Final Answer:" in turn_output:
            return
            
        cleaned_output = turn_output.replace("**", "")
        action = None
        action_input = None
        
        for line in cleaned_output.split("\n"):
            if "Action:" in line:
                action = line.split("Action:")[-1].strip()
            if "Action Input:" in line:
                action_input = line.split("Action Input:")[-1].strip().strip('"').strip("'")
        
        if action:
            tool_name_heb = "חיפוש ברשת" if "duckduckgo" in action.lower() else "שעון מערכת"
            yield {"type": "status", "text": f"הסוכן מפעיל כלי: {tool_name_heb}..."}
            
            if "duckduckgo_search" in action.lower() and action_input:
                observation = web_search(action_input)
            elif "get_system_date_time" in action.lower():
                observation = get_system_date_time()
            else:
                observation = "כלי לא מוכר."
            
            observation_log = f"\nObservation: {observation}\n"
            scratchpad += observation_log
            yield {"type": "thought_chunk", "text": observation_log}
            yield {"type": "status", "text": "מנתח את תוצאות הכלי וממשיך לחשוב..."}
        else:
            if "Final Answer:" not in turn_output:
                yield {"type": "final_chunk", "text": turn_output}
                return

def generate_conversation_title(provider: str, local_model_name: str, user_message: str) -> str:
    prompt = f"""Generate a short, concise chat title (max 3-4 words) in Hebrew for: {user_message}"""
    try:
        if provider == "openai":
            client = OpenAI()
            response = client.chat.completions.create(model="gpt-4o-mini", messages=[{"role": "user", "content": prompt}], temperature=0.3, max_tokens=25)
            return response.choices[0].message.content.strip().replace('"', '').replace("'", "")
        else:
            client = OpenAI(base_url="http://localhost:11434/v1", api_key="ollama")
            response = client.chat.completions.create(model=local_model_name, messages=[{"role": "user", "content": prompt}], temperature=0.3, max_tokens=25)
            return response.choices[0].message.content.strip().replace('"', '').replace("'", "")
    except:
        return "שיחה חדשה ומעניינת"
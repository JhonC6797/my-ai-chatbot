# agent_manager.py
import os
import httpx
from openai import OpenAI

# מייבאים את שני הכלים מקובץ הכלים שלך
from tools import web_search, get_system_date_time

def run_agent_search(provider: str, local_model_name: str, history_messages: list, user_message: str) -> str:
    """
    מנגנון סוכן אוטונומי המנהל מערך כלים (Multi-Tool ReAct Engine)
    """
    
    template = """אתה סוכן ה-AI האוטונומי של פלטפורמת AgentPey.
ענה למשתמש תמיד בעברית רהוטה, קצרה, **לעניין** ומעוצבת עם Markdown.

⚠️ חוק ברזל לשנת 2026: השנה הנוכחית היא 2026.

יש לך גישה לשני הכלים הבאים:
1. duckduckgo_search: כלי לחיפוש מידע עדכני ברשת (חדשות, מזג אוויר, פוליטיקה). קלט: מילות חיפוש באנגלית.
2. get_system_date_time: כלי פנימי השולף את התאריך והשעה הנוכחיים של המחשב. אין צורך בקלט עבור כלי זה.

עליך לפעול בדיוק לפי הפורמט הבא בכל שלב:
Thought: המחשבה שלך (למשל: המשתמש שואל מה התאריך, אני אפעיל את כלי השעה המקומי).
Action: שם הכלי המדויק שבו בחרת להשתמש (duckduckgo_search או get_system_date_time)
Action Input: הקלט לכלי (עבור duckduckgo_search רשום מילות מפתח, עבור get_system_date_time רשום none)
Observation: התוצאה מהכלי תופיע כאן.

⚠️ דגש על התשובה הסופית: אל תמציא סיפורים. תהיה ענייני, חד וישר לעניין!
Thought: מצאתי את המידע המדויק.
Final Answer: [התשובה המלאה והקצרה שלך בעברית]

היסטוריית השיחה עד כה:
{chat_history}

ההודעה הנוכחית של המשתמש: {input}
"""

    chat_history_str = ""
    for msg in history_messages:
        role_name = "משתמש" if msg["role"] == "user" else "עוזר"
        chat_history_str += f"{role_name}: {msg['content']}\n"
        
    scratchpad = ""
    
    for turn in range(3):
        full_prompt = template.format(chat_history=chat_history_str, input=user_message) + scratchpad
        
        if provider == "openai":
            client = OpenAI()
            response = client.chat.completions.create(
                model="gpt-4o-mini",
                messages=[{"role": "user", "content": full_prompt}],
                temperature=0
            )
            llm_output = response.choices[0].message.content
        else:
            with httpx.Client(trust_env=False) as http_client:
                res = http_client.post(
                    "http://localhost:11434/v1/chat/completions",
                    json={
                        "model": local_model_name,
                        "messages": [{"role": "user", "content": full_prompt}],
                        "temperature": 0
                    },
                    timeout=90.0
                )
                llm_output = res.json()["choices"][0]["message"]["content"]
        
        print(f"\n🧠 [AgentPey Thought - Turn {turn+1}]:")
        print(llm_output)
        
        scratchpad += "\n" + llm_output
        
        if "Final Answer:" in llm_output:
            return llm_output.split("Final Answer:")[-1].strip()
            
        cleaned_output = llm_output.replace("**", "")
        action = None
        action_input = None
        
        for line in cleaned_output.split("\n"):
            if "Action:" in line:
                action = line.split("Action:")[-1].strip()
            if "Action Input:" in line:
                action_input = line.split("Action Input:")[-1].strip().strip('"').strip("'")
        
        # 🌟 ניתוח והפעלת הכלי הנכון דינמית!
        if action:
            if "duckduckgo_search" in action.lower() and action_input:
                print(f"🔎 [סוכן מפעיל כלי] מריץ חיפוש ברשת עבור: '{action_input}'")
                observation = web_search(action_input)
                scratchpad += f"\nObservation: {observation}"
            elif "get_system_date_time" in action.lower():
                print(f"⏰ [סוכן מפעיל כלי] בודק שעון מערכת פנימי...")
                observation = get_system_date_time()
                scratchpad += f"\nObservation: {observation}"
            else:
                scratchpad += "\nObservation: כלי לא מוכר."
        else:
            if "Final Answer:" not in llm_output:
                return llm_output
                
    return "הסוכן חרג מכמות שלבי המחשבה המותרת מבלי להגיע לתשובה סופית."
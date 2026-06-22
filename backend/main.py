import os
import uuid
import httpx  
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List, Optional
from openai import OpenAI  
from dotenv import load_dotenv

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
load_dotenv(os.path.join(BASE_DIR, ".env"))

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

openai_client = None
if os.getenv("OPENAI_API_KEY"):
    try:
        openai_client = OpenAI()
    except Exception as e:
        print(f"Error initializing OpenAI Client: {e}")

LOCAL_MODEL_NAME = "gemma4:latest"

# --------------------------------------------------------
# מבנה הנתונים הזמני בזיכרון השרת (In-Memory DB)
# המבנה יהיה: { "conversation_id": { "title": "שם השיחה", "messages": [...] } }
# --------------------------------------------------------
conversations_db = {}

class ChatMessageInput(BaseModel):
    message: str
    provider: str = "openai"

class UpdateTitleInput(BaseModel):
    title: str

# 1. שליפת כל השיחות הקיימות (עבור הסיידבר)
@app.get("/api/conversations")
def get_conversations():
    return [
        {"id": conv_id, "title": data["title"]}
        for conv_id, data in conversations_db.items()
    ]

# 2. יצירת שיחה חדשה ריקה
@app.post("/api/conversations")
def create_conversation():
    conv_id = str(uuid.uuid4()) # מייצר מזהה ייחודי ארוך כמו: "f81d4fae..."
    conversations_db[conv_id] = {
        "title": "שיחה חדשה",
        "messages": []
    }
    return {"id": conv_id, "title": "שיחה חדשה"}

# 3. שליפת ההודעות של שיחה ספציפית (כשלוחצים עליה בסיידבר)
@app.get("/api/conversations/{conv_id}/messages")
def get_messages(conv_id: str):
    if conv_id not in conversations_db:
        raise HTTPException(status_code=404, detail="השיחה לא קיימת")
    return conversations_db[conv_id]["messages"]

# 4. מחיקת שיחה
@app.delete("/api/conversations/{conv_id}")
def delete_conversation(conv_id: str):
    if conv_id in conversations_db:
        del conversations_db[conv_id]
        return {"status": "success"}
    raise HTTPException(status_code=404, detail="השיחה לא קיימת")

# 5. עדכון שם השיחה
@app.put("/api/conversations/{conv_id}/title")
def update_title(conv_id: str, input_data: UpdateTitleInput):
    if conv_id not in conversations_db:
        raise HTTPException(status_code=404, detail="השיחה לא קיימת")
    conversations_db[conv_id]["title"] = input_data.title
    return {"status": "success", "title": input_data.title}

# 6. שליחת הודעה לצ'אט בתוך שיחה ספציפית
@app.post("/api/conversations/{conv_id}/chat")
async def chat_endpoint(conv_id: str, request: ChatMessageInput):
    if conv_id not in conversations_db:
        raise HTTPException(status_code=404, detail="השיחה לא קיימת")
    
    # שליפת ההיסטוריה הנוכחית של השיחה הזו
    history = conversations_db[conv_id]["messages"]
    
    # הוספת הודעת המשתמש החדשה להיסטוריה בשרת
    history.append({"role": "user", "content": request.message})
    
    # אם זו ההודעה הראשונה בשיחה, נשנה אוטומטית את שם השיחה לפי המשפט של המשתמש
    if len(history) == 1:
        # לוקח את 5 המילים הראשונות של המשתמש כשם זמני
        conversations_db[conv_id]["title"] = " ".join(request.message.split()[:5]) + "..."

    # פנייה למודלים (Local או OpenAI) עם ההיסטוריה המלאה
    ai_text = ""
    try:
        if request.provider == "local":
            with httpx.Client(trust_env=False) as http_client:
                response = http_client.post(
                    "http://localhost:11434/v1/chat/completions",
                    json={"model": LOCAL_MODEL_NAME, "messages": history},
                    timeout=90.0
                )
                if response.status_code != 200:
                    raise Exception(f"Ollama error: {response.text}")
                ai_text = response.json()["choices"][0]["message"]["content"]
                
        elif request.provider == "openai":
            global openai_client
            if not openai_client and os.getenv("OPENAI_API_KEY"):
                openai_client = OpenAI()
            if not openai_client:
                raise HTTPException(status_code=500, detail="OpenAI API Key missing.")
            
            response = openai_client.chat.completions.create(
                model="gpt-4o-mini",
                messages=history
            )
            ai_text = response.choices[0].message.content
        else:
            raise HTTPException(status_code=400, detail="סוג מנוע לא נתמך")
        
        # שמירת תשובת ה-AI בהיסטוריה של השיחה בשרת
        history.append({"role": "assistant", "content": ai_text})
        
        # מחזירים לפרונט את התשובה ואת השם המעודכן של השיחה
        return {
            "response": ai_text,
            "conversation_title": conversations_db[conv_id]["title"]
        }
        
    except Exception as e:
        # אם נכשלה הפנייה ל-AI, נסיר את הודעת המשתמש האחרונה כדי שלא תתקע את ההיסטוריה
        history.pop()
        raise HTTPException(status_code=500, detail=str(e))
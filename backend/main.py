# main.py
import os
import uuid
import httpx  
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List, Optional
from openai import OpenAI  
from dotenv import load_dotenv

# הייבוא שמחבר אותנו ללוגיקה של הסוכן הנייטיב החדש
from backend.agent_manager import run_agent_search

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

# מבנה נתונים ריק לצורך תאימות עם הפרונטאנד
conversations_db = {}

class ChatMessageInput(BaseModel):
    message: str
    provider: str = "openai"

class UpdateTitleInput(BaseModel):
    title: str

# 1. שליפת כל השיחות הקיימות
@app.get("/api/conversations")
def get_conversations():
    return [
        {"id": conv_id, "title": data["title"]}
        for conv_id, data in conversations_db.items()
    ]

# 2. יצירת שיחה חדשה
@app.post("/api/conversations")
def create_conversation():
    conv_id = str(uuid.uuid4())
    conversations_db[conv_id] = {
        "title": "שיחה חדשה",
        "messages": []
    }
    return {"id": conv_id, "title": "שיחה חדשה"}

# 3. שליפת הודעות
@app.get("/api/conversations/{conv_id}/messages")
def get_messages(conv_id: str):
    if conv_id not in conversations_db:
        return []
    return conversations_db[conv_id]["messages"]

# 4. מחיקת שיחה
@app.delete("/api/conversations/{conv_id}")
def delete_conversation(conv_id: str):
    if conv_id in conversations_db:
        del conversations_db[conv_id]
        return {"status": "success"}
    return {"status": "success"}

# 5. עדכון שם השיחה
@app.put("/api/conversations/{conv_id}/title")
def update_title(conv_id: str, input_data: UpdateTitleInput):
    return {"status": "success", "title": input_data.title}

# 6. שליחת הודעה לצ'אט - גרסה נקייה ללא זיכרון (Stateless Test)
@app.post("/api/conversations/{conv_id}/chat")
async def chat_endpoint(conv_id: str, request: ChatMessageInput):
    user_message = request.message

    try:
        # שולחים רשימה ריקה [] כהיסטוריה כדי לנטרל בעיות סנכרון זיכרון
        ai_text = run_agent_search(
            provider=request.provider,
            local_model_name=LOCAL_MODEL_NAME,
            history_messages=[], 
            user_message=user_message
        )
        
        return {
            "response": ai_text,
            "conversation_title": "בדיקת סוכן חם"
        }
        
    except Exception as e:
        print(f"Agent Execution Error: {e}")
        raise HTTPException(status_code=500, detail=f"הסוכן נתקל בשגיאה: {str(e)}")
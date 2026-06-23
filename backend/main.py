# main.py
import os
import uuid
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List, Optional
from dotenv import load_dotenv

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

LOCAL_MODEL_NAME = "gemma4:latest"

# מסד הנתונים הזמני בזיכרון השרת
conversations_db = {}

class ChatMessageInput(BaseModel):
    message: str
    provider: str = "openai"

class UpdateTitleInput(BaseModel):
    title: str

@app.get("/api/conversations")
def get_conversations():
    return [
        {"id": conv_id, "title": data["title"]}
        for conv_id, data in conversations_db.items()
    ]

@app.post("/api/conversations")
def create_conversation():
    conv_id = str(uuid.uuid4())
    conversations_db[conv_id] = {
        "title": "שיחה חדשה",
        "messages": []
    }
    return {"id": conv_id, "title": "שיחה חדשה"}

@app.get("/api/conversations/{conv_id}/messages")
def get_messages(conv_id: str):
    if conv_id not in conversations_db:
        raise HTTPException(status_code=404, detail="השיחה לא נמצאה")
    return conversations_db[conv_id]["messages"]

@app.delete("/api/conversations/{conv_id}")
def delete_conversation(conv_id: str):
    if conv_id in conversations_db:
        del conversations_db[conv_id]
    return {"status": "success"}

@app.put("/api/conversations/{conv_id}/title")
def update_title(conv_id: str, input_data: UpdateTitleInput):
    if conv_id not in conversations_db:
        raise HTTPException(status_code=404, detail="השיחה לא נמצאה")
    
    conversations_db[conv_id]["title"] = input_data.title
    return {"status": "success", "title": input_data.title}

@app.post("/api/conversations/{conv_id}/chat")
async def chat_endpoint(conv_id: str, request: ChatMessageInput):
    if conv_id not in conversations_db:
        raise HTTPException(status_code=404, detail="השיחה לא נמצאה")
        
    user_message = request.message

    # שמירת הודעת המשתמש בהיסטוריה
    conversations_db[conv_id]["messages"].append({"role": "user", "content": user_message})

    try:
        # שליפת ההיסטוריה הקודמת (ללא ההודעה הנוכחית שכבר נשלחת בנפרד)
        history = conversations_db[conv_id]["messages"][:-1]
        
        # הרצת הסוכן עם הזיכרון המלא
        ai_text = run_agent_search(
            provider=request.provider,
            local_model_name=LOCAL_MODEL_NAME,
            history_messages=history, 
            user_message=user_message
        )
        
        # שמירת תגובת הסוכן בהיסטוריה
        conversations_db[conv_id]["messages"].append({"role": "assistant", "content": ai_text})
        
        return {
            "response": ai_text,
            "conversation_title": conversations_db[conv_id]["title"]
        }
        
    except Exception as e:
        print(f"Agent Execution Error: {e}")
        # הסרת הודעת המשתמש האחרונה במקרה של כישלון כדי למנוע חוסר סנכרון
        if conversations_db[conv_id]["messages"]:
            conversations_db[conv_id]["messages"].pop()
        raise HTTPException(status_code=500, detail=f"הסוכן נתקל בשגיאה: {str(e)}")
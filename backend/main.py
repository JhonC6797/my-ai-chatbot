# main.py
import os
import uuid
import time
import json
from fastapi import FastAPI, HTTPException, UploadFile, File, Form
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse 
from pydantic import BaseModel
from dotenv import load_dotenv
from typing import List, Optional

from backend.agent_manager import run_agent_stream, generate_conversation_title

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
conversations_db = {}

class UpdateTitleInput(BaseModel):
    title: str

@app.get("/api/conversations")
def get_conversations():
    sorted_conversations = sorted(conversations_db.items(), key=lambda x: x[1].get("updated_at", 0), reverse=False)
    return [{"id": conv_id, "title": data["title"]} for conv_id, data in sorted_conversations]

@app.post("/api/conversations")
def create_conversation():
    conv_id = str(uuid.uuid4())
    conversations_db[conv_id] = {"title": "שיחה חדשה", "messages": [], "updated_at": time.time()}
    return {"id": conv_id, "title": "שיחה חדשה"}

@app.get("/api/conversations/{conv_id}/messages")
def get_messages(conv_id: str):
    if conv_id not in conversations_db:
        return []
    return conversations_db[conv_id]["messages"]

@app.delete("/api/conversations/{conv_id}")
def delete_conversation(conv_id: str):
    if conv_id in conversations_db: del conversations_db[conv_id]
    return {"status": "success"}

@app.put("/api/conversations/{conv_id}/title")
def update_title(conv_id: str, input_data: UpdateTitleInput):
    if conv_id not in conversations_db: raise HTTPException(status_code=404)
    conversations_db[conv_id]["title"] = input_data.title
    conversations_db[conv_id]["updated_at"] = time.time()
    return {"status": "success"}

@app.post("/api/conversations/{conv_id}/chat")
async def chat_endpoint(
    conv_id: str, 
    message: str = Form(...), 
    provider: str = Form("openai"),
    files: Optional[List[UploadFile]] = File(None)
):
    if conv_id not in conversations_db: raise HTTPException(status_code=404)
    
    # מנגנון RAG: חילוץ קונטקסט מקבצים מצורפים
    file_contexts = []
    if files:
        from backend.tools import extract_text_from_file
        for file in files:
            content = await file.read()
            text = extract_text_from_file(content, file.filename)
            if text:
                file_contexts.append(f"קובץ: {file.filename}\nתוכן:\n{text}")

    full_message = message
    if file_contexts:
        context_str = "\n\n".join(file_contexts)
        full_message = f"המשתמש צירף קבצים רלוונטיים. השתמש בתוכן שלהם לענות על השאלה במידת הצורך:\n{context_str}\n\nשאלה: {message}"

    # שומרים בשרת רק את הודעת המקור של המשתמש לתצוגה נקייה
    conversations_db[conv_id]["messages"].append({"role": "user", "content": message})
    history = conversations_db[conv_id]["messages"][:-1]

    async def event_generator():
        final_text = ""
        thought_logs = []
        
        for event in run_agent_stream(provider, LOCAL_MODEL_NAME, history, full_message):
            if event["type"] == "thought_chunk":
                thought_logs.append(event["text"])
            elif event["type"] == "final_chunk":
                final_text += event["text"]
            
            yield f"data: {json.dumps(event, ensure_ascii=False)}\n\n"
            
        conversations_db[conv_id]["messages"].append({
            "role": "assistant",
            "content": final_text,
            "thoughts": "".join(thought_logs)
        })
        
        if conversations_db[conv_id]["title"] == "שיחה חדשה":
            conversations_db[conv_id]["title"] = generate_conversation_title(provider, LOCAL_MODEL_NAME, message)
        conversations_db[conv_id]["updated_at"] = time.time()

    return StreamingResponse(event_generator(), media_type="text/event-stream")
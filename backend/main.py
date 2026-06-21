import os
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List
from openai import OpenAI  # <--- ייבוא של OpenAI
from dotenv import load_dotenv

load_dotenv()

# שורת בדיקה זמנית בטרמינל
print("--- בדיקת מפתח API של OpenAI ---")
print("OPENAI_API_KEY נמצא?", "כן!" if os.getenv("OPENAI_API_KEY") else "לא, הקובץ לא נטען או שהמפתח ריק")
print("--------------------------------")

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# אתחול הלקוח של OpenAI (מושך אוטומטית את OPENAI_API_KEY)
try:
    client = OpenAI()
except Exception as e:
    print(f"Error initializing OpenAI Client: {e}")
    client = None

class Message(BaseModel):
    role: str     
    content: str  

class ChatRequest(BaseModel):
    history: List[Message]

@app.post("/api/chat")  # <--- ודא שכתוב כאן post באותיות קטנות, ולא get!
async def chat_endpoint(request: ChatRequest):
    if not client:
        raise HTTPException(status_code=500, detail="OpenAI API Key missing or invalid.")
    
    try:
        # המרה קלה של אובייקטי ה-Pydantic ל-Dictionaries ש-OpenAI מצפה לקבל
        openai_messages = [msg.model_dump() for msg in request.history]

        # שליחת ההיסטוריה ל-GPT
        response = client.chat.completions.create(
            model="gpt-4o-mini",  # המודל המהיר והזול שלהם
            messages=openai_messages
        )
        
        # שליפת הטקסט מתוך מבנה התשובה של OpenAI
        ai_text = response.choices[0].message.content
        
        return {"response": ai_text}
        
    except Exception as e:
        print(f"שגיאה במהלך פנייה ל-OpenAI: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/")
def health_check():
    return {"status": "The server is running OpenAI successfully!"}
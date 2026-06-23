# tools.py
from datetime import datetime
from duckduckgo_search import DDGS
import fitz  # PyMuPDF
from docx import Document
import io

def web_search(query: str) -> str:
    """מחפש באינטרנט באמצעות DDGS"""
    try:
        with DDGS() as ddgs:
            search_results = ddgs.text(query, max_results=3)
            if not search_results:
                return "לא נמצאו תוצאות רלוונטיות באינטרנט."
            return "\n".join([r['body'] for r in search_results])
    except Exception as e:
        return f"שגיאה בהפעלת כלי החיפוש (ייתכן חסימת עומס): {str(e)}"

def get_system_date_time() -> str:
    """מחזיר את התאריך והשעה הנוכחיים ממערכת ההפעלה"""
    now = datetime.now()
    return now.strftime("התאריך היום הוא: %Y-%m-%d, השעה הנוכחית היא: %H:%M")

def extract_text_from_file(file_content: bytes, filename: str) -> str:
    """מחלץ טקסט מלא מקובץ PDF או Word (docx) עבור מנגנון ה-RAG"""
    try:
        if filename.lower().endswith('.pdf'):
            doc = fitz.open(stream=file_content, filetype="pdf")
            text = ""
            for page in doc:
                text += page.get_text()
            return text.strip()
        elif filename.lower().endswith(('.docx', '.doc')):
            doc = Document(io.BytesIO(file_content))
            return "\n".join([para.text for para in doc.paragraphs]).strip()
        return ""
    except Exception as e:
        return f"שגיאה בחילוץ הטקסט מהקובץ {filename}: {str(e)}"
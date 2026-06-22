# tools.py
from datetime import datetime
from ddgs import DDGS

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

# 🌟 הכלי החדש והמהיר שלך!
def get_system_date_time() -> str:
    """
    מחזיר את התאריך והשעה הנוכחיים ישירות ממערכת ההפעלה של המחשב.
    """
    now = datetime.now()
    return now.strftime("התאריך היום הוא: %Y-%m-%d, השעה הנוכחית היא: %H:%M")
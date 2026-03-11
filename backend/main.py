import io
import docx
import os
import google.generativeai as genai
from dotenv import load_dotenv
from PyPDF2 import PdfReader
from fastapi import FastAPI, UploadFile, File, Form, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from typing import Dict, Any

# Load Environment Variables (.env file)
load_dotenv()
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")

if not GEMINI_API_KEY:
    raise RuntimeError("GEMINI_API_KEY is missing. Please set it in the .env file.")

# Configure Google Gemini
genai.configure(api_key=GEMINI_API_KEY)
# Using Gemini 2.5 Flash for fast text processing
model = genai.GenerativeModel('gemini-2.5-flash')

app = FastAPI(title="AI Resume Review API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"], 
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

def extract_text_from_pdf(file_contents: bytes) -> str:
    try:
        pdf_reader = PdfReader(io.BytesIO(file_contents))
        text = "".join(page.extract_text() + "\n" for page in pdf_reader.pages)
        return text.strip()
    except Exception as e:
        raise ValueError(f"Failed to parse PDF: {str(e)}")

def extract_text_from_docx(file_contents: bytes) -> str:
    try:
        doc = docx.Document(io.BytesIO(file_contents))
        text = "\n".join([paragraph.text for paragraph in doc.paragraphs])
        return text.strip()
    except Exception as e:
        raise ValueError(f"Failed to parse DOCX: {str(e)}")

def review_resume_with_ai(resume_text: str, target_role: str, user_notes: str) -> str:
    """Sends the resume to Gemini for review and rewriting."""
    prompt = f"""
    You are an elite Silicon Valley Technical Recruiter and Resume Writer. 
    Review the following resume. The candidate is targeting a '{target_role}' role.
    Additional notes from candidate: {user_notes}

    Please provide a structured response with:
    1. A brief "Overall Impression" (2 sentences max).
    2. "Top 3 Areas to Improve".
    3. "Rewritten Bullet Points": Take the 3 weakest bullet points from their experience and rewrite them to be highly impactful using the STAR method (Situation, Task, Action, Result) with strong action verbs.
    
    Resume Text:
    {resume_text}
    """
    
    try:
        response = model.generate_content(prompt)
        return response.text
    except Exception as e:
        raise RuntimeError(f"AI Generation Failed: {str(e)}")

@app.post("/api/review")
async def review_resume(
    file: UploadFile = File(...),
    target_role: str = Form("General SWE"),
    notes: str = Form("Make it sound professional.")
) -> Dict[str, Any]:
    
    if not file.filename:
        raise HTTPException(status_code=400, detail="No file provided")
    
    file_type = file.filename.split('.')[-1].lower()
    if file_type not in ["pdf", "docx"]:
        raise HTTPException(status_code=400, detail="Only PDF and DOCX files are supported")
    
    contents = await file.read()
    
    # 1. Extract Text
    try:
        if file_type == "pdf":
            extracted_text = extract_text_from_pdf(contents)
        else:
            extracted_text = extract_text_from_docx(contents)
    except Exception as e:
         raise HTTPException(status_code=500, detail=f"Extraction Error: {str(e)}")
         
    if not extracted_text:
        raise HTTPException(status_code=400, detail="Could not extract text.")

    # 2. Ask AI to Review
    try:
        ai_feedback = review_resume_with_ai(extracted_text, target_role, notes)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

    return {
        "status": "success",
        "target_role": target_role,
        "ai_feedback": ai_feedback,
        "extracted_text": extracted_text
    }

@app.get("/")
def health_check():
    return {"status": "Backend + AI is active!"}

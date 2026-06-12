from fastapi import FastAPI
from dotenv import load_dotenv
from routers import face, phone, pose, audio
import uvicorn
import os

load_dotenv()

app = FastAPI(title="3rdEyeZ360 Detection API", version="1.0.0")

app.include_router(face.router)
app.include_router(phone.router)
app.include_router(pose.router)
app.include_router(audio.router)

@app.get("/health")
async def health():
    return {"status": "ok", "service": "3rdEyeZ360 Detection API"}

if __name__ == "__main__":
    uvicorn.run("main:app", host="127.0.0.1", port=int(os.getenv("PORT", 5001)), reload=False)
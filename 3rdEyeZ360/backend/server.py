from dotenv import load_dotenv

# Messaging configuration is read while messaging modules are imported.
# Load backend/.env before importing those modules.
load_dotenv(override=False)

import os

import socketio
import uvicorn
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from config.database import close_db, connect_db, get_db
from config.minio_client import get_minio
from messaging import start_messaging, stop_messaging
from routes.admin_routes import router as admin_router
from routes.assessment_routes import router as assessment_router
from routes.auth_routes import router as auth_router
from routes.chat_routes import router as chat_router
from routes.exam_routes import router as exam_router
from routes.notification_routes import router as notification_router
from routes.request_routes import router as request_router
from routes.user_routes import router as user_router
from routes.violation_routes import router as violation_router
from sockets.monitoring_socket import sio


app = FastAPI(
    title="3rdEyeZ360 Backend",
    version="1.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth_router)
app.include_router(user_router)
app.include_router(exam_router)
app.include_router(assessment_router)
app.include_router(chat_router)
app.include_router(request_router)
app.include_router(notification_router)
app.include_router(violation_router)
app.include_router(admin_router)

socket_app = socketio.ASGIApp(
    sio,
    other_asgi_app=app,
)


@app.on_event("startup")
async def startup():
    await connect_db()

    try:
        get_minio()

        print(
            "[Messaging] Process Kafka environment:",
            os.getenv("KAFKA_BOOTSTRAP_SERVERS"),
        )

        await start_messaging(
            db=get_db(),
            sio=sio,
        )

    except Exception:
        await stop_messaging()
        await close_db()
        raise

    print("3rdEyeZ360 Backend started")


@app.on_event("shutdown")
async def shutdown():
    await stop_messaging()
    await close_db()
    print("3rdEyeZ360 Backend stopped")


@app.get("/health")
async def health():
    return {
        "status": "ok",
        "service": "3rdEyeZ360 Backend",
    }


if __name__ == "__main__":
    uvicorn.run(
        "server:socket_app",
        host="0.0.0.0",
        port=int(os.getenv("PORT", 3000)),
        reload=False,
    )

from config.minio_client import get_minio
from dotenv import load_dotenv
import os, io, base64, uuid
from datetime import datetime

load_dotenv()
BUCKET = os.getenv("MINIO_BUCKET")

def upload_screenshot(exam_id: str, candidate_id: str, violation_type: str, image_b64: str) -> str:
    minio = get_minio()
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    filename = f"{violation_type}_{timestamp}.jpg"
    path = f"{exam_id}/{candidate_id}/screenshots/{filename}"
    image_bytes = base64.b64decode(image_b64)
    minio.put_object(BUCKET, path, io.BytesIO(image_bytes), len(image_bytes), content_type="image/jpeg")
    return path

def upload_clip(exam_id: str, candidate_id: str, violation_type: str, video_bytes: bytes) -> str:
    minio = get_minio()
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    filename = f"{violation_type}_{timestamp}.mp4"
    path = f"{exam_id}/{candidate_id}/clips/{filename}"
    minio.put_object(BUCKET, path, io.BytesIO(video_bytes), len(video_bytes), content_type="video/mp4")
    return path

def get_presigned_url(path: str, expires_seconds: int = 3600) -> str:
    from datetime import timedelta
    minio = get_minio()
    url = minio.presigned_get_object(BUCKET, path, expires=timedelta(seconds=expires_seconds))
    return url
from minio import Minio
from dotenv import load_dotenv
import os

load_dotenv(override=True)

_minio_client = None


def getminio():
    global _minio_client

    if _minio_client is None:
        secure = str(os.getenv("MINIO_SECURE", "false")).lower() == "true"

        _minio_client = Minio(
            os.getenv("MINIO_ENDPOINT", "127.0.0.1:9000"),
            access_key=os.getenv("MINIO_ACCESS_KEY", "minioadmin"),
            secret_key=os.getenv("MINIO_SECRET_KEY", "minioadmin"),
            secure=secure
        )

        bucket = os.getenv("MINIO_BUCKET", "3rdeyez360")
        if not _minio_client.bucket_exists(bucket):
            _minio_client.make_bucket(bucket)

        print("MinIO connected")

    return _minio_client


def get_minio():
    return getminio()
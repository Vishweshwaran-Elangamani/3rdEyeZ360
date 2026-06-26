from minio import Minio
from dotenv import load_dotenv
import os

load_dotenv(override=True)

_minio_client = None


def get_minio():
    global _minio_client

    if _minio_client is None:
        secure = str(os.getenv("MINIO_SECURE", "False")).strip().lower() == "true"
        endpoint = os.getenv("MINIO_ENDPOINT", "localhost:9000")
        access_key = os.getenv("MINIO_ACCESS_KEY", "samp_minio")
        secret_key = os.getenv("MINIO_SECRET_KEY", "samp_minio_pass123")
        bucket = os.getenv("MINIO_BUCKET", "assessment-evidence")

        _minio_client = Minio(
            endpoint,
            access_key=access_key,
            secret_key=secret_key,
            secure=secure,
        )

        if not _minio_client.bucket_exists(bucket):
            _minio_client.make_bucket(bucket)

        print(f"MinIO connected - bucket: {bucket}")

    return _minio_client


def getminio():
    return get_minio()
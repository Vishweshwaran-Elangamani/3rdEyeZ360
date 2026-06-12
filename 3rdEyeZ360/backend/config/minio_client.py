from minio import Minio
from dotenv import load_dotenv
import os

load_dotenv()

minio_client: Minio = None

def get_minio():
    global minio_client
    if minio_client is None:
        minio_client = Minio(
            os.getenv("MINIO_ENDPOINT"),
            access_key=os.getenv("MINIO_ACCESS_KEY"),
            secret_key=os.getenv("MINIO_SECRET_KEY"),
            secure=os.getenv("MINIO_SECURE", "False") == "True"
        )
        bucket = os.getenv("MINIO_BUCKET")
        if not minio_client.bucket_exists(bucket):
            minio_client.make_bucket(bucket)
        print("✅ MinIO connected")
    return minio_client
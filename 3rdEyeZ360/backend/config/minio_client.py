import os
import time
from threading import Lock

from dotenv import load_dotenv
from minio import Minio
from minio.error import S3Error

load_dotenv(override=False)

_minio_client: Minio | None = None
_minio_lock = Lock()


def _get_boolean_env(
    name: str,
    default: bool = False,
) -> bool:
    value = str(
        os.getenv(name, str(default))
    ).strip().lower()

    return value in {
        "1",
        "true",
        "yes",
        "y",
        "on",
    }


def get_minio_bucket() -> str:
    bucket = str(
        os.getenv(
            "MINIO_BUCKET",
            "assessment-evidence",
        )
    ).strip()

    if not bucket:
        raise RuntimeError(
            "MINIO_BUCKET cannot be empty"
        )

    return bucket


def _create_minio_client() -> Minio:
    endpoint = str(
        os.getenv(
            "MINIO_ENDPOINT",
            "localhost:9000",
        )
    ).strip()

    access_key = str(
        os.getenv(
            "MINIO_ACCESS_KEY",
            "samp_minio",
        )
    ).strip()

    secret_key = str(
        os.getenv(
            "MINIO_SECRET_KEY",
            "samp_minio_pass123",
        )
    ).strip()

    secure = _get_boolean_env(
        "MINIO_SECURE",
        False,
    )

    if not endpoint:
        raise RuntimeError(
            "MINIO_ENDPOINT cannot be empty"
        )

    if not access_key:
        raise RuntimeError(
            "MINIO_ACCESS_KEY cannot be empty"
        )

    if not secret_key:
        raise RuntimeError(
            "MINIO_SECRET_KEY cannot be empty"
        )

    return Minio(
        endpoint,
        access_key=access_key,
        secret_key=secret_key,
        secure=secure,
    )


def ensure_minio_ready(
    retries: int = 20,
    delay_seconds: float = 1.5,
) -> Minio:
    """
    Connect to MinIO and ensure the configured bucket exists.

    Docker minio-init normally creates the bucket. This method also
    creates the bucket as a backend fallback if it is missing.
    """

    global _minio_client

    with _minio_lock:
        if _minio_client is None:
            _minio_client = _create_minio_client()

        bucket = get_minio_bucket()
        last_error: Exception | None = None

        for attempt in range(
            1,
            retries + 1,
        ):
            try:
                bucket_exists = (
                    _minio_client.bucket_exists(
                        bucket
                    )
                )

                if not bucket_exists:
                    _minio_client.make_bucket(
                        bucket
                    )

                    print(
                        "MinIO bucket created - "
                        f"bucket: {bucket}"
                    )
                else:
                    print(
                        "MinIO connected - "
                        f"bucket: {bucket}"
                    )

                return _minio_client

            except (
                S3Error,
                OSError,
                RuntimeError,
            ) as error:
                last_error = error

                if attempt >= retries:
                    break

                print(
                    "[MinIO] Connection attempt "
                    f"{attempt}/{retries} failed: "
                    f"{error}. Retrying in "
                    f"{delay_seconds}s..."
                )

                time.sleep(
                    delay_seconds
                )

        _minio_client = None

        raise RuntimeError(
            "MinIO initialization failed after "
            f"{retries} attempts: "
            f"{last_error}"
        ) from last_error


def get_minio() -> Minio:
    return ensure_minio_ready()


def getminio() -> Minio:
    """
    Backward-compatible alias for existing imports.
    """

    return get_minio()
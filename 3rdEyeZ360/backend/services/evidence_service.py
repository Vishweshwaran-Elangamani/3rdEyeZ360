import base64
import binascii
import io
import mimetypes
import re
import uuid
from datetime import datetime, timedelta, timezone

from dotenv import load_dotenv
from minio.error import S3Error

from config.minio_client import get_minio, get_minio_bucket

load_dotenv(override=False)

DEFAULT_URL_EXPIRY_SECONDS = 3600
MAX_SCREENSHOT_BYTES = 10 * 1024 * 1024
MAX_CLIP_BYTES = 100 * 1024 * 1024


def _safe_path_part(value: object, fallback: str) -> str:
    cleaned = re.sub(
        r"[^A-Za-z0-9._-]+",
        "-",
        str(value or "").strip(),
    )
    cleaned = cleaned.strip(".-_")
    return cleaned or fallback


def _decode_base64(value: str) -> bytes:
    if not value or not isinstance(value, str):
        raise ValueError("Base64 evidence content is required")

    encoded = value.strip()

    if "," in encoded and encoded.lower().startswith("data:"):
        encoded = encoded.split(",", 1)[1]

    encoded = "".join(encoded.split())

    if not encoded:
        raise ValueError("Base64 evidence content is empty")

    missing_padding = len(encoded) % 4
    if missing_padding:
        encoded += "=" * (4 - missing_padding)

    try:
        return base64.b64decode(encoded, validate=True)
    except (binascii.Error, ValueError) as error:
        raise ValueError("Evidence content is not valid base64") from error


def _validate_size(
    content: bytes,
    maximum: int,
    evidence_type: str,
) -> None:
    if not content:
        raise ValueError(f"{evidence_type} content is empty")

    if len(content) > maximum:
        raise ValueError(
            f"{evidence_type} exceeds the maximum size of "
            f"{maximum} bytes"
        )


def _timestamp_token() -> str:
    return datetime.now(timezone.utc).strftime(
        "%Y%m%dT%H%M%S_%fZ"
    )


def _normalise_object_path(path: str) -> str:
    object_name = str(path or "").strip().lstrip("/")

    if not object_name:
        raise ValueError("Evidence object path is required")

    return object_name


def _raise_minio_error(
    error: S3Error,
    operation: str,
) -> None:
    if error.code in {
        "NoSuchKey",
        "NoSuchObject",
        "NoSuchBucket",
    }:
        raise FileNotFoundError(
            "Evidence object was not found"
        ) from error

    raise RuntimeError(
        f"MinIO {operation} failed: {error.code}"
    ) from error


def upload_screenshot(
    exam_id: str,
    candidate_id: str,
    violation_type: str,
    image_b64: str,
    assessment_id: str | None = None,
    violation_id: str | None = None,
) -> str:
    """
    Upload one confirmed-violation JPEG frame.

    Returns the MinIO object path.
    """

    image_bytes = _decode_base64(image_b64)

    _validate_size(
        image_bytes,
        MAX_SCREENSHOT_BYTES,
        "Screenshot",
    )

    safe_exam = _safe_path_part(
        exam_id,
        "unknown-exam",
    )
    safe_candidate = _safe_path_part(
        candidate_id,
        "unknown-candidate",
    )
    safe_assessment = _safe_path_part(
        assessment_id,
        "assessment",
    )
    safe_violation_type = _safe_path_part(
        violation_type,
        "violation",
    )
    safe_violation_id = _safe_path_part(
        violation_id
        or f"VIO-{uuid.uuid4().hex[:12].upper()}",
        "violation",
    )

    filename = (
        f"{safe_violation_type}_"
        f"{_timestamp_token()}_"
        f"{safe_violation_id}.jpg"
    )

    object_name = (
        f"{safe_exam}/"
        f"{safe_candidate}/"
        f"{safe_assessment}/"
        f"screenshots/"
        f"{filename}"
    )

    client = get_minio()
    bucket = get_minio_bucket()

    try:
        client.put_object(
            bucket,
            object_name,
            io.BytesIO(image_bytes),
            length=len(image_bytes),
            content_type="image/jpeg",
            metadata={
                "exam-id": safe_exam,
                "candidate-id": safe_candidate,
                "assessment-id": safe_assessment,
                "violation-id": safe_violation_id,
                "violation-type": safe_violation_type,
            },
        )
    except S3Error as error:
        _raise_minio_error(
            error,
            "screenshot upload",
        )

    print(
        "[Evidence] Screenshot uploaded:",
        object_name,
    )

    return object_name


def upload_clip(
    exam_id: str,
    candidate_id: str,
    violation_type: str,
    video_bytes: bytes,
    assessment_id: str | None = None,
    violation_id: str | None = None,
) -> str:
    """
    Upload one confirmed-violation MP4 clip.

    Returns the MinIO object path.
    """

    if not isinstance(video_bytes, (bytes, bytearray)):
        raise ValueError("Video evidence must be bytes")

    content = bytes(video_bytes)

    _validate_size(
        content,
        MAX_CLIP_BYTES,
        "Video clip",
    )

    safe_exam = _safe_path_part(
        exam_id,
        "unknown-exam",
    )
    safe_candidate = _safe_path_part(
        candidate_id,
        "unknown-candidate",
    )
    safe_assessment = _safe_path_part(
        assessment_id,
        "assessment",
    )
    safe_violation_type = _safe_path_part(
        violation_type,
        "violation",
    )
    safe_violation_id = _safe_path_part(
        violation_id
        or f"VIO-{uuid.uuid4().hex[:12].upper()}",
        "violation",
    )

    filename = (
        f"{safe_violation_type}_"
        f"{_timestamp_token()}_"
        f"{safe_violation_id}.mp4"
    )

    object_name = (
        f"{safe_exam}/"
        f"{safe_candidate}/"
        f"{safe_assessment}/"
        f"clips/"
        f"{filename}"
    )

    client = get_minio()
    bucket = get_minio_bucket()

    try:
        client.put_object(
            bucket,
            object_name,
            io.BytesIO(content),
            length=len(content),
            content_type="video/mp4",
            metadata={
                "exam-id": safe_exam,
                "candidate-id": safe_candidate,
                "assessment-id": safe_assessment,
                "violation-id": safe_violation_id,
                "violation-type": safe_violation_type,
            },
        )
    except S3Error as error:
        _raise_minio_error(
            error,
            "clip upload",
        )

    print(
        "[Evidence] Clip uploaded:",
        object_name,
    )

    return object_name


def get_evidence_base64(path: str) -> dict:
    """
    Read a private MinIO evidence object and return a browser-ready
    Base64 data URL.

    Returning a data URL prevents Electron from trying to access the
    Docker-only MinIO hostname such as minio:9000.
    """

    object_name = _normalise_object_path(path)
    client = get_minio()
    bucket = get_minio_bucket()
    response = None

    try:
        response = client.get_object(
            bucket,
            object_name,
        )

        content = response.read()

        if not content:
            raise FileNotFoundError(
                "Evidence object is empty"
            )

        headers = getattr(response, "headers", {}) or {}
        content_type = headers.get("Content-Type")

        if content_type:
            content_type = content_type.split(";", 1)[0].strip()

        if not content_type or content_type == "application/octet-stream":
            content_type = (
                mimetypes.guess_type(object_name)[0]
                or "image/jpeg"
            )

        encoded = base64.b64encode(content).decode("ascii")
        data_url = f"data:{content_type};base64,{encoded}"

        return {
            "objectname": object_name,
            "object_name": object_name,
            "contenttype": content_type,
            "content_type": content_type,
            "imagebase64": encoded,
            "image_base64": encoded,
            "dataurl": data_url,
            "data_url": data_url,
            "imageurl": data_url,
            "image_url": data_url,
            "size": len(content),
        }

    except FileNotFoundError:
        raise

    except S3Error as error:
        _raise_minio_error(
            error,
            "evidence download",
        )

    finally:
        if response is not None:
            try:
                response.close()
            finally:
                response.release_conn()


def get_presigned_url(
    path: str,
    expires_seconds: int = DEFAULT_URL_EXPIRY_SECONDS,
) -> str:
    """
    Return a temporary private MinIO URL.

    For Electron image display, prefer get_evidence_base64(), because
    a URL generated inside Docker can contain the internal hostname.
    """

    object_name = _normalise_object_path(path)

    try:
        expiry = int(expires_seconds)
    except (TypeError, ValueError) as error:
        raise ValueError(
            "expires_seconds must be an integer"
        ) from error

    expiry = max(
        60,
        min(
            expiry,
            7 * 24 * 60 * 60,
        ),
    )

    client = get_minio()
    bucket = get_minio_bucket()

    try:
        client.stat_object(
            bucket,
            object_name,
        )

        return client.presigned_get_object(
            bucket,
            object_name,
            expires=timedelta(seconds=expiry),
        )
    except S3Error as error:
        _raise_minio_error(
            error,
            "presigned URL generation",
        )


def delete_evidence(path: str) -> bool:
    """
    Delete one MinIO evidence object.

    Returns True when the delete request succeeds.
    """

    object_name = str(path or "").strip().lstrip("/")

    if not object_name:
        return False

    client = get_minio()
    bucket = get_minio_bucket()

    try:
        client.remove_object(
            bucket,
            object_name,
        )
    except S3Error as error:
        _raise_minio_error(
            error,
            "evidence deletion",
        )

    print(
        "[Evidence] Object deleted:",
        object_name,
    )

    return True

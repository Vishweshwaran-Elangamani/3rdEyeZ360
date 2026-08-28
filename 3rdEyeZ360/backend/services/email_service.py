from __future__ import annotations

import asyncio
import html
import logging
import os
import smtplib
import ssl
from datetime import datetime
from email.message import EmailMessage
from email.utils import formataddr
from typing import Any

from dotenv import load_dotenv


load_dotenv(override=False)

logger = logging.getLogger(__name__)


def _get_value(
    document: dict | None,
    *keys: str,
    default: Any = "",
) -> Any:
    document = document or {}

    for key in keys:
        value = document.get(key)

        if value is not None and value != "":
            return value

    return default


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


def _get_integer_env(
    name: str,
    default: int,
) -> int:
    value = str(
        os.getenv(name, str(default))
    ).strip()

    try:
        return int(value)
    except (TypeError, ValueError):
        return default


def _format_date(value: Any) -> str:
    text = str(value or "").strip()

    if not text:
        return "Not specified"

    supported_formats = (
        "%Y-%m-%d",
        "%d-%m-%Y",
        "%d/%m/%Y",
        "%Y/%m/%d",
    )

    for date_format in supported_formats:
        try:
            parsed = datetime.strptime(
                text,
                date_format,
            )

            return parsed.strftime("%d %B %Y")
        except ValueError:
            continue

    return text


def _format_time(value: Any) -> str:
    text = str(value or "").strip()

    if not text:
        return "Not specified"

    supported_formats = (
        "%H:%M",
        "%H:%M:%S",
        "%I:%M %p",
        "%I:%M:%S %p",
    )

    for time_format in supported_formats:
        try:
            parsed = datetime.strptime(
                text,
                time_format,
            )

            return parsed.strftime("%I:%M %p")
        except ValueError:
            continue

    return text


def _format_duration(value: Any) -> str:
    try:
        duration = int(value)
    except (TypeError, ValueError):
        return "Not specified"

    if duration <= 0:
        return "Not specified"

    if duration == 1:
        return "1 minute"

    return f"{duration} minutes"


def _get_exam_type(
    exam: dict | None,
) -> str:
    exam_type = str(
        _get_value(
            exam,
            "examtype",
            "exam_type",
            default="SINGLE_SESSION",
        )
    ).strip().upper()

    normalized = (
        exam_type
        .replace("-", "_")
        .replace(" ", "_")
    )

    if normalized in {
        "MULTI_SESSION",
        "MULTI",
        "FLEXIBLE",
    }:
        return "MULTI_SESSION"

    return "SINGLE_SESSION"


def _get_exam_name(
    exam: dict | None,
) -> str:
    name = str(
        _get_value(
            exam,
            "name",
            "examname",
            default="Examination",
        )
    ).strip()

    return name or "Examination"


def _get_exam_id(
    exam: dict | None,
) -> str:
    return str(
        _get_value(
            exam,
            "exam_id",
            "examid",
            default="",
        )
    ).strip()


def _get_duration(
    exam: dict | None,
) -> Any:
    return _get_value(
        exam,
        "duration_minutes",
        "durationminutes",
        default=0,
    )


def _get_instructions(
    exam: dict | None,
) -> str:
    instructions = str(
        _get_value(
            exam,
            "instructions",
            default="",
        )
    ).strip()

    if instructions:
        return instructions

    return (
        "Log in to the 3rdEyeZ360 application before the "
        "scheduled time and complete the required pre-check."
    )


def _get_timeframes(
    exam: dict | None,
) -> list[dict]:
    value = _get_value(
        exam,
        "timeframes",
        "flexible_intervals",
        "flexibleintervals",
        default=[],
    )

    if not isinstance(value, list):
        return []

    return [
        timeframe
        for timeframe in value
        if isinstance(timeframe, dict)
    ]


def _normalize_email_address(
    value: str,
) -> str:
    return str(value or "").strip().lower()


def _validate_email_address(
    email_address: str,
) -> None:
    if not email_address:
        raise ValueError(
            "Candidate email address is required"
        )

    if "@" not in email_address:
        raise ValueError(
            f"Invalid candidate email address: "
            f"{email_address}"
        )

    local_part, _, domain_part = (
        email_address.partition("@")
    )

    if (
        not local_part
        or not domain_part
        or "." not in domain_part
    ):
        raise ValueError(
            f"Invalid candidate email address: "
            f"{email_address}"
        )


def _html_multiline(
    value: Any,
) -> str:
    escaped = html.escape(
        str(value or "")
    )

    return escaped.replace("\n", "<br>")


def _build_timeframe_text(
    timeframes: list[dict],
) -> str:
    if not timeframes:
        return (
            "No flexible timeframes were provided."
        )

    lines: list[str] = []

    for index, timeframe in enumerate(
        timeframes,
        start=1,
    ):
        timeframe_date = _format_date(
            _get_value(
                timeframe,
                "date",
                default="",
            )
        )

        start_time = _format_time(
            _get_value(
                timeframe,
                "start_time",
                "starttime",
                default="",
            )
        )

        end_time = _format_time(
            _get_value(
                timeframe,
                "end_time",
                "endtime",
                default="",
            )
        )

        lines.append(
            f"{index}. {timeframe_date} | "
            f"{start_time} - {end_time}"
        )

    return "\n".join(lines)


def _build_timeframe_html(
    timeframes: list[dict],
) -> str:
    if not timeframes:
        return """
        <div style="
            padding: 14px 16px;
            border-radius: 8px;
            background-color: #fff4e5;
            color: #8a4b08;
            font-size: 14px;
        ">
            No flexible timeframes were provided.
        </div>
        """

    rows: list[str] = []

    for index, timeframe in enumerate(
        timeframes,
        start=1,
    ):
        timeframe_date = html.escape(
            _format_date(
                _get_value(
                    timeframe,
                    "date",
                    default="",
                )
            )
        )

        start_time = html.escape(
            _format_time(
                _get_value(
                    timeframe,
                    "start_time",
                    "starttime",
                    default="",
                )
            )
        )

        end_time = html.escape(
            _format_time(
                _get_value(
                    timeframe,
                    "end_time",
                    "endtime",
                    default="",
                )
            )
        )

        rows.append(
            f"""
            <tr>
                <td style="
                    padding: 12px;
                    border-bottom: 1px solid #e5e7eb;
                    text-align: center;
                    font-weight: 600;
                    color: #111827;
                ">
                    {index}
                </td>

                <td style="
                    padding: 12px;
                    border-bottom: 1px solid #e5e7eb;
                    color: #374151;
                ">
                    {timeframe_date}
                </td>

                <td style="
                    padding: 12px;
                    border-bottom: 1px solid #e5e7eb;
                    color: #374151;
                ">
                    {start_time}
                </td>

                <td style="
                    padding: 12px;
                    border-bottom: 1px solid #e5e7eb;
                    color: #374151;
                ">
                    {end_time}
                </td>
            </tr>
            """
        )

    return f"""
    <table
        role="presentation"
        style="
            width: 100%;
            border-collapse: collapse;
            border: 1px solid #e5e7eb;
            font-size: 14px;
        "
    >
        <thead>
            <tr style="background-color: #f3f4f6;">
                <th style="
                    padding: 12px;
                    text-align: center;
                    color: #374151;
                ">
                    Slot
                </th>

                <th style="
                    padding: 12px;
                    text-align: left;
                    color: #374151;
                ">
                    Date
                </th>

                <th style="
                    padding: 12px;
                    text-align: left;
                    color: #374151;
                ">
                    Start Time
                </th>

                <th style="
                    padding: 12px;
                    text-align: left;
                    color: #374151;
                ">
                    End Time
                </th>
            </tr>
        </thead>

        <tbody>
            {''.join(rows)}
        </tbody>
    </table>
    """


def _build_email_layout(
    heading: str,
    candidate_name: str,
    main_content: str,
    header_color: str,
) -> str:
    safe_heading = html.escape(heading)
    safe_candidate_name = html.escape(
        candidate_name or "Candidate"
    )

    return f"""
    <!DOCTYPE html>
    <html lang="en">
    <head>
        <meta charset="UTF-8">
        <meta
            name="viewport"
            content="width=device-width"
        >
        <title>{safe_heading}</title>
    </head>

    <body style="
        margin: 0;
        padding: 0;
        background-color: #f3f4f6;
        font-family: Arial, Helvetica, sans-serif;
    ">
        <table
            role="presentation"
            style="
                width: 100%;
                border-collapse: collapse;
                background-color: #f3f4f6;
            "
        >
            <tr>
                <td
                    align="center"
                    style="padding: 32px 16px;"
                >
                    <table
                        role="presentation"
                        style="
                            width: 100%;
                            max-width: 680px;
                            border-collapse: collapse;
                            background-color: #ffffff;
                            border-radius: 12px;
                            overflow: hidden;
                            box-shadow:
                                0 4px 18px
                                rgba(0, 0, 0, 0.08);
                        "
                    >
                        <tr>
                            <td style="
                                padding: 28px 32px;
                                background-color: {header_color};
                                color: #ffffff;
                            ">
                                <div style="
                                    font-size: 13px;
                                    font-weight: 700;
                                    letter-spacing: 1px;
                                    text-transform: uppercase;
                                    opacity: 0.9;
                                ">
                                    3rdEyeZ360
                                </div>

                                <h1 style="
                                    margin: 8px 0 0;
                                    font-size: 25px;
                                    line-height: 1.3;
                                ">
                                    {safe_heading}
                                </h1>
                            </td>
                        </tr>

                        <tr>
                            <td style="
                                padding: 30px 32px;
                                color: #1f2937;
                                font-size: 15px;
                                line-height: 1.65;
                            ">
                                <p style="margin: 0 0 18px;">
                                    Hello
                                    <strong>
                                        {safe_candidate_name}
                                    </strong>,
                                </p>

                                {main_content}
                            </td>
                        </tr>

                        <tr>
                            <td style="
                                padding: 20px 32px;
                                background-color: #111827;
                                color: #d1d5db;
                                font-size: 13px;
                                line-height: 1.5;
                            ">
                                Regards,<br>

                                <strong style="color: #ffffff;">
                                    3rdEyeZ360 Team
                                </strong>
                            </td>
                        </tr>
                    </table>
                </td>
            </tr>
        </table>
    </body>
    </html>
    """


def _build_assignment_content(
    candidate_name: str,
    exam: dict,
) -> tuple[str, str, str]:
    exam_name = _get_exam_name(exam)
    exam_id = _get_exam_id(exam)
    exam_type = _get_exam_type(exam)

    duration = _format_duration(
        _get_duration(exam)
    )

    instructions = _get_instructions(exam)

    safe_exam_name = html.escape(exam_name)
    safe_exam_id = html.escape(
        exam_id or "Not specified"
    )
    safe_duration = html.escape(duration)
    safe_instructions = _html_multiline(
        instructions
    )

    subject = f"Exam Assigned - {exam_name}"

    if exam_type == "MULTI_SESSION":
        timeframes = _get_timeframes(exam)

        timeframe_text = _build_timeframe_text(
            timeframes
        )

        timeframe_html = _build_timeframe_html(
            timeframes
        )

        text_body = f"""Hello {candidate_name or "Candidate"},

You have been assigned to the following examination.

Exam Name: {exam_name}
Exam ID: {exam_id or "Not specified"}
Exam Type: Multi-Session
Duration: {duration}

Available Timeframes:
{timeframe_text}

You may attend the examination during any one of the approved timeframes listed above.

The examination duration is {duration}.

Instructions:
{instructions}

Please log in to the 3rdEyeZ360 application before your selected timeframe and complete the required pre-check.

Regards,
3rdEyeZ360 Team
"""

        main_content = f"""
        <p style="margin: 0 0 22px;">
            You have been assigned to the following
            examination.
        </p>

        <table
            role="presentation"
            style="
                width: 100%;
                border-collapse: collapse;
                background-color: #f8fafc;
                border: 1px solid #e5e7eb;
            "
        >
            <tr>
                <td style="
                    padding: 12px 16px;
                    width: 145px;
                    color: #6b7280;
                    font-weight: 600;
                ">
                    Exam Name
                </td>

                <td style="
                    padding: 12px 16px;
                    color: #111827;
                    font-weight: 700;
                ">
                    {safe_exam_name}
                </td>
            </tr>

            <tr>
                <td style="
                    padding: 12px 16px;
                    color: #6b7280;
                    font-weight: 600;
                ">
                    Exam ID
                </td>

                <td style="
                    padding: 12px 16px;
                    color: #111827;
                ">
                    {safe_exam_id}
                </td>
            </tr>

            <tr>
                <td style="
                    padding: 12px 16px;
                    color: #6b7280;
                    font-weight: 600;
                ">
                    Exam Type
                </td>

                <td style="
                    padding: 12px 16px;
                    color: #047857;
                    font-weight: 700;
                ">
                    Flexible
                </td>
            </tr>

            <tr>
                <td style="
                    padding: 12px 16px;
                    color: #6b7280;
                    font-weight: 600;
                ">
                    Duration
                </td>

                <td style="
                    padding: 12px 16px;
                    color: #111827;
                ">
                    {safe_duration}
                </td>
            </tr>
        </table>

        <h2 style="
            margin: 28px 0 14px;
            font-size: 18px;
            color: #111827;
        ">
            Available Timeframes
        </h2>

        {timeframe_html}

        <p style="
            margin: 16px 0 0;
            color: #4b5563;
        ">
            You may attend the examination during any
            one of the approved timeframes listed above.
            The examination duration is
            <strong>{safe_duration}</strong>.
        </p>

        <h2 style="
            margin: 28px 0 10px;
            font-size: 18px;
            color: #111827;
        ">
            Instructions
        </h2>

        <div style="
            padding: 16px;
            background-color: #eff6ff;
            border-left: 4px solid #2563eb;
            border-radius: 6px;
            color: #1e3a8a;
        ">
            {safe_instructions}
        </div>

        <p style="
            margin: 24px 0 0;
            color: #4b5563;
        ">
            Please log in to the 3rdEyeZ360 application
            before your selected timeframe and complete
            the required pre-check.
        </p>
        """

        html_body = _build_email_layout(
            heading="Examination Assigned",
            candidate_name=candidate_name,
            main_content=main_content,
            header_color="#2563eb",
        )

        return subject, text_body, html_body

    exam_date = _format_date(
        _get_value(
            exam,
            "date",
            "examdate",
            default="",
        )
    )

    start_time = _format_time(
        _get_value(
            exam,
            "start_time",
            "starttime",
            "examstarttime",
            default="",
        )
    )

    end_time = _format_time(
        _get_value(
            exam,
            "end_time",
            "endtime",
            "examendtime",
            default="",
        )
    )

    safe_exam_date = html.escape(exam_date)
    safe_start_time = html.escape(start_time)
    safe_end_time = html.escape(end_time)

    text_body = f"""Hello {candidate_name or "Candidate"},

You have been assigned to the following examination.

Exam Name: {exam_name}
Exam ID: {exam_id or "Not specified"}
Exam Type: Single-Session
Date: {exam_date}
Time: {start_time} - {end_time}
Duration: {duration}

Instructions:
{instructions}

Please log in to the 3rdEyeZ360 application before the scheduled time and complete the required pre-check.

Regards,
3rdEyeZ360 Team
"""

    main_content = f"""
    <p style="margin: 0 0 22px;">
        You have been assigned to the following
        examination.
    </p>

    <table
        role="presentation"
        style="
            width: 100%;
            border-collapse: collapse;
            background-color: #f8fafc;
            border: 1px solid #e5e7eb;
        "
    >
        <tr>
            <td style="
                padding: 12px 16px;
                width: 145px;
                color: #6b7280;
                font-weight: 600;
            ">
                Exam Name
            </td>

            <td style="
                padding: 12px 16px;
                color: #111827;
                font-weight: 700;
            ">
                {safe_exam_name}
            </td>
        </tr>

        <tr>
            <td style="
                padding: 12px 16px;
                color: #6b7280;
                font-weight: 600;
            ">
                Exam ID
            </td>

            <td style="
                padding: 12px 16px;
                color: #111827;
            ">
                {safe_exam_id}
            </td>
        </tr>

        <tr>
            <td style="
                padding: 12px 16px;
                color: #6b7280;
                font-weight: 600;
            ">
                Exam Type
            </td>

            <td style="
                padding: 12px 16px;
                color: #b45309;
                font-weight: 700;
            ">
                Non-Flexible
            </td>
        </tr>

        <tr>
            <td style="
                padding: 12px 16px;
                color: #6b7280;
                font-weight: 600;
            ">
                Date
            </td>

            <td style="
                padding: 12px 16px;
                color: #111827;
            ">
                {safe_exam_date}
            </td>
        </tr>

        <tr>
            <td style="
                padding: 12px 16px;
                color: #6b7280;
                font-weight: 600;
            ">
                Time
            </td>

            <td style="
                padding: 12px 16px;
                color: #111827;
            ">
                {safe_start_time} - {safe_end_time}
            </td>
        </tr>

        <tr>
            <td style="
                padding: 12px 16px;
                color: #6b7280;
                font-weight: 600;
            ">
                Duration
            </td>

            <td style="
                padding: 12px 16px;
                color: #111827;
            ">
                {safe_duration}
            </td>
        </tr>
    </table>

    <h2 style="
        margin: 28px 0 10px;
        font-size: 18px;
        color: #111827;
    ">
        Instructions
    </h2>

    <div style="
        padding: 16px;
        background-color: #eff6ff;
        border-left: 4px solid #2563eb;
        border-radius: 6px;
        color: #1e3a8a;
    ">
        {safe_instructions}
    </div>

    <p style="
        margin: 24px 0 0;
        color: #4b5563;
    ">
        Please log in to the 3rdEyeZ360 application
        before the scheduled time and complete the
        required pre-check.
    </p>
    """

    html_body = _build_email_layout(
        heading="Examination Assigned",
        candidate_name=candidate_name,
        main_content=main_content,
        header_color="#2563eb",
    )

    return subject, text_body, html_body


def _build_removal_content(
    candidate_name: str,
    exam: dict,
) -> tuple[str, str, str]:
    exam_name = _get_exam_name(exam)
    exam_id = _get_exam_id(exam)

    safe_exam_name = html.escape(exam_name)
    safe_exam_id = html.escape(
        exam_id or "Not specified"
    )

    subject = (
        f"Exam Assignment Removed - {exam_name}"
    )

    text_body = f"""Hello {candidate_name or "Candidate"},

Your assignment for the following examination has been removed.

Exam Name: {exam_name}
Exam ID: {exam_id or "Not specified"}

The examination will no longer appear as an assigned examination in your 3rdEyeZ360 account.

If you believe this was done by mistake, please contact your examiner or administrator.

Regards,
3rdEyeZ360 Team
"""

    main_content = f"""
    <p style="margin: 0 0 22px;">
        Your assignment for the following examination
        has been removed.
    </p>

    <table
        role="presentation"
        style="
            width: 100%;
            border-collapse: collapse;
            background-color: #fef2f2;
            border: 1px solid #fecaca;
        "
    >
        <tr>
            <td style="
                padding: 14px 16px;
                width: 145px;
                color: #7f1d1d;
                font-weight: 600;
            ">
                Exam Name
            </td>

            <td style="
                padding: 14px 16px;
                color: #111827;
                font-weight: 700;
            ">
                {safe_exam_name}
            </td>
        </tr>

        <tr>
            <td style="
                padding: 14px 16px;
                color: #7f1d1d;
                font-weight: 600;
            ">
                Exam ID
            </td>

            <td style="
                padding: 14px 16px;
                color: #111827;
            ">
                {safe_exam_id}
            </td>
        </tr>
    </table>

    <p style="
        margin: 24px 0 0;
        color: #4b5563;
    ">
        The examination will no longer appear as an
        assigned examination in your 3rdEyeZ360 account.
    </p>

    <div style="
        margin-top: 22px;
        padding: 16px;
        background-color: #fff7ed;
        border-left: 4px solid #f97316;
        border-radius: 6px;
        color: #9a3412;
    ">
        If you believe this was done by mistake,
        please contact your examiner or administrator.
    </div>
    """

    html_body = _build_email_layout(
        heading="Examination Assignment Removed",
        candidate_name=candidate_name,
        main_content=main_content,
        header_color="#b91c1c",
    )

    return subject, text_body, html_body


def _load_smtp_configuration() -> dict:
    smtp_host = str(
        os.getenv("SMTP_HOST", "")
    ).strip()

    smtp_port = _get_integer_env(
        "SMTP_PORT",
        587,
    )

    smtp_username = str(
        os.getenv("SMTP_USERNAME", "")
    ).strip()

    smtp_password = str(
        os.getenv("SMTP_PASSWORD", "")
    ).strip()

    smtp_from_email = str(
        os.getenv(
            "SMTP_FROM_EMAIL",
            smtp_username,
        )
    ).strip()

    smtp_from_name = str(
        os.getenv(
            "SMTP_FROM_NAME",
            "3rdEyeZ360",
        )
    ).strip()

    smtp_reply_to_email = str(
        os.getenv(
            "SMTP_REPLY_TO_EMAIL",
            smtp_from_email,
        )
    ).strip()

    smtp_reply_to_name = str(
        os.getenv(
            "SMTP_REPLY_TO_NAME",
            "3rdEyeZ360 Team",
        )
    ).strip()

    smtp_use_tls = _get_boolean_env(
        "SMTP_USE_TLS",
        True,
    )

    smtp_use_ssl = _get_boolean_env(
        "SMTP_USE_SSL",
        False,
    )

    smtp_timeout = _get_integer_env(
        "SMTP_TIMEOUT_SECONDS",
        30,
    )

    missing: list[str] = []

    if not smtp_host:
        missing.append("SMTP_HOST")

    if not smtp_from_email:
        missing.append("SMTP_FROM_EMAIL")

    if not smtp_username:
        missing.append("SMTP_USERNAME")

    if not smtp_password:
        missing.append("SMTP_PASSWORD")

    if missing:
        raise RuntimeError(
            "Missing email configuration: "
            + ", ".join(missing)
        )

    if smtp_use_ssl and smtp_use_tls:
        logger.warning(
            "Both SMTP_USE_SSL and SMTP_USE_TLS are enabled. "
            "SMTP_USE_SSL will be used."
        )

    return {
        "host": smtp_host,
        "port": smtp_port,
        "username": smtp_username,
        "password": smtp_password,
        "from_email": smtp_from_email,
        "from_name": smtp_from_name,
        "reply_to_email": smtp_reply_to_email,
        "reply_to_name": smtp_reply_to_name,
        "use_tls": smtp_use_tls,
        "use_ssl": smtp_use_ssl,
        "timeout": smtp_timeout,
    }


def _send_email_sync(
    recipient_email: str,
    subject: str,
    text_body: str,
    html_body: str,
) -> None:
    config = _load_smtp_configuration()

    message = EmailMessage()

    message["Subject"] = subject

    message["From"] = formataddr(
        (
            config["from_name"],
            config["from_email"],
        )
    )

    message["To"] = recipient_email

    if config["reply_to_email"]:
        message["Reply-To"] = formataddr(
            (
                config["reply_to_name"],
                config["reply_to_email"],
            )
        )

    message.set_content(text_body)

    message.add_alternative(
        html_body,
        subtype="html",
    )

    ssl_context = ssl.create_default_context()

    if config["use_ssl"]:
        with smtplib.SMTP_SSL(
            host=config["host"],
            port=config["port"],
            timeout=config["timeout"],
            context=ssl_context,
        ) as smtp:
            smtp.login(
                config["username"],
                config["password"],
            )

            smtp.send_message(
                message,
                from_addr=config["from_email"],
                to_addrs=[recipient_email],
            )

        return

    with smtplib.SMTP(
        host=config["host"],
        port=config["port"],
        timeout=config["timeout"],
    ) as smtp:
        smtp.ehlo()

        if config["use_tls"]:
            smtp.starttls(
                context=ssl_context,
            )

            smtp.ehlo()

        smtp.login(
            config["username"],
            config["password"],
        )

        smtp.send_message(
            message,
            from_addr=config["from_email"],
            to_addrs=[recipient_email],
        )


async def _send_email(
    recipient_email: str,
    subject: str,
    text_body: str,
    html_body: str,
) -> None:
    normalized_email = _normalize_email_address(
        recipient_email
    )

    _validate_email_address(
        normalized_email
    )

    await asyncio.to_thread(
        _send_email_sync,
        normalized_email,
        subject,
        text_body,
        html_body,
    )

    logger.info(
        "Email sent successfully to %s with subject %s",
        normalized_email,
        subject,
    )


async def send_exam_assignment_email(
    candidate_email: str,
    candidate_name: str,
    exam: dict,
) -> None:
    if not isinstance(exam, dict) or not exam:
        raise ValueError(
            "Exam information is required for "
            "assignment email"
        )

    subject, text_body, html_body = (
        _build_assignment_content(
            candidate_name=candidate_name,
            exam=exam,
        )
    )

    await _send_email(
        recipient_email=candidate_email,
        subject=subject,
        text_body=text_body,
        html_body=html_body,
    )


async def send_exam_removal_email(
    candidate_email: str,
    candidate_name: str,
    exam: dict,
) -> None:
    if not isinstance(exam, dict) or not exam:
        raise ValueError(
            "Exam information is required for "
            "removal email"
        )

    subject, text_body, html_body = (
        _build_removal_content(
            candidate_name=candidate_name,
            exam=exam,
        )
    )

    await _send_email(
        recipient_email=candidate_email,
        subject=subject,
        text_body=text_body,
        html_body=html_body,
    )
import os
from dataclasses import dataclass


def _split_csv(value: str) -> list[str]:
    return [item.strip() for item in str(value or "").split(",") if item.strip()]


@dataclass(frozen=True)
class MessagingSettings:
    bootstrap_servers: list[str]
    chat_topic: str
    dead_letter_topic: str
    consumer_group: str
    message_collection: str
    maximum_message_length: int
    history_limit: int


settings = MessagingSettings(
    bootstrap_servers=_split_csv(os.getenv("KAFKA_BOOTSTRAP_SERVERS", "localhost:9092")),
    chat_topic=os.getenv("KAFKA_CHAT_TOPIC", "assessment-chat-messages"),
    dead_letter_topic=os.getenv("KAFKA_CHAT_DLQ_TOPIC", "assessment-chat-dead-letter"),
    consumer_group=os.getenv("KAFKA_CHAT_CONSUMER_GROUP", "3rdeyez360-chat-workers"),
    message_collection=os.getenv("CHAT_MESSAGE_COLLECTION", "chat_messages"),
    maximum_message_length=int(os.getenv("CHAT_MAX_MESSAGE_LENGTH", "1000")),
    history_limit=int(os.getenv("CHAT_HISTORY_LIMIT", "50")),
)

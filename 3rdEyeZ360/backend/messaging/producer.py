import json
import os

from aiokafka import AIOKafkaProducer

from .config import settings
from .schemas import ChatEvent


def get_bootstrap_servers() -> list[str]:
    value = os.environ.get(
        "KAFKA_BOOTSTRAP_SERVERS",
        "localhost:9092",
    )

    servers = [
        item.strip()
        for item in value.split(",")
        if item.strip()
    ]

    if not servers:
        return ["localhost:9092"]

    return servers


class ChatProducer:
    def __init__(self) -> None:
        self._producer: AIOKafkaProducer | None = None

    @property
    def started(self) -> bool:
        return self._producer is not None

    async def start(self) -> None:
        if self._producer is not None:
            return

        bootstrap_servers = get_bootstrap_servers()

        print(
            "[Messaging] Kafka producer bootstrap servers:",
            bootstrap_servers,
        )

        producer = AIOKafkaProducer(
            bootstrap_servers=bootstrap_servers,
            acks="all",
            enable_idempotence=True,
            key_serializer=lambda value: value.encode(
                "utf-8"
            ),
            value_serializer=lambda value: json.dumps(
                value,
                default=str,
                separators=(",", ":"),
            ).encode("utf-8"),
        )

        self._producer = producer

        try:
            await producer.start()

        except Exception:
            self._producer = None

            try:
                await producer.stop()
            except Exception:
                pass

            raise

        print(
            "[Messaging] Kafka producer started"
        )

    async def stop(self) -> None:
        producer = self._producer
        self._producer = None

        if producer is not None:
            try:
                await producer.stop()
            except Exception:
                pass

        print(
            "[Messaging] Kafka producer stopped"
        )

    async def publish(
        self,
        event: ChatEvent,
    ) -> None:
        if self._producer is None:
            raise RuntimeError(
                "Kafka chat producer is not started"
            )

        await self._producer.send_and_wait(
            settings.chat_topic,
            key=event.conversationid,
            value=event.model_dump(
                mode="json"
            ),
        )


chat_producer = ChatProducer()

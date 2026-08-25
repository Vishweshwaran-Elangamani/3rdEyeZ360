import asyncio
import json
import logging

from aiokafka import AIOKafkaConsumer, AIOKafkaProducer
from fastapi.encoders import jsonable_encoder

from .config import settings
from .constants import (
    CHAT_MESSAGE_CREATED,
    CHAT_MESSAGE_DELETED,
    CHAT_MESSAGE_EDITED,
    SOCKET_CHAT_CREATED,
    SOCKET_CHAT_DELETED,
    SOCKET_CHAT_EDITED,
)
from .repository import ChatRepository
from .schemas import ChatDeleteEvent, ChatEditEvent, ChatEvent

logger = logging.getLogger(__name__)


class ChatConsumerWorker:
    def __init__(self) -> None:
        self._consumer: AIOKafkaConsumer | None = None
        self._dead_letter_producer: AIOKafkaProducer | None = None
        self._task: asyncio.Task | None = None
        self._stopping = asyncio.Event()
        self._db = None
        self._sio = None

    async def start(self, db, sio) -> None:
        if self._task is not None:
            return

        self._db = db
        self._sio = sio
        self._stopping.clear()

        self._consumer = AIOKafkaConsumer(
            settings.chat_topic,
            bootstrap_servers=settings.bootstrap_servers,
            group_id=settings.consumer_group,
            enable_auto_commit=False,
            auto_offset_reset="earliest",
            value_deserializer=lambda value: json.loads(value.decode("utf-8")),
        )

        self._dead_letter_producer = AIOKafkaProducer(
            bootstrap_servers=settings.bootstrap_servers,
            acks="all",
            value_serializer=lambda value: json.dumps(
                value,
                default=str,
                separators=(",", ":"),
            ).encode("utf-8"),
        )

        try:
            await self._consumer.start()
            await self._dead_letter_producer.start()
        except Exception:
            await self._stop_clients()
            raise

        self._task = asyncio.create_task(
            self._run(),
            name="chat-kafka-consumer",
        )
        print("[Messaging] Kafka consumer started")

    async def _stop_clients(self) -> None:
        consumer, self._consumer = self._consumer, None
        if consumer is not None:
            await consumer.stop()

        producer, self._dead_letter_producer = (
            self._dead_letter_producer,
            None,
        )
        if producer is not None:
            await producer.stop()

    async def stop(self) -> None:
        self._stopping.set()

        task, self._task = self._task, None
        if task is not None:
            task.cancel()
            try:
                await task
            except asyncio.CancelledError:
                pass

        await self._stop_clients()
        print("[Messaging] Kafka consumer stopped")

    async def _send_to_dead_letter(self, record, error: Exception) -> None:
        if self._dead_letter_producer is None:
            return

        await self._dead_letter_producer.send_and_wait(
            settings.dead_letter_topic,
            {
                "error": str(error),
                "source_topic": record.topic,
                "partition": record.partition,
                "offset": record.offset,
                "event": record.value,
            },
        )

    async def _process_created(
        self,
        repository: ChatRepository,
        value: dict,
    ) -> None:
        event = ChatEvent.model_validate(value)
        stored, _created = await repository.insert_event(event)

        socket_message = ChatEvent.model_validate(stored).model_dump(mode="json")

        await self._sio.emit(
            SOCKET_CHAT_CREATED,
            socket_message,
            room=event.room,
        )

    async def _process_edited(
        self,
        repository: ChatRepository,
        value: dict,
    ) -> None:
        event = ChatEditEvent.model_validate(value)
        stored, _updated = await repository.apply_edit(event)

        if stored is None:
            raise ValueError(
                f"Chat message not found for edit: {event.messageid}"
            )

        socket_message = jsonable_encoder(stored)

        await self._sio.emit(
            SOCKET_CHAT_EDITED,
            socket_message,
            room=event.room,
        )

    async def _process_deleted(
        self,
        repository: ChatRepository,
        value: dict,
    ) -> None:
        event = ChatDeleteEvent.model_validate(value)
        stored, _deleted = await repository.apply_delete(event)

        if stored is None:
            raise ValueError(
                f"Chat message not found for delete: {event.messageid}"
            )

        socket_message = jsonable_encoder(stored)

        await self._sio.emit(
            SOCKET_CHAT_DELETED,
            socket_message,
            room=event.room,
        )

    async def _run(self) -> None:
        if self._consumer is None:
            return

        repository = ChatRepository(self._db)

        while not self._stopping.is_set():
            try:
                record = await self._consumer.getone()

                try:
                    event_type = str(record.value.get("eventtype") or "")

                    if event_type == CHAT_MESSAGE_CREATED:
                        await self._process_created(repository, record.value)
                    elif event_type == CHAT_MESSAGE_EDITED:
                        await self._process_edited(repository, record.value)
                    elif event_type == CHAT_MESSAGE_DELETED:
                        await self._process_deleted(repository, record.value)
                    else:
                        raise ValueError(
                            f"Unsupported chat event type: {event_type}"
                        )

                    await self._consumer.commit()

                except Exception as error:
                    logger.exception("Chat event processing failed")
                    await self._send_to_dead_letter(record, error)
                    await self._consumer.commit()

            except asyncio.CancelledError:
                raise
            except Exception:
                logger.exception("Chat consumer loop failed")
                await asyncio.sleep(1)


chat_consumer = ChatConsumerWorker()

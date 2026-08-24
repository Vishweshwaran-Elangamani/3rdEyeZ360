from .consumer import chat_consumer
from .producer import chat_producer
from .repository import ChatRepository


async def start_messaging(db, sio) -> None:
    repository = ChatRepository(db)
    await repository.ensure_indexes()

    try:
        await chat_producer.start()
        await chat_consumer.start(db, sio)
    except Exception:
        await chat_consumer.stop()
        await chat_producer.stop()
        raise

    print("[Messaging] Messaging services ready")


async def stop_messaging() -> None:
    await chat_consumer.stop()
    await chat_producer.stop()
    print("[Messaging] Messaging services stopped")

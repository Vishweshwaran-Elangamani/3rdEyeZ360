from pymongo import ASCENDING, DESCENDING, ReturnDocument
from pymongo.errors import DuplicateKeyError

from .config import settings
from .schemas import ChatDeleteEvent, ChatEditEvent, ChatEvent


class ChatRepository:
    def __init__(self, db) -> None:
        self.collection = db[settings.message_collection]

    async def ensure_indexes(self) -> None:
        await self.collection.create_index(
            [("messageid", ASCENDING)],
            unique=True,
            name="uq_chat_messageid",
        )
        await self.collection.create_index(
            [("eventid", ASCENDING)],
            unique=True,
            name="uq_chat_eventid",
        )
        await self.collection.create_index(
            [("conversationid", ASCENDING), ("createdat", DESCENDING)],
            name="ix_chat_conversation_created",
        )
        await self.collection.create_index(
            [("examid", ASCENDING), ("candidateid", ASCENDING)],
            name="ix_chat_exam_candidate",
        )
        print("[Messaging] MongoDB chat indexes ready")

    async def insert_event(self, event: ChatEvent) -> tuple[dict, bool]:
        document = event.model_dump(mode="python")

        try:
            await self.collection.insert_one(document)
            document.pop("_id", None)
            return document, True

        except DuplicateKeyError:
            existing = await self.collection.find_one(
                {
                    "$or": [
                        {"messageid": event.messageid},
                        {"eventid": event.eventid},
                    ]
                },
                {"_id": 0},
            )
            return existing or document, False

    async def find_message(self, message_id: str) -> dict | None:
        return await self.collection.find_one(
            {"messageid": message_id},
            {"_id": 0},
        )

    async def apply_edit(
        self,
        event: ChatEditEvent,
    ) -> tuple[dict | None, bool]:
        # Include messageid in the projection so a document that does not yet
        # contain lasteventid is not returned as an empty dictionary.
        existing = await self.collection.find_one(
            {"messageid": event.messageid},
            {
                "_id": 0,
                "messageid": 1,
                "lasteventid": 1,
            },
        )

        if existing is None:
            return None, False

        if existing.get("lasteventid") == event.eventid:
            stored = await self.find_message(event.messageid)
            return stored, False

        updated = await self.collection.find_one_and_update(
            {
                "messageid": event.messageid,
                "conversationid": event.conversationid,
                "senderid": event.editedby,
            },
            {
                "$set": {
                    "message": event.message,
                    "editedat": event.editedat,
                    "editedby": event.editedby,
                    "lasteventid": event.eventid,
                    "eventtype": event.eventtype,
                }
            },
            projection={"_id": 0},
            return_document=ReturnDocument.AFTER,
        )

        return updated, updated is not None

    async def apply_delete(
        self,
        event: ChatDeleteEvent,
    ) -> tuple[dict | None, bool]:
        existing = await self.collection.find_one(
            {"messageid": event.messageid},
            {"_id": 0, "messageid": 1, "lasteventid": 1, "isdeleted": 1},
        )

        if existing is None:
            return None, False

        if existing.get("lasteventid") == event.eventid:
            stored = await self.find_message(event.messageid)
            return stored, False

        updated = await self.collection.find_one_and_update(
            {
                "messageid": event.messageid,
                "conversationid": event.conversationid,
                "senderid": event.deletedby,
            },
            {
                "$set": {
                    "message": "This message was deleted.",
                    "isdeleted": True,
                    "deletedat": event.deletedat,
                    "deletedby": event.deletedby,
                    "lasteventid": event.eventid,
                    "eventtype": event.eventtype,
                }
            },
            projection={"_id": 0},
            return_document=ReturnDocument.AFTER,
        )

        return updated, updated is not None

    async def history(
        self,
        conversation_id: str,
        limit: int | None = None,
        before=None,
    ) -> list[dict]:
        query: dict = {"conversationid": conversation_id}

        if before is not None:
            query["createdat"] = {"$lt": before}

        safe_limit = min(
            max(limit or settings.history_limit, 1),
            100,
        )

        cursor = (
            self.collection.find(query, {"_id": 0})
            .sort("createdat", DESCENDING)
            .limit(safe_limit)
        )

        messages = await cursor.to_list(length=safe_limit)
        messages.reverse()
        return messages

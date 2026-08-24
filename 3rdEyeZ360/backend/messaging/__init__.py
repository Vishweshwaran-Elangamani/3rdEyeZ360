"""Kafka-backed assessment messaging package."""

from .lifecycle import start_messaging, stop_messaging

__all__ = ["start_messaging", "stop_messaging"]

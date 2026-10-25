import json
import logging
import os

import redis as redis_client

from .config import settings

logger = logging.getLogger(__name__)


class Cache:
    """Best-effort Redis cache. The application must keep working without Redis."""

    def __init__(self) -> None:
        self.enabled = settings.redis_enabled
        self._warned = False
        self._client = None
        if self.enabled:
            self._client = redis_client.Redis(
                host=os.getenv("REDIS_HOST", "localhost"),
                port=int(os.getenv("REDIS_PORT", "6379")),
                decode_responses=True,
                socket_connect_timeout=1,
                socket_timeout=1,
            )

    def get_json(self, key: str):
        if not self._client:
            return None
        try:
            value = self._client.get(key)
            return json.loads(value) if value else None
        except Exception as exc:  # pragma: no cover - depends on Redis availability
            self._log_unavailable(exc)
            return None

    def set_json(self, key: str, value, ttl: int | None = None) -> None:
        if not self._client:
            return
        try:
            self._client.setex(key, ttl or settings.cache_ttl, json.dumps(value))
        except Exception as exc:  # pragma: no cover
            self._log_unavailable(exc)

    def delete(self, *keys: str) -> None:
        if not self._client or not keys:
            return
        try:
            self._client.delete(*keys)
        except Exception as exc:  # pragma: no cover
            self._log_unavailable(exc)

    def _log_unavailable(self, exc: Exception) -> None:
        if not self._warned:
            logger.warning("Redis unavailable; continuing without cache: %s", exc)
            self._warned = True


cache = Cache()

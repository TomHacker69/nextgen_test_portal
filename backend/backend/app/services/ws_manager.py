"""
WebSocket Connection Manager with Redis Pub/Sub fan-out.
Manages both student and admin WebSocket connections.
"""
import asyncio
import json
from typing import Dict, Set, Optional
from datetime import datetime
from fastapi import WebSocket
from app.core.redis_client import get_redis


class ConnectionManager:
    def __init__(self):
        # student_connections: attempt_id -> WebSocket
        self.student_connections: Dict[str, WebSocket] = {}
        # admin_connections: exam_id -> Set[WebSocket]
        self.admin_connections: Dict[str, Set[WebSocket]] = {}
        self._redis_listener_task: Optional[asyncio.Task] = None

    async def connect_student(self, websocket: WebSocket, attempt_id: str):
        await websocket.accept()
        self.student_connections[attempt_id] = websocket

    def disconnect_student(self, attempt_id: str):
        self.student_connections.pop(attempt_id, None)

    async def connect_admin(self, websocket: WebSocket, exam_id: str):
        await websocket.accept()
        if exam_id not in self.admin_connections:
            self.admin_connections[exam_id] = set()
        self.admin_connections[exam_id].add(websocket)

    def disconnect_admin(self, websocket: WebSocket, exam_id: str):
        if exam_id in self.admin_connections:
            self.admin_connections[exam_id].discard(websocket)

    async def send_to_student(self, attempt_id: str, message: dict):
        ws = self.student_connections.get(attempt_id)
        if ws:
            try:
                await ws.send_json(message)
            except Exception:
                self.disconnect_student(attempt_id)

    async def broadcast_to_admins(self, exam_id: str, message: dict):
        """Broadcast to all admin connections for this exam (local + via Redis)."""
        # Local broadcast
        if exam_id in self.admin_connections:
            dead = set()
            for ws in self.admin_connections[exam_id]:
                try:
                    await ws.send_json(message)
                except Exception:
                    dead.add(ws)
            for ws in dead:
                self.admin_connections[exam_id].discard(ws)

        # Redis fan-out to other instances
        redis = get_redis()
        if redis:
            try:
                channel = f"exam:{exam_id}:events"
                await redis.publish(channel, json.dumps(message))
            except Exception as e:
                print(f"[WS Manager] Redis publish error: {e}")

    async def publish_event(self, exam_id: str, event: dict):
        """Persist event to DB and broadcast to admins."""
        await self.broadcast_to_admins(exam_id, event)

    async def start_redis_listener(self):
        """Listen to Redis pub/sub and fan-out to local admin connections."""
        redis = get_redis()
        if not redis:
            return
        try:
            pubsub = redis.pubsub()
            # Subscribe to all exam channels
            await pubsub.psubscribe("exam:*:events")
            async for message in pubsub.listen():
                if message["type"] == "pmessage":
                    channel = message["channel"]
                    exam_id = channel.split(":")[1]
                    data = json.loads(message["data"])
                    if exam_id in self.admin_connections:
                        dead = set()
                        for ws in self.admin_connections[exam_id]:
                            try:
                                await ws.send_json(data)
                            except Exception:
                                dead.add(ws)
                        for ws in dead:
                            self.admin_connections[exam_id].discard(ws)
        except Exception as e:
            print(f"[WS Manager] Redis listener error: {e}")


ws_manager = ConnectionManager()

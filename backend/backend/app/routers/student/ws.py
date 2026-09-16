"""
Student WebSocket handler.
Protocol:
  Client -> Server: HEARTBEAT, ANSWER_SELECTED, QUESTION_OPENED, TAB_SWITCH, FULLSCREEN_EXIT
  Server -> Client: ANSWER_SAVED, SERVER_TIME, ATTEMPT_FINALIZING, ADMIN_MESSAGE
"""
from fastapi import APIRouter, WebSocket, WebSocketDisconnect, Depends, Query
from datetime import datetime
import json
from app.core.security import decode_token
from app.core.database import get_db
from app.services.ws_manager import ws_manager
from bson import ObjectId

router = APIRouter(tags=["student-ws"])


@router.websocket("/ws/student/{attempt_id}")
async def student_ws(websocket: WebSocket, attempt_id: str, token: str = Query(None)):
    """WebSocket endpoint for student during exam."""
    db = get_db()

    # Authenticate via query param token (since cookies may not work in WS)
    if not token:
        await websocket.close(code=4001)
        return

    payload = decode_token(token)
    if not payload or payload.get("role") != "student":
        await websocket.close(code=4001)
        return

    student_id = payload["sub"]

    # Verify attempt belongs to this student
    attempt = await db.attempts.find_one({"_id": ObjectId(attempt_id), "student_id": student_id})
    if not attempt or attempt["status"] not in ("in_progress", "paused"):
        await websocket.close(code=4003)
        return

    exam_id = str(attempt["exam_id"])
    await ws_manager.connect_student(websocket, attempt_id)

    try:
        # Send initial server time
        await websocket.send_json({
            "type": "SERVER_TIME",
            "now": datetime.utcnow().isoformat(),
            "expires_at": attempt.get("expires_at", "").isoformat() if attempt.get("expires_at") else None,
        })

        while True:
            data = await websocket.receive_text()
            try:
                msg = json.loads(data)
            except json.JSONDecodeError:
                continue

            msg_type = msg.get("type", "")

            if msg_type == "HEARTBEAT":
                await websocket.send_json({
                    "type": "SERVER_TIME",
                    "now": datetime.utcnow().isoformat(),
                })

            elif msg_type in ("TAB_SWITCH", "FULLSCREEN_EXIT", "COPY", "PASTE", "BLUR"):
                # Record integrity event
                severity_map = {
                    "TAB_SWITCH": "medium",
                    "FULLSCREEN_EXIT": "low",
                    "COPY": "medium",
                    "PASTE": "medium",
                    "BLUR": "low",
                }
                await db.events.insert_one({
                    "attempt_id": attempt_id,
                    "exam_id": exam_id,
                    "student_id": student_id,
                    "event_type": msg_type,
                    "meta": msg.get("meta", {}),
                    "timestamp": datetime.utcnow(),
                    "severity": severity_map.get(msg_type, "low"),
                })
                # Notify admins
                await ws_manager.broadcast_to_admins(exam_id, {
                    "type": "INTEGRITY_EVENT",
                    "student_id": student_id,
                    "attempt_id": attempt_id,
                    "event_type": msg_type,
                    "meta": msg.get("meta", {}),
                    "timestamp": datetime.utcnow().isoformat(),
                })

            elif msg_type == "ANSWER_ACTIVITY":
                # Relay anonymized activity to admin (no correctness here — scored server-side)
                await ws_manager.broadcast_to_admins(exam_id, {
                    "type": "ANSWER_ACTIVITY",
                    "student_id": student_id,
                    "question_id": msg.get("question_id"),
                    "timestamp": datetime.utcnow().isoformat(),
                })

    except WebSocketDisconnect:
        pass
    finally:
        ws_manager.disconnect_student(attempt_id)
        # Notify admins of disconnect
        await ws_manager.broadcast_to_admins(exam_id, {
            "type": "STUDENT_DISCONNECTED",
            "student_id": student_id,
            "attempt_id": attempt_id,
            "timestamp": datetime.utcnow().isoformat(),
        })

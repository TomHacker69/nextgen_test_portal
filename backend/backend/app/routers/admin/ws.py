"""Admin WebSocket — live exam monitor."""
from fastapi import APIRouter, WebSocket, WebSocketDisconnect, Query
from datetime import datetime
from app.core.security import decode_token
from app.core.database import get_db
from app.services.ws_manager import ws_manager
from bson import ObjectId

router = APIRouter(tags=["admin-ws"])


@router.websocket("/ws/admin/{exam_id}")
async def admin_ws(websocket: WebSocket, exam_id: str, token: str = Query(None)):
    """WebSocket for admin live monitor."""
    if not token:
        await websocket.close(code=4001)
        return

    payload = decode_token(token)
    if not payload or payload.get("role") != "admin":
        await websocket.close(code=4001)
        return

    await ws_manager.connect_admin(websocket, exam_id)
    db = get_db()

    try:
        # Send current snapshot of in-progress candidates
        attempts = await db.attempts.find(
            {"exam_id": exam_id, "status": {"$in": ["in_progress", "paused", "submitted"]}}
        ).to_list(None)

        candidate_snapshot = []
        for a in attempts:
            student = await db.users.find_one({"_id": ObjectId(a["student_id"])})
            connected = a["student_id"] in [
                v for k, v in {k: ws_manager.student_connections.get(k, {}) for k in ws_manager.student_connections}.items()
            ]
            candidate_snapshot.append({
                "student_id": a["student_id"],
                "attempt_id": str(a["_id"]),
                "name": student.get("name") if student else "Unknown",
                "roll_number": student.get("roll_number") if student else None,
                "status": a.get("status"),
                "answer_count": a.get("answer_count", 0),
                "score": a.get("score"),
                "started_at": a.get("started_at", "").isoformat() if a.get("started_at") else None,
            })

        await websocket.send_json({
            "type": "SNAPSHOT",
            "candidates": candidate_snapshot,
            "timestamp": datetime.utcnow().isoformat(),
        })

        # Keep alive and handle admin commands
        while True:
            data = await websocket.receive_text()
            import json
            try:
                msg = json.loads(data)
            except Exception:
                continue

            if msg.get("type") == "PING":
                await websocket.send_json({"type": "PONG", "now": datetime.utcnow().isoformat()})

    except WebSocketDisconnect:
        pass
    finally:
        ws_manager.disconnect_admin(websocket, exam_id)

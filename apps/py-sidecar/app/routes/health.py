from fastapi import APIRouter
import os

router = APIRouter()


def _version() -> str:
    # Prefer an explicit env var so you can pin it in launch scripts or CI.
    v = os.getenv("WORLD_ENGINE_SIDECAR_VERSION")
    if v and v.strip():
        return v.strip()
    return "dev"


@router.get("/health")
def health():
    """
    Health endpoint for Nucleus poller.
    Keep this fast and side-effect free.
    """
    return {
        "ok": True,
        "status": "ok",
        "state": "up",
        "service": "sidecar",
        "version": _version(),
    }

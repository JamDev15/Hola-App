import json
import httpx
from datetime import datetime, timezone
from app.config import settings


def _ext_from_mime(mime: str) -> str:
    return {
        "image/jpeg": ".jpg",
        "image/png":  ".png",
        "image/webp": ".webp",
        "image/gif":  ".gif",
        "application/pdf": ".pdf",
    }.get(mime, "")


async def upload_file(data: bytes, original_name: str, mime: str, label: str = "") -> dict | None:
    """
    Upload bytes to the configured Dropbox folder.
    Returns {"panel": label, "name": filename, "path": dropbox_path, "url": shared_url}
    or None if Dropbox is not configured or the upload fails (non-blocking).
    """
    if not settings.dropbox_access_token:
        return None

    ts = datetime.now(timezone.utc).strftime("%Y%m%d_%H%M%S")
    prefix = f"{label}_" if label else ""
    # Use original name but guarantee correct extension
    base = original_name.rsplit(".", 1)[0] if "." in original_name else original_name
    ext  = _ext_from_mime(mime) or (f".{original_name.rsplit('.', 1)[-1]}" if "." in original_name else "")
    dest_name = f"{prefix}{ts}_{base}{ext}"
    dest_path = f"{settings.dropbox_folder_path.rstrip('/')}/{dest_name}"

    headers_auth = {"Authorization": f"Bearer {settings.dropbox_access_token}"}

    async with httpx.AsyncClient(timeout=60) as client:
        # ── Upload ────────────────────────────────────────────────────────────
        up = await client.post(
            "https://content.dropboxapi.com/2/files/upload",
            headers={
                **headers_auth,
                "Dropbox-API-Arg": json.dumps({
                    "path": dest_path,
                    "mode": "add",
                    "autorename": True,
                    "mute": False,
                }),
                "Content-Type": "application/octet-stream",
            },
            content=data,
        )
        if not up.is_success:
            return None

        file_path = up.json().get("path_display", dest_path)

        # ── Create or retrieve shared link ────────────────────────────────────
        sl = await client.post(
            "https://api.dropboxapi.com/2/sharing/create_shared_link_with_settings",
            headers={**headers_auth, "Content-Type": "application/json"},
            json={"path": file_path, "settings": {"requested_visibility": "public"}},
        )

        url = None
        if sl.is_success:
            url = sl.json().get("url")
        elif sl.status_code == 409:
            # Link already exists — extract it from the error body
            err = sl.json().get("error", {})
            if err.get(".tag") == "shared_link_already_exists":
                url = err.get("metadata", {}).get("url")

        return {"panel": label, "name": dest_name, "path": file_path, "url": url}

import base64
import httpx
from fastapi import APIRouter, HTTPException
from app.config import settings
from app.docx_utils import DOCX_MIME, extract_docx_image

router = APIRouter()


def _require_credentials():
    if not all([settings.sharepoint_tenant_id, settings.sharepoint_client_id, settings.sharepoint_client_secret]):
        raise HTTPException(
            503,
            "SharePoint credentials not configured. Add SHAREPOINT_TENANT_ID, "
            "SHAREPOINT_CLIENT_ID, and SHAREPOINT_CLIENT_SECRET to your .env file. "
            "Register an app at portal.azure.com with Sites.Read.All and Files.Read.All permissions.",
        )


async def _get_graph_token() -> str:
    _require_credentials()
    url = f"https://login.microsoftonline.com/{settings.sharepoint_tenant_id}/oauth2/v2.0/token"
    async with httpx.AsyncClient() as client:
        r = await client.post(url, data={
            "grant_type": "client_credentials",
            "client_id": settings.sharepoint_client_id,
            "client_secret": settings.sharepoint_client_secret,
            "scope": "https://graph.microsoft.com/.default",
        })
        if not r.is_success:
            raise HTTPException(400, f"SharePoint authentication failed: {r.text}")
        return r.json()["access_token"]


async def fetch_file(sharing_url: str) -> tuple[bytes, str, str]:
    """Resolve a SharePoint sharing URL and return (content_bytes, mime_type, filename)."""
    token = await _get_graph_token()

    # Encode the sharing URL per Graph API's u! scheme
    encoded = base64.urlsafe_b64encode(sharing_url.encode()).decode().rstrip("=")
    graph_id = f"u!{encoded}"

    async with httpx.AsyncClient(timeout=30) as client:
        r = await client.get(
            f"https://graph.microsoft.com/v1.0/shares/{graph_id}/driveItem",
            headers={"Authorization": f"Bearer {token}"},
        )
        if not r.is_success:
            raise HTTPException(
                400,
                f"Cannot access SharePoint file ({r.status_code}). "
                "Make sure the link has sharing enabled and the app has Files.Read.All permission.",
            )

        item = r.json()
        file_name = item.get("name", "artwork")
        mime_type = item.get("file", {}).get("mimeType", "image/jpeg")

        download_url = item.get("@microsoft.graph.downloadUrl")
        if not download_url:
            raise HTTPException(400, "Could not get a download URL from SharePoint.")

        file_r = await client.get(download_url, follow_redirects=True)
        file_r.raise_for_status()
        data = file_r.content

        if mime_type.startswith("image/") or mime_type == "application/pdf":
            return data, mime_type, file_name

        if mime_type == DOCX_MIME or file_name.lower().endswith(".docx"):
            extracted = extract_docx_image(data)
            if extracted:
                image_bytes, image_mime = extracted
                return image_bytes, image_mime, file_name
            raise HTTPException(
                400,
                f"'{file_name}' is a Word document with no embedded image found. "
                "Insert/paste the artwork as a picture inside the doc, or export it as a "
                "JPEG/PNG/PDF and share that file instead.",
            )

        raise HTTPException(
            400,
            f"'{file_name}' is not a supported file type. Please share a JPEG, PNG, WEBP, PDF, "
            "or a Word document containing the artwork as an embedded image.",
        )

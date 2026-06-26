import json
import base64
import asyncio
import anthropic
from typing import Optional
from pydantic import BaseModel
from fastapi import APIRouter, UploadFile, File, HTTPException
from app.config import settings
from app import dropbox as dropbox_util

router = APIRouter()

PROOF_PROMPT = """You are a regulatory compliance expert for Halo Private Label, a nutraceutical company.
Analyze the uploaded packaging artwork image against FDA dietary supplement labeling requirements and Halo's internal design guidelines.

Return ONLY a JSON object with this exact structure (no other text):
{
  "panel_detected": "front" | "back" | "both" | "unclear",
  "overall_pass": true | false,
  "summary": "One sentence overall assessment",
  "checks": [
    {
      "id": "check_id",
      "label": "Check Label",
      "group": "front" | "back" | "claims",
      "status": "pass" | "fail" | "warning" | "not_applicable",
      "finding": "What you found or did not find in the image",
      "recommendation": "What needs to be fixed, or empty string if pass"
    }
  ]
}

Evaluate every check below. If a panel is not visible in the image, mark its checks as "not_applicable".

--- FRONT PANEL CHECKS ---
1. id: front_identity | label: Statement of Identity
   MUST display product type e.g. "Electrolyte Powder Supplement" prominently on the front.

2. id: front_net_weight | label: Net Weight Statement
   MUST display net weight e.g. "Net WT. 13G (0.45 OZ)".

3. id: front_flavor_name | label: Flavor Name
   MUST display a specific flavor name e.g. "Yuzu", "Lemon Lime", "Watermelon".

4. id: front_flavor_statement | label: Flavor Statement Placement
   MUST show "flavored with other natural flavors" (or equivalent) placed DIRECTLY underneath the flavor name.

5. id: front_flavor_font | label: Flavor Statement Font Size
   Flavor statement font MUST be at least half the size of the flavor name font.

--- BACK PANEL CHECKS ---
6. id: back_sfp | label: Supplement Facts Panel
   MUST include a full Supplement Facts Panel with ingredient list.

7. id: back_upc | label: UPC Barcode
   Required if product is for retail resale. Note if present or absent.

8. id: back_suggested_use | label: Suggested Use Instructions
   MUST include directions like "Mix one stick with 8-16oz of cold water and shake well".

9. id: back_storage | label: Storage Instructions
   MUST include "Store in a cool, dry place."

10. id: back_made_for | label: Made For Statement
    MUST include client company name and registered business address.

11. id: back_manufactured_by | label: Manufactured By Statement
    MUST say exactly: "Manufactured By: HALO Lifestyle LLC, 64 Bleecker Street, Unit 184, New York, NY 10012"

12. id: back_origin | label: Origin Statement
    MUST include "MADE IN USA – WORLDWIDE INGREDIENTS".

13. id: back_manufacturing_statement | label: Mandatory Manufacturing Statement
    MUST include the Halo mandatory manufacturing compliance statement/logo.

--- CLAIMS COMPLIANCE CHECKS ---
14. id: claims_no_medical | label: No Unapproved Medical Claims
    FAIL if any disease treatment/cure/prevention claims are present.

15. id: claims_no_trademarks | label: No Unauthorized Trademarks
    FAIL if third-party brand names, trademarks, or copyrighted taglines are used without authorization.

16. id: claims_regulatory_complete | label: All Regulatory Elements Present
    PASS only if all required elements for the visible panels are accounted for.

Be precise. Use "warning" when text is partially visible or ambiguous."""


async def _analyze(content: list) -> dict:
    """Send content blocks to Claude and return parsed compliance JSON."""
    try:
        client = anthropic.AsyncAnthropic(api_key=settings.anthropic_api_key)
        response = await client.messages.create(
            model=settings.anthropic_model,
            max_tokens=4096,
            messages=[{"role": "user", "content": content}],
        )
        text = response.content[0].text if response.content else ""
    except Exception as e:
        raise HTTPException(500, f"AI analysis failed: {str(e)}")

    try:
        start = text.find("{")
        end = text.rfind("}") + 1
        result = json.loads(text[start:end]) if start >= 0 and end > start else {}
    except Exception:
        result = {}

    if not result.get("checks"):
        result = {
            "panel_detected": "unclear",
            "overall_pass": False,
            "summary": "Could not analyze the image. Please try again with a clearer image.",
            "checks": [],
        }

    return result


ALLOWED_TYPES = {"image/jpeg", "image/png", "image/webp", "image/gif", "application/pdf"}


def _content_block(data: bytes, mime_type: str) -> dict:
    b64 = base64.standard_b64encode(data).decode()
    if mime_type == "application/pdf":
        return {"type": "document", "source": {"type": "base64", "media_type": "application/pdf", "data": b64}}
    return {"type": "image", "source": {"type": "base64", "media_type": mime_type, "data": b64}}


async def _read_panel(upload: UploadFile, label: str) -> tuple[bytes, str]:
    if not upload.content_type or upload.content_type not in ALLOWED_TYPES:
        raise HTTPException(400, f"{label} must be an image (JPEG, PNG, WEBP) or a PDF")
    data = await upload.read()
    if len(data) > 20 * 1024 * 1024:
        raise HTTPException(400, f"{label} file must be under 20MB")
    return data, upload.content_type


# ── File upload endpoint ─────────────────────────────────────────────────────

@router.post("")
async def proof_artwork(
    front_file: Optional[UploadFile] = File(None),
    back_file: Optional[UploadFile] = File(None),
    combined_file: Optional[UploadFile] = File(None),
):
    if not front_file and not back_file and not combined_file:
        raise HTTPException(400, "Upload at least one panel image/PDF (front, back, or combined)")

    content = []
    db_tasks = []

    if combined_file:
        data, mime = await _read_panel(combined_file, "Combined")
        content += [{"type": "text", "text": "[COMBINED FRONT + BACK PANELS]"}, _content_block(data, mime)]
        db_tasks.append(dropbox_util.upload_file(data, combined_file.filename or "combined", mime, "combined"))
    if front_file:
        data, mime = await _read_panel(front_file, "Front")
        content += [{"type": "text", "text": "[FRONT PANEL]"}, _content_block(data, mime)]
        db_tasks.append(dropbox_util.upload_file(data, front_file.filename or "front", mime, "front"))
    if back_file:
        data, mime = await _read_panel(back_file, "Back")
        content += [{"type": "text", "text": "[BACK PANEL]"}, _content_block(data, mime)]
        db_tasks.append(dropbox_util.upload_file(data, back_file.filename or "back", mime, "back"))

    content.append({"type": "text", "text": PROOF_PROMPT})

    # Run Claude analysis + Dropbox uploads concurrently
    analysis_task = _analyze(content)
    results = await asyncio.gather(analysis_task, *db_tasks, return_exceptions=True)

    if isinstance(results[0], Exception):
        err = results[0]
        detail = err.detail if hasattr(err, "detail") else str(err)
        result = {"panel_detected": "unclear", "overall_pass": False, "summary": detail, "checks": []}
    else:
        result = results[0]
    uploads = [r for r in results[1:] if isinstance(r, dict)]
    if uploads:
        result["dropbox_uploads"] = uploads
    return result


# ── SharePoint endpoint ──────────────────────────────────────────────────────

class SharePointProofRequest(BaseModel):
    front_url:    str = ""
    back_url:     str = ""
    combined_url: str = ""


@router.post("/sharepoint")
async def proof_from_sharepoint(req: SharePointProofRequest):
    if not req.front_url and not req.back_url and not req.combined_url:
        raise HTTPException(400, "Provide at least one SharePoint URL (front, back, or combined)")

    from app.routers.sharepoint import fetch_file

    content = []
    db_tasks = []

    if req.combined_url:
        data, mime, name = await fetch_file(req.combined_url)
        content += [{"type": "text", "text": "[COMBINED FRONT + BACK PANELS]"}, _content_block(data, mime)]
        db_tasks.append(dropbox_util.upload_file(data, name, mime, "combined"))
    if req.front_url:
        data, mime, name = await fetch_file(req.front_url)
        content += [{"type": "text", "text": "[FRONT PANEL]"}, _content_block(data, mime)]
        db_tasks.append(dropbox_util.upload_file(data, name, mime, "front"))
    if req.back_url:
        data, mime, name = await fetch_file(req.back_url)
        content += [{"type": "text", "text": "[BACK PANEL]"}, _content_block(data, mime)]
        db_tasks.append(dropbox_util.upload_file(data, name, mime, "back"))

    content.append({"type": "text", "text": PROOF_PROMPT})

    results = await asyncio.gather(_analyze(content), *db_tasks, return_exceptions=True)
    if isinstance(results[0], Exception):
        err = results[0]
        detail = err.detail if hasattr(err, "detail") else str(err)
        result = {"panel_detected": "unclear", "overall_pass": False, "summary": detail, "checks": []}
    else:
        result = results[0]
    uploads = [r for r in results[1:] if isinstance(r, dict)]
    if uploads:
        result["dropbox_uploads"] = uploads
    return result

import json
from google import genai
from google.genai import types
from fastapi import APIRouter, UploadFile, File, HTTPException
from app.config import settings

# --- Anthropic (commented out — using Gemini instead) ---
# import base64
# from app.ai import get_client
#
# async def _proof_with_anthropic(content: bytes, media_type: str) -> str:
#     b64 = base64.standard_b64encode(content).decode("utf-8")
#     client = get_client()
#     response = await client.messages.create(
#         model=settings.anthropic_model,
#         max_tokens=2048,
#         messages=[{"role": "user", "content": [
#             {"type": "image", "source": {"type": "base64", "media_type": media_type, "data": b64}},
#             {"type": "text", "text": PROOF_PROMPT},
#         ]}],
#     )
#     return response.content[0].text if response.content else ""

router = APIRouter()

PROOF_PROMPT = """You are a regulatory compliance expert for Halo Private Label, a nutraceutical company.
Analyze the uploaded packaging artwork image against FDA dietary supplement labeling requirements and Halo's internal design guidelines.

Return ONLY a JSON object with this exact structure (no other text):
{
  "panel_detected": "front" | "back" | "both" | "unclear",
  "overall_pass": true | false,
  "summary": "One sentence overall assessment",
  "checks": [
    {`
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


def _get_gemini():
    return genai.Client(api_key=settings.gemini_api_key)


@router.post("")
async def proof_artwork(file: UploadFile = File(...)):
    if not file.content_type or not file.content_type.startswith("image/"):
        raise HTTPException(400, "File must be an image (JPEG, PNG, WEBP, or GIF)")

    content = await file.read()
    if len(content) > 20 * 1024 * 1024:
        raise HTTPException(400, "Image must be under 20MB")

    try:
        import asyncio
        client = _get_gemini()
        response = await asyncio.to_thread(
            client.models.generate_content,
            model=settings.gemini_model,
            contents=[
                types.Part.from_bytes(data=content, mime_type=file.content_type),
                PROOF_PROMPT,
            ],
        )
        text = response.text
    except Exception as e:
        raise HTTPException(500, f"AI analysis failed: {str(e)}")

    try:
        start = text.find('{')
        end = text.rfind('}') + 1
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

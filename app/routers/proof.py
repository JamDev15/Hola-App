import json
import base64
import asyncio
import anthropic
from typing import Optional
from pydantic import BaseModel
from fastapi import APIRouter, UploadFile, File, HTTPException, Form
from app.config import settings
from app import dropbox as dropbox_util
from app.docx_utils import DOCX_MIME, describe_docx_media, extract_docx_image

router = APIRouter()

FORMULATION_REFERENCE = """--- HALO FORMULATION REFERENCE DATA (Designer Formulations Portfolio, June 2026) ---
Use this table to cross-check Supplement Facts Panel values against the correct formulation when an HPL Code is visible on the artwork. Only report a mismatch when you can clearly read the conflicting value on the artwork itself — never guess or infer a code that isn't shown.

HSV0 | High Sodium V0 | Serving ~7g | Sodium 500mg, Magnesium 100mg, Potassium 200mg, Calcium 30mg
HSV1 | High Sodium V1 | Serving ~10g | Sodium 750mg, Chloride 1,048mg, Magnesium 50mg, Potassium 200mg, Vitamin C 76mg, Niacin 24.9mg, B6 2.53mg, B12 10mcg, Pantothenic Acid 11.7mg, L-Alanine 1,200mg, L-Glutamine 1,200mg
HSV2 | High Sodium V2 | Serving ~7g | Sodium 1,000mg, Magnesium 100mg, Potassium 200mg, Calcium 30mg
EMSF | Electrolyte Multiplier Sugar Free | Serving 1 stick (9g) | Sodium 460mg, Chloride 572mg, Potassium 200mg, Vitamin C 76mg, Niacin 24.9mg, B6 2.53mg, B12 10mcg, Pantothenic Acid 11.7mg, L-Alanine 1,200mg, L-Glutamine 1,200mg
MUD | Multi-Use Daily | Serving ~5g | Sodium 80mg, Potassium 200mg, Calcium 60mg, Magnesium 100mg, Zinc 3mg, Selenium 35mcg, Manganese 1mg, Vitamin C 80mg, Thiamin B1 0.45mg, Niacin 5mg, B6 1.4mg, Folate 33mcg, B12 2mcg, Pantothenic Acid 3mg
H+CM(5)-CL | Hydration + Creatine Monohydrate (5g) Clean Label | Serving ~8g | Sodium 300mg, Potassium 260mg, Magnesium 40mg, Calcium 30mg, Vitamin C 90mg, B6 1.6mg, B12 6mcg, Creatine Monohydrate 5,000mg
HSV2+CM(5)-CL | High Sodium V2 + Creatine (5g) Clean Label | Serving ~13g | Sodium 1,000mg, Magnesium 100mg, Potassium 200mg, Calcium 30mg, Creatine Monohydrate 5,000mg
H+BCAA+C | Hydration + BCAA + Creatine | Serving ~20g | Sodium 110mg, Vitamin C 60mg, D3 15mcg, B6 2mg, Folic Acid 0.4mg, B12 1mcg, Creatine Monohydrate 2,000mg, Betaine Anhydrous 2,000mg, L-Leucine 600mg, L-Isoleucine 300mg, L-Valine 300mg
H+Carn+C | Hydration + L-Carnitine + Creatine | Serving ~15g | Sodium 550mg, Potassium 400mg, Magnesium 30mg, Vitamin C 90mg, D3 15mcg, B6 2mg, B9 0.4mg, B12 1mcg, Creatine Monohydrate 5,000mg, Acetyl L-Carnitine HCl 500mg, L-Leucine 2,000mg, L-Isoleucine 500mg, L-Valine 500mg
H+Coff | Hydration + Coffee | Serving 1 stick pack (8g) | Sodium 260mg, Potassium 200mg, Calcium 60mg, Magnesium 100mg, Zinc 3mg, Manganese 1mg, Vitamin C 90mg, Thiamin 0.45mg, Niacin 5mg, B6 1.4mg, B12 2.4mcg, Pantothenic Acid 3mg, Caffeine Blend 65mg (35mg coffee powder + 30mg anhydrous), Calories 30, Total Fat 1.5g, Total Carbohydrate 4g, Total Sugars 1g
H+C(95)+C(5) | Hydration + Creatine Monohydrate + Caffeine | Serving ~8g | Sodium 300mg, Potassium 260mg, Magnesium 40mg, Calcium 30mg, Vitamin C 92mg, B6 1.5mg, B12 6mcg, Creatine Monohydrate 5,000mg, Caffeine Anhydrous 95mg
H+C+C-CL | Hydration + Creatine Monohydrate + Caffeine Clean Label | Serving ~9g | Sodium 260mg, Potassium 200mg, Magnesium 40mg, Calcium 62mg, Creatine Monohydrate 5,000mg, Caffeine (from green tea extract) 95mg
HSV2-CT | Hydration + Citicoline (200mg) | Serving ~7g | Sodium 1,000mg, Magnesium 100mg, Potassium 200mg, Calcium 30mg, Citicoline 200mg
HSV2-LC | Hydration + L-Citrulline (2g) | Serving ~7g | Sodium 1,000mg, Magnesium 100mg, Potassium 200mg, Calcium 30mg, L-Citrulline 2,000mg
H+LTHN | Hydration + L-Theanine Clean Label | Serving ~6g | Sodium 300mg, Potassium 150mg, Magnesium 40mg, Calcium 30mg, Vitamin C 60mg, L-Theanine 200mg
H+CAF+LTHN | Hydration + Caffeine + L-Theanine | Serving ~6g | Sodium 300mg, Potassium 150mg, Magnesium 40mg, Calcium 30mg, Vitamin C 60mg, Caffeine (from green tea extract) 95mg, L-Theanine 200mg
H+CAF+CL | Hydration + Caffeine Clean Label | Serving ~8-9g | Sodium 500mg, Magnesium 100mg, Potassium 200mg, Calcium 30mg, Caffeine (from green tea extract) 95mg
EMSF+COLL | Hydration + Collagen | Serving ~14g | Sodium 460mg (full ingredient breakdown not yet finalized — verify against the latest approved SFP before flagging)
ORS | Oral Rehydration Solution | Serving ~9g dissolved in 500ml water | Sodium 900mg, Chloride 1,385mg, Potassium 390mg, Dextrose 7,000mg, Total Carbohydrate 7g, Total Sugars 7g, Calories 30

If the artwork's HPL Code is not in this table, or no code is visible, do not fail the accuracy check — mark it "warning" and note the formulation could not be verified against the reference portfolio."""

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
      "group": "front" | "back" | "claims" | "quality",
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

14. id: back_sfp_accuracy | label: Supplement Facts Accuracy vs. Formulation
    Identify the HPL Code printed on the artwork (if any) and cross-check every numeric value on the Supplement Facts Panel — serving size, sodium, and all key actives — against that formulation in the reference data below. FAIL if any value visibly conflicts with the reference. WARNING if the HPL code isn't visible/legible or doesn't match a known formulation. PASS only if every value matches.

--- CLAIMS COMPLIANCE CHECKS ---
15. id: claims_no_medical | label: No Unapproved Medical Claims
    FAIL if any disease treatment/cure/prevention claims are present.

16. id: claims_no_trademarks | label: No Unauthorized Trademarks
    FAIL if third-party brand names, trademarks, or copyrighted taglines are used without authorization.

17. id: claims_regulatory_complete | label: All Regulatory Elements Present
    PASS only if all required elements for the visible panels are accounted for.

--- QUALITY CHECKS ---
18. id: quality_spelling | label: Spelling & Text Accuracy
    Read every word of visible text on the artwork character by character — headlines, ingredient names, statements, taglines, footers. FAIL if you find any misspelled word, typo, or inconsistent product/ingredient naming. Quote the exact incorrect text in "finding" and give the corrected spelling in "recommendation". PASS only if you have read all visible text and found no errors.

19. id: quality_spacing | label: Text Spacing & Layout
    Examine letter spacing, line spacing, margins, and element alignment throughout the artwork. FAIL if text is cramped, overlapping, unevenly spaced, or misaligned in a way that would look unprofessional in print. WARNING for minor inconsistencies. PASS if spacing and alignment are clean and consistent.

Be precise. Use "warning" when text is partially visible or ambiguous.

""" + FORMULATION_REFERENCE

REVISION_PROMPT_TEMPLATE = """You are a SENIOR FDA regulatory compliance expert and packaging artwork proofer with 20+ years in nutraceutical supplement labeling. You are conducting Revision Round {round} of this artwork analysis — your findings are final before this label goes to press.

PREVIOUS ANALYSIS (Round {prev_round}):
{previous_findings}

YOUR MISSION FOR ROUND {round}:
1. Every check marked "warning" MUST now become "pass" or "fail" — look harder, be definitive
2. Every check marked "pass" — confirm it is genuinely correct, not assumed
3. Every check marked "fail" — verify the violation is real, correct it if you were wrong
4. Search for anything the previous round missed entirely
5. Scrutinize fine print, small fonts, partial visibility, and cut-off edges with maximum precision

Eliminate ALL uncertainty. You are the final expert authority. Pay particular attention to: supplement facts numeric accuracy against the reference formulation data below, exact spelling of every visible word, and consistent text spacing/alignment.

Return ONLY a JSON object (no other text):
{{
  "panel_detected": "front" | "back" | "both" | "unclear",
  "overall_pass": true | false,
  "summary": "Concise Round {round} assessment",
  "checks": [
    {{
      "id": "check_id",
      "label": "Check Label",
      "group": "front" | "back" | "claims" | "quality",
      "status": "pass" | "fail" | "warning" | "not_applicable",
      "finding": "What you confirmed or corrected in Round {round}",
      "recommendation": "What needs fixing, or empty string if pass"
    }}
  ]
}}

Use the SAME check IDs from the previous round. Re-evaluate every single check.

{formulation_reference}"""

VERIFY_PROMPT = """You are a meticulous print-production quality controller for Halo Private Label, a nutraceutical company. This is the LAST check before a packaging artwork file is sent to the manufacturer for print.

You will be shown two versions of the same packaging artwork, each panel labeled:
- APPROVED VERSION — already passed compliance review and was signed off internally.
- FINAL PROOF VERSION — the exact file about to be sent to the manufacturer.

Your job: compare each matching panel pixel-by-pixel in substance and confirm they are IDENTICAL, or flag every difference no matter how small — text changes, spelling, numbers/values (especially Supplement Facts amounts), colors, spacing, layout shifts, missing/added elements, image or flavor swaps, font changes, barcode changes.

Return ONLY a JSON object with this exact structure (no other text):
{
  "identical": true | false,
  "summary": "One sentence overall verdict",
  "differences": [
    {
      "location": "Where on the artwork this occurs, e.g. 'Supplement Facts Panel — Sodium amount' or 'Front Panel — Flavor Name'",
      "approved": "What the APPROVED version shows at that location",
      "final": "What the FINAL PROOF version shows at that location",
      "severity": "critical" | "minor"
    }
  ]
}

Rules:
- If a panel present in the approved version has no matching panel in the final proof (or vice versa), report that as a "critical" difference with location describing which panel is missing.
- Use "critical" for anything that changes meaning, compliance, or safety (ingredient amounts, claims, statements, barcodes, flavor name). Use "minor" for purely cosmetic differences (slight color shift, whitespace).
- Be extremely thorough — do not assume something is unchanged without checking it directly against the approved version.
- If truly identical in every respect, return "identical": true and an empty differences array."""


async def _call_claude_json(content: list) -> dict:
    """Send content blocks to Claude and return parsed JSON (or {} if parsing fails)."""
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
        return json.loads(text[start:end]) if start >= 0 and end > start else {}
    except Exception:
        return {}


async def _analyze(content: list) -> dict:
    """Send content blocks to Claude and return parsed compliance JSON."""
    result = await _call_claude_json(content)

    if not result.get("checks"):
        result = {
            "panel_detected": "unclear",
            "overall_pass": False,
            "summary": "Could not analyze the image. Please try again with a clearer image.",
            "checks": [],
        }

    return result


async def _verify(content: list) -> dict:
    """Send content blocks to Claude and return parsed final-proof-verification JSON."""
    result = await _call_claude_json(content)

    if "identical" not in result:
        result = {
            "identical": False,
            "summary": "Could not verify the final proof. Please try again with clearer images.",
            "differences": [],
        }

    return result


ALLOWED_TYPES = {"image/jpeg", "image/png", "image/webp", "image/gif", "application/pdf", DOCX_MIME}


def _content_block(data: bytes, mime_type: str) -> dict:
    b64 = base64.standard_b64encode(data).decode()
    if mime_type == "application/pdf":
        return {"type": "document", "source": {"type": "base64", "media_type": "application/pdf", "data": b64}}
    return {"type": "image", "source": {"type": "base64", "media_type": mime_type, "data": b64}}


async def _read_panel(upload: UploadFile, label: str) -> tuple[bytes, str]:
    if not upload.content_type or upload.content_type not in ALLOWED_TYPES:
        raise HTTPException(400, f"{label} must be an image (JPEG, PNG, WEBP), a PDF, or a Word document containing the artwork image")
    data = await upload.read()
    if len(data) > 20 * 1024 * 1024:
        raise HTTPException(400, f"{label} file must be under 20MB")

    if upload.content_type == DOCX_MIME:
        extracted = extract_docx_image(data)
        if not extracted:
            raise HTTPException(400, f"{label}: no usable embedded image — {describe_docx_media(data)}. Export the artwork as a JPEG/PNG/PDF instead.")
        return extracted

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


# ── Revision endpoint ────────────────────────────────────────────────────────

@router.post("/revise")
async def revise_proof(
    round: int = Form(2),
    previous_findings: str = Form(...),
    front_file: Optional[UploadFile] = File(None),
    back_file: Optional[UploadFile] = File(None),
    combined_file: Optional[UploadFile] = File(None),
):
    if not front_file and not back_file and not combined_file:
        raise HTTPException(400, "Re-upload at least one panel image for revision")
    if round < 2 or round > 3:
        raise HTTPException(400, "Revision round must be 2 or 3")

    try:
        prev = json.loads(previous_findings)
    except Exception:
        raise HTTPException(400, "Invalid previous_findings JSON")

    content = []
    if combined_file:
        data, mime = await _read_panel(combined_file, "Combined")
        content += [{"type": "text", "text": "[COMBINED FRONT + BACK PANELS]"}, _content_block(data, mime)]
    if front_file:
        data, mime = await _read_panel(front_file, "Front")
        content += [{"type": "text", "text": "[FRONT PANEL]"}, _content_block(data, mime)]
    if back_file:
        data, mime = await _read_panel(back_file, "Back")
        content += [{"type": "text", "text": "[BACK PANEL]"}, _content_block(data, mime)]

    prompt = REVISION_PROMPT_TEMPLATE.format(
        round=round,
        prev_round=round - 1,
        previous_findings=json.dumps(prev, indent=2),
        formulation_reference=FORMULATION_REFERENCE,
    )
    content.append({"type": "text", "text": prompt})

    result = await _analyze(content)
    result["revision_round"] = round
    return result


# ── Final proof verification endpoint ───────────────────────────────────────

@router.post("/verify")
async def verify_final_proof(
    approved_front_file:    Optional[UploadFile] = File(None),
    approved_back_file:     Optional[UploadFile] = File(None),
    approved_combined_file: Optional[UploadFile] = File(None),
    final_front_file:       Optional[UploadFile] = File(None),
    final_back_file:        Optional[UploadFile] = File(None),
    final_combined_file:    Optional[UploadFile] = File(None),
):
    if not (approved_front_file or approved_back_file or approved_combined_file):
        raise HTTPException(400, "Upload the approved artwork to compare against")
    if not (final_front_file or final_back_file or final_combined_file):
        raise HTTPException(400, "Upload the final proof file to verify")

    approved_blocks = []
    if approved_combined_file:
        data, mime = await _read_panel(approved_combined_file, "Approved combined")
        approved_blocks += [{"type": "text", "text": "[APPROVED — COMBINED FRONT + BACK]"}, _content_block(data, mime)]
    if approved_front_file:
        data, mime = await _read_panel(approved_front_file, "Approved front")
        approved_blocks += [{"type": "text", "text": "[APPROVED — FRONT PANEL]"}, _content_block(data, mime)]
    if approved_back_file:
        data, mime = await _read_panel(approved_back_file, "Approved back")
        approved_blocks += [{"type": "text", "text": "[APPROVED — BACK PANEL]"}, _content_block(data, mime)]

    final_blocks = []
    if final_combined_file:
        data, mime = await _read_panel(final_combined_file, "Final proof combined")
        final_blocks += [{"type": "text", "text": "[FINAL PROOF — COMBINED FRONT + BACK]"}, _content_block(data, mime)]
    if final_front_file:
        data, mime = await _read_panel(final_front_file, "Final proof front")
        final_blocks += [{"type": "text", "text": "[FINAL PROOF — FRONT PANEL]"}, _content_block(data, mime)]
    if final_back_file:
        data, mime = await _read_panel(final_back_file, "Final proof back")
        final_blocks += [{"type": "text", "text": "[FINAL PROOF — BACK PANEL]"}, _content_block(data, mime)]

    # 1) Diff the final proof against the approved version
    diff_content = [{"type": "text", "text": "=== APPROVED VERSION (already signed off) ==="}]
    diff_content += approved_blocks
    diff_content.append({"type": "text", "text": "=== FINAL PROOF VERSION (about to be sent to production) ==="})
    diff_content += final_blocks
    diff_content.append({"type": "text", "text": VERIFY_PROMPT})

    # 2) Independently re-run the full compliance check (spelling, spacing, all 19 checks)
    #    against the final proof file itself, in case anything slipped in during file prep
    compliance_content = list(final_blocks) + [{"type": "text", "text": PROOF_PROMPT}]

    diff_result, compliance_result = await asyncio.gather(
        _verify(diff_content),
        _analyze(compliance_content),
    )
    diff_result["finalComplianceCheck"] = compliance_result
    return diff_result

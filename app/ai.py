import asyncio
from google import genai
from google.genai import types
from app.config import settings

# --- Anthropic (commented out — using Gemini instead) ---
# import anthropic
# _client: anthropic.AsyncAnthropic | None = None
# def get_client() -> anthropic.AsyncAnthropic:
#     global _client
#     if _client is None:
#         _client = anthropic.AsyncAnthropic(api_key=settings.anthropic_api_key)
#     return _client


def _get_gemini() -> genai.Client:
    return genai.Client(api_key=settings.gemini_api_key)


SYSTEM_PROMPT = (
    "You are a senior production routing strategist at Halo, a nutraceutical and dietary supplement company. "
    "Your role is to evaluate incoming production orders and issue clear, actionable routing decisions to the operations team. "
    "Your recommendations must be grounded in co-packer capabilities, available capacity, cost efficiency, reliability track record, and batching potential. "
    "Write in a professional, executive tone — structured, direct, and decision-ready. No filler. Every sentence must add value."
)


async def get_recommendation(order: dict, co_packers: list, active_orders: list) -> str:
    """Call Gemini and return the routing recommendation text."""
    co_packer_context = "\n\n".join(
        f"### {cp['name']}\n"
        f"- Location: {cp['location']}\n"
        f"- Specialties: {', '.join(cp.get('specialties', [])) or 'General'}\n"
        f"- Total Capacity: {cp['capacity']:,} units\n"
        f"- Current Load: {cp.get('currentLoad', 0):,} units\n"
        f"- Available Capacity: {cp['capacity'] - cp.get('currentLoad', 0):,} units\n"
        f"- Notes/Capabilities: {cp.get('notes') or 'No additional notes'}"
        for cp in co_packers
    )

    orders_context = "\n".join(
        f"- Client: {o['clientName']} | Formula: {o['formula']} | "
        f"SKU: {o['sku']} | Qty: {o['quantity']:,} | "
        f"Status: {o['status']} | Co-Packer: {o.get('assignedCoPacker') or 'Unassigned'}"
        for o in active_orders
    ) if active_orders else "No active orders currently."

    prompt = f"""{SYSTEM_PROMPT}

## New Order
- **Client:** {order['clientName']}
- **Formula:** {order['formula']}
- **SKU / Flavor:** {order['sku']}
- **Quantity:** {order['quantity']:,} units
- **Notes:** {order.get('notes') or 'None'}

---

## Available Co-Packers

{co_packer_context}

---

## Existing Active Orders (for batching analysis)

{orders_context}

---

Deliver your routing decision using the following structure exactly:

──────────────────────────────────────────
ROUTING DECISION
──────────────────────────────────────────

RECOMMENDED CO-PACKER: [Full co-packer name]
TIER CLASSIFICATION: [Their tier e.g. A / B / B-Test / Test]
CONFIDENCE: [High / Medium / Low] — [One sentence justifying confidence level]

RATIONALE:
[3–4 sentences. Cover: why this co-packer is the best fit for this specific formula/SKU, how their capacity and specialties align, and why alternatives were deprioritized.]

──────────────────────────────────────────
BATCHING ANALYSIS
──────────────────────────────────────────

BATCHING OPPORTUNITY: [Yes / No]
[If Yes: Name the specific existing order(s) to batch with, the co-packer, estimated efficiency gain, and any scheduling considerations.
If No: Briefly state why no batching opportunity exists.]

──────────────────────────────────────────
OPERATIONAL FLAGS
──────────────────────────────────────────

[List 2–4 concise bullet points covering: MOQ considerations, special handling or formula requirements, reliability or lead-time risks, actions required before production can begin, or anything the ops team needs to verify or resolve.]

──────────────────────────────────────────
RECOMMENDED NEXT STEP
──────────────────────────────────────────

[One clear, direct sentence stating exactly what the operations team should do next to move this order forward.]"""

    client = _get_gemini()
    response = await asyncio.to_thread(
        client.models.generate_content,
        model=settings.gemini_model,
        contents=[types.Part.from_text(text=prompt)],
    )

    return response.text if response.text else ""

from datetime import datetime, timezone
from fastapi import APIRouter
from app.database import get_db

router = APIRouter()


@router.post("")
async def seed_database():
    db = get_db()
    now = datetime.now(timezone.utc).isoformat()

    # Clear existing data (filter required by Supabase REST API)
    await db.table("orders").delete().gte("created_at", "1900-01-01").execute()
    await db.table("copackers").delete().gte("created_at", "1900-01-01").execute()
    await db.table("formulas").delete().gte("created_at", "1900-01-01").execute()

    # Seed Co-Packers
    await db.table("copackers").insert([
        {
            "name": "NutraCo Manufacturing",
            "location": "Salt Lake City, UT",
            "specialties": ["softgels", "capsules", "powders", "GMP certified"],
            "capacity": 500000,
            "current_load": 180000,
            "is_active": True,
            "created_at": now, "updated_at": now,
            "notes": (
                "NutraCo is our primary high-volume partner for softgel and capsule formats. "
                "They operate a fully NSF GMP-certified facility with cGMP compliance.\n"
                "Specialties include: fish oil softgels, vitamin blends, probiotic capsules, and multi-ingredient powders.\n"
                "Equipment: 10 encapsulation lines, 2 softgel lines, 4 powder blending suites.\n"
                "Lead time: 3-4 weeks for standard runs; 6-8 weeks for new formulas.\n"
                "MOQ: 10,000 units per SKU.\n"
                "Contact: ops@nutraco.com | QC manager: Sarah L.\n"
                "Notes: Preferred for HSV1 and any omega-3-based formulas. They have cold storage for sensitive ingredients."
            ),
        },
        {
            "name": "VitaForm Labs",
            "location": "Austin, TX",
            "specialties": ["tablets", "chewables", "gummies", "sports nutrition", "GMP certified"],
            "capacity": 300000,
            "current_load": 95000,
            "is_active": True,
            "created_at": now, "updated_at": now,
            "notes": (
                "VitaForm specializes in tablet compression, chewable vitamins, and gummy manufacturing.\n"
                "Specialties: vitamin C tablets, zinc chewables, creatine powders, pre-workout blends, collagen gummies.\n"
                "Equipment: 6 tablet presses, 3 gummy lines, custom coating drum for sugar-coated tablets.\n"
                "Lead time: 2-3 weeks standard. Rush available at +20% cost.\n"
                "MOQ: 5,000 units for gummies; 25,000 for tablets.\n"
                "Contact: production@vitaformlabs.com\n"
                "Notes: Best choice for HSV2 and any gummy or chewable format. Dedicated allergen-free suite."
            ),
        },
        {
            "name": "PurePack Solutions",
            "location": "Phoenix, AZ",
            "specialties": ["liquids", "tinctures", "sachets", "stick packs", "custom packaging"],
            "capacity": 200000,
            "current_load": 40000,
            "is_active": True,
            "created_at": now, "updated_at": now,
            "notes": (
                "PurePack is our go-to for liquid formulations, tinctures, and stick packs/sachets.\n"
                "Specialties: liquid vitamins, herbal tinctures, electrolyte sachets, single-serve stick packs.\n"
                "Equipment: 4 liquid filling lines (5mL–1L), 2 sachet/stick pack lines, in-house label application.\n"
                "Lead time: 3-5 weeks. They allow partial batch runs.\n"
                "MOQ: 2,500 units for liquids; 10,000 for sachets.\n"
                "Contact: scheduling@purepack.com | Account Rep: Mike T.\n"
                "Notes: Only co-packer with liquid capabilities. Use for HSV3 or any liquid-format SKU."
            ),
        },
    ]).execute()

    # Seed Formulas
    await db.table("formulas").insert([
        {
            "name": "HSV1",
            "description": "Core omega-3 fatty acid formula with EPA/DHA blend. Flagship product line.",
            "special_requirements": "Requires cold storage during manufacturing. Fish allergen declaration mandatory. GMP-certified facility with third-party testing required.",
            "skus": [
                {"name": "HSV1-OmegaCore-60ct", "description": "Omega-3 fish oil 1000mg softgels, 60 count bottle"},
                {"name": "HSV1-OmegaCore-120ct", "description": "Omega-3 fish oil 1000mg softgels, 120 count bottle"},
                {"name": "HSV1-OmegaCore-Lemon", "description": "Lemon-flavored omega-3 softgels, 60 count"},
            ],
            "created_at": now, "updated_at": now,
        },
        {
            "name": "HSV2",
            "description": "Comprehensive multivitamin line targeting adult, children, and gummy formats.",
            "special_requirements": "Children's formulas require additional QA sign-off. Gummy line must use dedicated suite. All SKUs require USP dissolution testing.",
            "skus": [
                {"name": "HSV2-MultiMax-Adult", "description": "Complete multivitamin tablet, 30-day supply"},
                {"name": "HSV2-MultiMax-Kids-Cherry", "description": "Children's chewable multivitamin, cherry flavor, 60ct"},
                {"name": "HSV2-MultiMax-Gummy-Mixed", "description": "Adult gummy multivitamin, mixed fruit, 90ct"},
            ],
            "created_at": now, "updated_at": now,
        },
        {
            "name": "HSV3",
            "description": "Electrolyte replenishment formula in sachet/stick pack format.",
            "special_requirements": "Sachet packaging only. Moisture-barrier foil required. Flavor batch segregation mandatory.",
            "skus": [
                {"name": "HSV3-ElectroLift-Berry", "description": "Electrolyte + vitamin C sachets, berry flavor, 30ct"},
                {"name": "HSV3-ElectroLift-Citrus", "description": "Electrolyte + vitamin C sachets, citrus flavor, 30ct"},
                {"name": "HSV3-ElectroLift-Unflavored", "description": "Unflavored electrolyte stick packs, 20ct"},
            ],
            "created_at": now, "updated_at": now,
        },
    ]).execute()

    # Seed Orders
    await db.table("orders").insert([
        {
            "client_name": "Apex Wellness Brands",
            "formula": "HSV1",
            "sku": "HSV1-OmegaCore-60ct",
            "quantity": 50000,
            "notes": "Rush order — needed for Q2 retail launch.",
            "assigned_co_packer": "NutraCo Manufacturing",
            "status": "in-production",
            "batched_with": None,
            "ai_recommendation": (
                "**RECOMMENDED CO-PACKER:** NutraCo Manufacturing\n"
                "**REASON:** NutraCo is the ideal fit for this omega-3 softgel order. They have dedicated softgel "
                "production lines and cold storage required for HSV1, with 320,000 units of available capacity.\n\n"
                "**BATCHING OPPORTUNITY:** No\n"
                "**BATCHING DETAILS:** N/A\n\n"
                "**FLAGS / NOTES:**\n"
                "- Rush timeline: coordinate with NutraCo scheduling immediately to secure slot.\n"
                "- Confirm cold chain logistics from NutraCo to Apex's warehouse."
            ),
            "created_at": now, "updated_at": now,
        },
        {
            "client_name": "GreenLeaf Nutrition",
            "formula": "HSV2",
            "sku": "HSV2-MultiMax-Gummy-Mixed",
            "quantity": 25000,
            "notes": "Standard reorder. No changes to formula.",
            "assigned_co_packer": "VitaForm Labs",
            "status": "pending",
            "batched_with": None,
            "ai_recommendation": (
                "**RECOMMENDED CO-PACKER:** VitaForm Labs\n"
                "**REASON:** VitaForm's dedicated gummy lines and allergen-free suite make them the definitive "
                "choice for HSV2 gummy SKUs. 205,000 units of available capacity handles this reorder easily.\n\n"
                "**BATCHING OPPORTUNITY:** No\n"
                "**BATCHING DETAILS:** N/A\n\n"
                "**FLAGS / NOTES:**\n"
                "- Standard reorder, no expediting needed.\n"
                "- Confirm shelf life dating requirements before production start."
            ),
            "created_at": now, "updated_at": now,
        },
    ]).execute()

    return {
        "success": True,
        "message": "Database seeded successfully",
        "counts": {"coPackers": 3, "formulas": 3, "orders": 2},
    }

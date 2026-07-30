from app.core.database import supabase


async def getFAQs() -> list:
    try:
        result = (
            supabase.table("faq")
            .select("*")
            .order("display_order")
            .execute()
        )
        return result.data or []
    except Exception:
        return []

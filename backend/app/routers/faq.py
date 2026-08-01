from fastapi import APIRouter

from app.services import faq_service

router = APIRouter(prefix="/faq", tags=["FAQ"])


@router.get("")
async def getFAQs():
    result = await faq_service.getFAQs()
    visible = [f for f in result if f.get("is_visible", True)]
    return {"faqs": visible}

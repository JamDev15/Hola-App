import io
import zipfile
from typing import Optional

DOCX_MIME = "application/vnd.openxmlformats-officedocument.wordprocessingml.document"

_IMAGE_EXT_MIME = {
    "png": "image/png",
    "jpg": "image/jpeg",
    "jpeg": "image/jpeg",
    "gif": "image/gif",
}


def extract_docx_image(data: bytes) -> Optional[tuple[bytes, str]]:
    """Pull the largest embedded image out of a .docx file (a .docx is a zip archive).

    Returns (image_bytes, mime_type), or None if no usable embedded image is found.
    Word also embeds vector formats (.emf/.wmf) and small decorative assets — picking
    the largest raster image by file size reliably targets the actual artwork over icons/logos.
    """
    try:
        with zipfile.ZipFile(io.BytesIO(data)) as z:
            candidates = [
                (info, info.filename.rsplit(".", 1)[-1].lower())
                for info in z.infolist()
                if info.filename.startswith("word/media/")
            ]
            candidates = [(info, ext) for info, ext in candidates if ext in _IMAGE_EXT_MIME]
            if not candidates:
                return None
            best_info, best_ext = max(candidates, key=lambda c: c[0].file_size)
            return z.read(best_info.filename), _IMAGE_EXT_MIME[best_ext]
    except zipfile.BadZipFile:
        return None


def describe_docx_media(data: bytes) -> str:
    """Diagnostic summary of what's embedded in word/media/, for error messages when extraction fails."""
    try:
        with zipfile.ZipFile(io.BytesIO(data)) as z:
            names = sorted(
                info.filename.rsplit("/", 1)[-1]
                for info in z.infolist()
                if info.filename.startswith("word/media/")
            )
    except zipfile.BadZipFile:
        return "the file could not be read as a Word document (it may be corrupted or not a real .docx)"

    if not names:
        return (
            "no embedded media was found at all — the artwork may be linked rather than "
            "embedded, or inserted as an object without a raster preview"
        )
    return (
        f"found embedded file(s) {', '.join(names)}, but none are a supported raster image "
        "(PNG/JPG/GIF) — likely a vector preview (EMF/WMF) of an embedded object like an "
        "Illustrator file, which can't be read directly"
    )

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

_IMAGE_MAGIC = (
    (b"\x89PNG\r\n\x1a\n", "image/png"),
    (b"\xff\xd8\xff", "image/jpeg"),
    (b"GIF87a", "image/gif"),
    (b"GIF89a", "image/gif"),
)


def sniff_image_mime(data: bytes) -> Optional[str]:
    for magic, mime in _IMAGE_MAGIC:
        if data.startswith(magic):
            return mime
    if data[:4] == b"RIFF" and data[8:12] == b"WEBP":
        return "image/webp"
    return None


def verified_image_mime(data: bytes, claimed_mime: str) -> str:
    """Never trust a self-reported/inferred mime type for image bytes — Claude's API hard-rejects
    any mismatch between the declared media type and the actual file signature. Both Graph API
    metadata and file extensions inside a .docx have been observed mislabeling PNGs as JPEG."""
    sniffed = sniff_image_mime(data)
    return sniffed if sniffed else claimed_mime


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
            image_bytes = z.read(best_info.filename)
            return image_bytes, verified_image_mime(image_bytes, _IMAGE_EXT_MIME[best_ext])
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

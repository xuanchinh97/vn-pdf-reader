import re
import unicodedata
from typing import Dict, List, Tuple

# ============================================================================
# 1. BẢNG MÃ TCVN3 (ABC) -> UNICODE
# ============================================================================
TCVN3_CHARS = (
    "µ¸¶·¹"
    "¨»¾¼½Æ"
    "©ÇÊÈÉË"
    "®"
    "ÌÐÎÏÑ"
    "ªÒÕÓÔÖ"
    "×ÝØÜÞ"
    "ßãáâä"
    "«åèæçé"
    "¬êíëìî"
    "ïóñòô"
    "­õøö÷ù"
    "úýûüþ"
    "¡¢£¤¥¦§"
)

UNICODE_FROM_TCVN3 = (
    "àáảãạ"
    "ăằắẳẵặ"
    "âầấẩẫậ"
    "đ"
    "èéẻẽẹ"
    "êềếểễệ"
    "ìíỉĩị"
    "òóỏõọ"
    "ôồốổỗộ"
    "ơờớởỡợ"
    "ùúủũụ"
    "ưừứửữự"
    "ỳýỷỹỵ"
    "ĂÂÊÔƠƯĐ"
)

TCVN3_MAP: Dict[str, str] = dict(zip(TCVN3_CHARS, UNICODE_FROM_TCVN3))

# Pattern nhận diện ký tự ĐẶC TRƯNG RIÊNG của TCVN3 (không trùng với nguyên âm Unicode tiếng Việt)
TCVN3_EXCLUSIVE_RE = re.compile(
    r"[µ¸¶·¹¨»¾¼½Æ©ÇÊÈÉË®ÌÐÎÏÑªÒÕÓÔÖ×ØÜÞß«åæç¬­õøö÷þ¡¢£¤¥¦§]"
)
UNICODE_VN_EXTENDED_RE = re.compile(
    r"[\u0102\u0103\u0110\u0111\u01a0\u01a1\u01af\u01b0\u1ea0-\u1ef9]"
)


def is_likely_tcvn3(text: str) -> bool:
    """Kiểm tra xem văn bản có dấu hiệu sử dụng bảng mã TCVN3 (ABC) hay không."""
    if not text or len(text) < 5:
        return False
    # Nếu văn bản có ký tự replacement \ufffd hỏng font nặng thì không coi là TCVN3
    if text.count("\ufffd") >= 2:
        return False
    # Nếu đã có các ký tự tiếng Việt Unicode mở rộng (ă, đ, ơ, ư, ạ, ả, ấ, ệ...) thì chắc chắn là Unicode
    unicode_vn_count = len(UNICODE_VN_EXTENDED_RE.findall(text))
    tcvn3_excl_count = len(TCVN3_EXCLUSIVE_RE.findall(text))
    if unicode_vn_count > tcvn3_excl_count:
        return False
    words = max(1, len(text.split()))
    return tcvn3_excl_count >= 2 and (tcvn3_excl_count / words) > 0.06


def convert_tcvn3_to_unicode(text: str) -> str:
    """Chuyển đổi văn bản từ bảng mã TCVN3 sang Unicode dựng sẵn (NFC)."""
    def _convert_token(token: str) -> str:
        return "".join(TCVN3_MAP.get(ch, ch) for ch in token)

    converted = "".join(TCVN3_MAP.get(ch, ch) for ch in text)
    return unicodedata.normalize("NFC", converted)


# ============================================================================
# 2. BẢNG MÃ VNI-WINDOWS -> UNICODE
# ============================================================================
VNI_REPLACEMENTS = [
    # Triphthongs & Diphthongs với dấu thanh đặt đúng âm chính
    ("u7o7i1", "ưới"), ("u7o7i2", "ười"), ("u7o7i3", "ưởi"), ("u7o7i4", "ưỡi"), ("u7o7i5", "ượi"),
    ("U7O7I1", "ƯỚI"), ("U7O7I2", "ƯỜI"), ("U7O7I3", "ƯỞI"), ("U7O7I4", "ƯỠI"), ("U7O7I5", "ƯỢI"),
    ("u7o7u1", "ướu"), ("u7o7u2", "ườu"), ("u7o7u3", "ưởu"), ("u7o7u4", "ưỡi"), ("u7o7u5", "ượu"),
    ("U7O7U1", "ƯỚU"), ("U7O7U2", "ƯỜU"), ("U7O7U3", "ƯỞU"), ("U7O7U4", "ƯỠI"), ("U7O7U5", "ƯỢU"),
    ("u7o7", "ươ"), ("U7O7", "ƯƠ"),
    # Diphthong ay + số
    ("ay1", "áy"), ("ay2", "ày"), ("ay3", "ảy"), ("ay4", "ãy"), ("ay5", "ạy"),
    ("Ay1", "Áy"), ("Ay2", "Ày"), ("Ay3", "Ảy"), ("Ay4", "Ãy"), ("Ay5", "Ạy"),
    ("AY1", "ÁY"), ("AY2", "ÀY"), ("AY3", "ẢY"), ("AY4", "ÃY"), ("AY5", "ẠY"),
    # Cụm 3 ký tự (chữ + mũ + dấu thanh)
    ("a81", "ắ"), ("a82", "ằ"), ("a83", "ẳ"), ("a84", "ẵ"), ("a85", "ặ"), ("a8", "ă"),
    ("A81", "Ắ"), ("A82", "Ằ"), ("A83", "Ẳ"), ("A84", "Ẵ"), ("A85", "Ặ"), ("A8", "Ă"),
    ("a61", "ấ"), ("a62", "ầ"), ("a63", "ẩ"), ("a64", "ẫ"), ("a65", "ậ"), ("a6", "â"),
    ("A61", "Ấ"), ("A62", "Ầ"), ("A63", "Ẩ"), ("A64", "Ẫ"), ("A65", "Ậ"), ("A6", "Â"),
    ("e61", "ế"), ("e62", "ề"), ("e63", "ể"), ("e64", "ễ"), ("e65", "ệ"), ("e6", "ê"),
    ("E61", "Ế"), ("E62", "Ề"), ("E63", "Ể"), ("E64", "Ễ"), ("E65", "Ệ"), ("E6", "Ê"),
    ("o61", "ố"), ("o62", "ồ"), ("o63", "ổ"), ("o64", "ỗ"), ("o65", "ộ"), ("o6", "ô"),
    ("O61", "Ố"), ("O62", "Ồ"), ("O63", "Ổ"), ("O64", "Ỗ"), ("O65", "Ộ"), ("O6", "Ô"),
    ("o71", "ớ"), ("o72", "ờ"), ("o73", "ở"), ("o74", "ỡ"), ("o75", "ợ"), ("o7", "ơ"),
    ("O71", "Ớ"), ("O72", "Ờ"), ("O73", "Ở"), ("O74", "Ỡ"), ("O75", "Ợ"), ("O7", "Ơ"),
    ("u71", "ứ"), ("u72", "ừ"), ("u73", "ử"), ("u74", "ữ"), ("u75", "ự"), ("u7", "ư"),
    ("U71", "Ứ"), ("U72", "Ừ"), ("U73", "Ử"), ("U74", "Ữ"), ("U75", "Ự"), ("U7", "Ư"),
    ("d9", "đ"), ("D9", "Đ"),
    # Cụm nguyên âm + dấu thanh trực tiếp
    ("a1", "á"), ("a2", "à"), ("a3", "ả"), ("a4", "ã"), ("a5", "ạ"),
    ("A1", "Á"), ("A2", "À"), ("A3", "Ả"), ("A4", "Ã"), ("A5", "Ạ"),
    ("e1", "é"), ("e2", "è"), ("e3", "ẻ"), ("e4", "ẽ"), ("e5", "ẹ"),
    ("E1", "É"), ("E2", "È"), ("E3", "Ẻ"), ("E4", "Ẽ"), ("E5", "Ẹ"),
    ("i1", "í"), ("i2", "ì"), ("i3", "ỉ"), ("i4", "ĩ"), ("i5", "ị"),
    ("I1", "Í"), ("I2", "Ì"), ("I3", "Ỉ"), ("I4", "Ĩ"), ("I5", "Ị"),
    ("o1", "ó"), ("o2", "ò"), ("o3", "ỏ"), ("o4", "õ"), ("o5", "ọ"),
    ("O1", "Ó"), ("O2", "Ò"), ("O3", "Ỏ"), ("O4", "Õ"), ("O5", "Ọ"),
    ("u1", "ú"), ("u2", "ù"), ("u3", "ủ"), ("u4", "ũ"), ("u5", "ụ"),
    ("U1", "Ú"), ("U2", "Ù"), ("U3", "Ủ"), ("U4", "Ũ"), ("U5", "Ụ"),
    ("y1", "ý"), ("y2", "ỳ"), ("y3", "ỷ"), ("y4", "ỹ"), ("y5", "ỵ"),
    ("Y1", "Ý"), ("Y2", "Ỳ"), ("Y3", "Ỷ"), ("Y4", "Ỹ"), ("Y5", "Ỵ"),
]

# Ánh xạ dấu thanh tiếng Việt cho âm tiết có số ở cuối (VNI whole-syllable tone)
TONE_MAP = {
    "1": "\u0301",  # sắc
    "2": "\u0300",  # huyền
    "3": "\u0309",  # hỏi
    "4": "\u0303",  # ngã
    "5": "\u0323",  # nặng
}

VNI_WIN1252_TOKEN_RE = re.compile(
    r"\b[a-zA-Z]*(?:[aeouAEOU][678][1-5]?|[aeiouyAEIOUY][1-5]|[dD]9)[a-zA-Z]*\b"
)


def is_likely_vni(text: str) -> bool:
    """Kiểm tra xem văn bản có dấu hiệu bảng mã VNI hay không."""
    if not text or len(text) < 5:
        return False
    matches = VNI_WIN1252_TOKEN_RE.findall(text)
    words = max(1, len(text.split()))
    return len(matches) >= 2 and (len(matches) / words) > 0.05


def _convert_vni_syllable(word: str) -> str:
    """Chuyển đổi một từ VNI, xử lý cả số diacritics và số tone ở đuôi từ."""
    # Bỏ qua mã kỹ thuật thuần túy như MP3, B52, A4, COVID19
    if re.fullmatch(r"[A-Z]+\d+", word) and word not in ("D9", "d9"):
        return word

    res = word
    # Bước 1: Thay thế các quy tắc ký tự VNI trực tiếp
    for src, dst in VNI_REPLACEMENTS:
        if src in res:
            res = res.replace(src, dst)

    # Bước 2: Nếu cuối từ vẫn còn số tone (1-5), đặt dấu thanh vào nguyên âm chính
    match_end_tone = re.search(r"([a-zA-ZăâđêôơưĂÂĐÊÔƠƯ]+)([1-5])$", res)
    if match_end_tone:
        base_letters, tone_num = match_end_tone.group(1), match_end_tone.group(2)
        comb_mark = TONE_MAP.get(tone_num, "")
        if comb_mark:
            # Tìm nguyên âm chính để đặt dấu
            vowels = "ăâêôơưaeiouyĂÂÊÔƠƯAEIOUY"
            target_idx = -1
            # Ưu tiên đặt dấu vào ơ/ê/ô/ư/â/ă nếu có
            for i, ch in enumerate(base_letters):
                if ch in "ăâêôơưĂÂÊÔƠƯ":
                    target_idx = i
                    break
            if target_idx == -1:
                # Nếu không có mũ, đặt vào nguyên âm cuối hoặc áp chót
                vowel_indices = [i for i, ch in enumerate(base_letters) if ch in vowels]
                if vowel_indices:
                    if len(vowel_indices) >= 2 and base_letters.endswith(("i", "u", "y", "o")):
                        target_idx = vowel_indices[-2]
                    else:
                        target_idx = vowel_indices[-1]

            if target_idx != -1:
                res = (
                    base_letters[: target_idx + 1]
                    + comb_mark
                    + base_letters[target_idx + 1 :]
                )
            else:
                res = base_letters + comb_mark

    return unicodedata.normalize("NFC", res)


def convert_vni_to_unicode(text: str) -> str:
    """Chuyển đổi văn bản từ bảng mã VNI sang Unicode dựng sẵn (NFC)."""
    converted = re.sub(r"\b[a-zA-Z0-9ăâđêôơưĂÂĐÊÔƠƯ]+\b", lambda m: _convert_vni_syllable(m.group(0)), text)
    return unicodedata.normalize("NFC", converted)


# ============================================================================
# 3. SỬA LỖI MOJIBAKE & DẤU RỜI RẠC
# ============================================================================
MOJIBAKE_RE = re.compile(r"(?:Ã[\x80-\xbf]|áº|á»|Æ°|Æ¡|Ä‘|Ä\x90)")


def fix_mojibake(text: str) -> Tuple[str, bool]:
    """Khôi phục văn bản UTF-8 tiếng Việt bị giải mã nhầm sang Latin-1 / CP1252."""
    if not text or not MOJIBAKE_RE.search(text):
        return text, False

    for enc in ("latin1", "cp1252"):
        try:
            recovered = text.encode(enc).decode("utf-8")
            if recovered != text:
                return unicodedata.normalize("NFC", recovered), True
        except Exception:
            continue
    return text, False


def fix_detached_diacritics(text: str) -> str:
    """
    Sửa lỗi phổ biến trong PDF tiếng Việt khi dấu kết hợp (combining marks)
    bị tách khỏi nguyên âm bởi khoảng trắng hoặc ký tự zero-width, hoặc spacing accents.
    """
    if not text:
        return ""

    # Chuẩn hóa khoảng trắng không ngắt \xa0 thành khoảng trắng thông thường
    text = text.replace("\xa0", " ")

    # Sửa lỗi ký tự archaic \u01a3 (ƣ) và \u01a2 (Ƣ) phổ biến trong ebook vnthuquan/vnoffice thay cho ư và Ư
    text = text.replace("\u01a3", "ư").replace("\u01a2", "Ư")

    # Loại bỏ zero-width spaces / soft hyphens làm đứt từ tiếng Việt
    text = re.sub(r"[\u200b\u200c\u200d\ufeff\u00ad]", "", text)

    # Gộp các dấu combining (U+0300 - U+036F) bị cách khoảng trắng sau nguyên âm
    text = re.sub(
        r"([a-zA-ZăâđêôơưĂÂĐÊÔƠƯáàảãạắằẳẵặấầẩẫậéèẻẽẹếềểễệíìỉĩịóòỏõọốồổỗộớờởỡợúùủũụứừửữựýỳỷỹỵ])\s+([\u0300-\u036f]+)",
        r"\1\2",
        text,
    )

    # Ký tự dấu rời rạc (spacing accents) thường xuất hiện trong PDF TeX/Mac
    spacing_accent_map = {
        "\u00b4": "\u0301",  # acute / sắc
        "\u02ca": "\u0301",
        "\u0060": "\u0300",  # grave / huyền
        "\u02cb": "\u0300",
        "\u02c6": "\u0302",  # circumflex / mũ
        "\u02dc": "\u0303",  # tilde / ngã
        "\u02d8": "\u0306",  # breve / trăng (ă)
        "\u02c0": "\u0309",  # hook / hỏi
        "\u02d9": "\u0323",  # dot below / nặng
    }
    for sp_acc, comb_acc in spacing_accent_map.items():
        if sp_acc in text:
            text = re.sub(
                rf"([aeiouyAEIOUYăâêôơưĂÂÊÔƠƯáàảãạéèẻẽẹíìỉĩịóòỏõọúùủũụýỳỷỹỵ]){re.escape(sp_acc)}",
                rf"\1{comb_acc}",
                text,
            )

    return unicodedata.normalize("NFC", text)


EBOOK_TYPOS: List[Tuple[re.Pattern, str]] = [
    (re.compile(r"\bnhà dầu\b", re.IGNORECASE), "nhà đầu"),
    (re.compile(r"\bvốn dầu\b", re.IGNORECASE), "vốn đầu"),
    (re.compile(r"\bdầu tư\b", re.IGNORECASE), "đầu tư"),
    (re.compile(r"\btỉ dộng\b", re.IGNORECASE), "tỉ đồng"),
    (re.compile(r"\bdộng của\b", re.IGNORECASE), "đồng của"),
    (re.compile(r"\bVà dây cũng là\b", re.IGNORECASE), "Và đây cũng là"),
    (re.compile(r"\bchửng khoán\b", re.IGNORECASE), "chứng khoán"),
    (re.compile(r"\bróc vào\b", re.IGNORECASE), "rót vào"),
    (re.compile(r"\bdang xuất hiện\b", re.IGNORECASE), "đang xuất hiện"),
    (re.compile(r"\bước lính\b", re.IGNORECASE), "ước tính"),
    (re.compile(r"\bdược bơm\b", re.IGNORECASE), "được bơm"),
    (re.compile(r"\bdược xây\b", re.IGNORECASE), "được xây"),
    (re.compile(r"\bdược dàn dựng\b", re.IGNORECASE), "được dàn dựng"),
    (re.compile(r"\bdược róc\b", re.IGNORECASE), "được rót"),
    (re.compile(r"\bthị trờng\b", re.IGNORECASE), "thị trường"),
]


def fix_ebook_typos(text: str) -> str:
    """Tự động sửa các lỗi chính tả OCR/đánh máy phổ biến trong các sách ebook cũ."""
    res = text
    for pat, rep in EBOOK_TYPOS:
        res = pat.sub(rep, res)
    return res


# ============================================================================
# 4. ĐÁNH GIÁ CHẤT LƯỢNG VĂN BẢN & PHÁT HIỆN CẦN OCR
# ============================================================================
VIETNAMESE_VOWELS = set(
    "aăâeêioôơuưyAĂÂEÊIOÔƠUƯY"
    "áàảãạắằẳẵặấầẩẫậéèẻẽẹếềểễệíìỉĩịóòỏõọốồổỗộớờởỡợúùủũụứừửữựýỳỷỹỵ"
    "ÁÀẢÃẠẮẰẲẴẶẤẦẨẪẬÉÈẺẼẸẾỀỂỄỆÍÌỈĨỊÓÒỎÕỌỐỒỔỖỘỚỜỞỠỢÚÙỦŨỤỨỪỬỮỰÝỲỶỸỴ"
)


def evaluate_text_quality(text: str) -> Dict[str, object]:
    stripped = text.strip()
    if not stripped or len(stripped) < 15:
        return {
            "quality_score": 0.0,
            "needs_ocr": True,
            "reason": "Trang không có lớp văn bản (PDF dạng ảnh scan) hoặc quá ít chữ.",
        }

    total_chars = len(stripped)
    bad_chars = sum(
        1
        for ch in stripped
        if ch == "\ufffd"
        or ("\ue000" <= ch <= "\uf8ff")
        or (ord(ch) < 32 and ch not in ("\n", "\r", "\t"))
    )

    weird_symbols = sum(
        1
        for ch in stripped
        if ch in "¤§¨°±²³µ¶·¸¹º»¼½¾¿×÷ØøÞþÐð"
    )

    bad_ratio = (bad_chars + weird_symbols) / max(1, total_chars)
    if bad_chars >= 2 or bad_ratio > 0.04:
        return {
            "quality_score": round(max(0.0, 1.0 - bad_ratio * 5), 2),
            "needs_ocr": True,
            "reason": f"Phát hiện ký tự lỗi bảng mã / mất CMap ({bad_chars + weird_symbols} ký tự lỗi).",
        }

    alpha_words = re.findall(r"[a-zA-ZÀ-ỹ]{2,}", stripped)
    if len(alpha_words) >= 5:
        valid_vowel_words = sum(
            1 for w in alpha_words if any(ch in VIETNAMESE_VOWELS for ch in w)
        )
        vowel_word_ratio = valid_vowel_words / len(alpha_words)
        if vowel_word_ratio < 0.55:
            return {
                "quality_score": round(vowel_word_ratio, 2),
                "needs_ocr": True,
                "reason": "Phát hiện cấu trúc từ bị hỏng nặng do lỗi font PDF nội bộ.",
            }

    return {
        "quality_score": 0.98,
        "needs_ocr": False,
        "reason": "Văn bản rõ ràng, đạt chuẩn đọc TTS.",
    }


# ============================================================================
# 5. LÀM SẠCH DÒNG, NỐI CÂU & TÁCH CÂU
# ============================================================================
PAGE_NUMBER_LINE_RE = re.compile(
    r"^\s*(?:[-–—]?\s*\d{1,4}\s*[-–—]?|(?:trang|page)\s+\d{1,4}(?:\s*/\s*\d{1,4})?)\s*$",
    re.IGNORECASE,
)

SENTENCE_END_PUNCT = (".", "!", "?", ":", ";", "…", '"', "”", "’", ")")
BULLET_START_RE = re.compile(r"^\s*(?:[-•*+▪▸►]|\d+[\.\)]|[a-zA-Z][\.\)]|[IVXLCDM]+[\.\)])\s+")


def clean_and_unwrap_lines(raw_text: str) -> str:
    if not raw_text:
        return ""

    lines = [line.strip() for line in raw_text.splitlines()]
    while lines and not lines[0]:
        lines.pop(0)
    while lines and not lines[-1]:
        lines.pop()

    if lines and PAGE_NUMBER_LINE_RE.match(lines[0]):
        lines.pop(0)
    if lines and PAGE_NUMBER_LINE_RE.match(lines[-1]):
        lines.pop()

    paragraphs: List[str] = []
    current_para = ""

    for line in lines:
        line = re.sub(r"[ \t]+", " ", line).strip()
        if not line:
            if current_para:
                paragraphs.append(current_para)
                current_para = ""
            continue

        line = re.sub(r"\.{4,}\s*\d*$", "", line).strip()
        if not line:
            continue

        if not current_para:
            current_para = line
            continue

        if BULLET_START_RE.match(line):
            paragraphs.append(current_para)
            current_para = line
            continue

        if current_para.endswith("-") and len(current_para) > 2 and current_para[-2].isalpha():
            current_para = current_para[:-1] + line
            continue

        if not current_para.endswith(SENTENCE_END_PUNCT):
            current_para += " " + line
        else:
            if line[0].islower():
                current_para += " " + line
            else:
                paragraphs.append(current_para)
                current_para = line

    if current_para:
        paragraphs.append(current_para)

    return "\n\n".join(paragraphs)


def split_into_sentences(clean_text: str, max_len: int = 260) -> List[str]:
    if not clean_text or not clean_text.strip():
        return []

    protected = clean_text
    abbrevs = ["Tp.", "TP.", "ThS.", "TS.", "PGS.", "GS.", "BS.", "KS.", "CN.", "Mr.", "Mrs.", "Dr.", "St."]
    for abbr in abbrevs:
        protected = protected.replace(abbr, abbr[:-1] + "<DOT>")

    # Bảo vệ số thứ tự đầu dòng (VD: "1. ", "2. ", "10. ") không bị tách rời thành câu chỉ có "2."
    protected = re.sub(r"(^|\n)(\s*\d{1,3})\.(?=\s+)", r"\1\2<DOT>", protected)

    raw_paragraphs = [p.strip() for p in protected.split("\n") if p.strip()]
    sentences: List[str] = []

    for para in raw_paragraphs:
        parts = re.split(r"(?<=[.!?…;])\s+", para)
        for part in parts:
            restored = part.replace("<DOT>", ".").strip()
            if not restored:
                continue
            if len(restored) > max_len:
                sub_parts = re.split(r"(?<=[,:])\s+", restored)
                buf = ""
                for sp in sub_parts:
                    if len(buf) + len(sp) + 1 <= max_len:
                        buf = f"{buf} {sp}".strip() if buf else sp
                    else:
                        if buf:
                            sentences.append(buf)
                        buf = sp
                if buf:
                    sentences.append(buf)
            else:
                sentences.append(restored)

    return sentences


def process_vietnamese_pdf_text(
    raw_text: str, force_mode: str = "auto"
) -> Dict[str, object]:
    if not raw_text:
        return {
            "text": "",
            "sentences": [],
            "encoding_detected": "empty",
            "quality_score": 0.0,
            "needs_ocr": True,
            "reason": "Trang PDF không có lớp văn bản (cần quét OCR).",
        }

    text = raw_text
    encoding_detected = "unicode"

    # Bước 1: Sửa lỗi Mojibake
    text, was_mojibake = fix_mojibake(text)
    if was_mojibake:
        encoding_detected = "mojibake"

    # Bước 2: Phát hiện và chuyển mã TCVN3 / VNI
    if force_mode == "tcvn3" or (force_mode == "auto" and is_likely_tcvn3(text)):
        text = convert_tcvn3_to_unicode(text)
        encoding_detected = "tcvn3"
    elif force_mode == "vni" or (force_mode == "auto" and is_likely_vni(text)):
        text = convert_vni_to_unicode(text)
        encoding_detected = "vni"

    # Bước 3: Sửa dấu rời rạc & chuẩn hóa NFC
    text = fix_detached_diacritics(text)
    text = fix_ebook_typos(text)

    # Bước 4: Nối dòng
    clean_text = clean_and_unwrap_lines(text)

    # Bước 5: Đánh giá chất lượng
    quality = evaluate_text_quality(clean_text)

    # Bước 6: Tách câu
    sentences = split_into_sentences(clean_text)

    # Xác định lý do trạng thái chính xác
    if quality["needs_ocr"]:
        reason = str(quality["reason"])
    elif encoding_detected == "tcvn3":
        reason = "Đã tự động chuyển mã từ TCVN3 (ABC) sang Unicode."
    elif encoding_detected == "vni":
        reason = "Đã tự động chuyển mã từ VNI-Windows sang Unicode."
    elif encoding_detected == "mojibake":
        reason = "Đã tự động khôi phục lỗi giải mã UTF-8 (Mojibake)."
    else:
        reason = str(quality["reason"])

    return {
        "text": clean_text,
        "sentences": sentences,
        "encoding_detected": encoding_detected,
        "quality_score": quality["quality_score"],
        "needs_ocr": quality["needs_ocr"],
        "reason": reason,
    }

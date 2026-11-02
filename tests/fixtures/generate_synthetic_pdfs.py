"""
Script tạo các file PDF giả lập để kiểm thử toàn diện các trường hợp lỗi font và cấu trúc:
1. Standard Unicode (Tiếng Việt chuẩn có cấu trúc trang, header, footer, số trang)
2. TCVN3 (Bảng mã ABC cũ)
3. VNI-Windows (Bảng mã số VNI)
4. Detached Diacritics (Dấu thanh bị tách rời)
5. Mojibake (UTF-8 bị giải mã nhầm Latin-1)
6. Scanned Image PDF (Không có text layer, chỉ có ảnh raster)
7. Broken Font (Ký tự rác, thiếu ToUnicode CMap)
"""

import sys
from pathlib import Path
import unicodedata

try:
    if hasattr(sys.stdout, "reconfigure"):
        sys.stdout.reconfigure(encoding="utf-8", errors="replace")
except Exception:
    pass
import pymupdf as fitz
from PIL import Image, ImageDraw, ImageFont

FIXTURES_DIR = Path(__file__).parent / "sample_pdfs"
FIXTURES_DIR.mkdir(parents=True, exist_ok=True)


def create_standard_unicode_pdf() -> Path:
    """Tạo PDF chuẩn tiếng Việt với nhiều đoạn văn, header, footer và số trang."""
    filepath = FIXTURES_DIR / "standard_unicode.pdf"
    doc = fitz.open()
    fontfile = "C:/Windows/Fonts/arial.ttf" if Path("C:/Windows/Fonts/arial.ttf").exists() else None
    fontname = "arial" if fontfile else None

    for page_idx in range(1, 4):
        page = doc.new_page(width=595, height=842)  # A4

        # Header sát mép trên
        page.insert_textbox(
            fitz.Rect(50, 15, 545, 40),
            "CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM - TÀI LIỆU THỬ NGHIỆM",
            fontsize=9,
            fontfile=fontfile,
            fontname=fontname,
        )

        # Tiêu đề chính
        page.insert_textbox(
            fitz.Rect(50, 50, 545, 85),
            f"CHƯƠNG {page_idx}: KIỂM THỬ KHẢ NĂNG ĐỌC VĂN BẢN TIẾNG VIỆT",
            fontsize=15,
            fontfile=fontfile,
            fontname=fontname,
        )

        # Đoạn văn 1
        p1 = (
            "Hệ thống chuyển đổi văn bản sang giọng nói cần xử lý chính xác ngữ điệu tiếng Việt. "
            "Khi tài liệu có các từ viết tắt như Tp. Hồ Chí Minh, GS. TS. Nguyễn Văn A hay BS. Trần Thị B, "
            "thuật toán tách câu phải giữ nguyên ngữ cảnh mà không làm ngắt câu đột ngột."
        )
        page.insert_textbox(fitz.Rect(50, 95, 545, 175), p1, fontsize=12, fontfile=fontfile, fontname=fontname)

        # Danh sách gạch đầu dòng
        bullet_text = (
            "• Mục 1: Đánh giá độ trễ khi chuyển tiếp giữa các câu.\n"
            "• Mục 2: Kiểm tra độ chính xác của bộ đệm âm thanh tải trước.\n"
            "• Mục 3: Đảm bảo không bị mất dấu thanh khi xuất ra file MP3."
        )
        page.insert_textbox(fitz.Rect(50, 185, 545, 260), bullet_text, fontsize=11, fontfile=fontfile, fontname=fontname)

        # Đoạn văn 2 có dòng ngắt
        p2 = (
            "Dự án này hướng tới mục tiêu hỗ trợ người khiếm thị và người cần nghe tài liệu học tập, "
            "giúp việc tiếp cận tri thức từ các tệp PDF trở nên thuận tiện và dễ dàng hơn bao giờ hết."
        )
        page.insert_textbox(fitz.Rect(50, 270, 545, 340), p2, fontsize=12, fontfile=fontfile, fontname=fontname)

        # Footer sát mép dưới
        page.insert_textbox(
            fitz.Rect(250, 810, 350, 835),
            f"Trang {page_idx} / 3",
            fontsize=10,
            fontfile=fontfile,
            fontname=fontname,
        )

    doc.save(str(filepath))
    doc.close()
    return filepath


def create_tcvn3_pdf() -> Path:
    """Tạo PDF chứa văn bản dùng bảng mã TCVN3 (ABC)."""
    filepath = FIXTURES_DIR / "tcvn3_document.pdf"
    doc = fitz.open()
    page = doc.new_page(width=595, height=842)

    tcvn3_text = (
        "Céng hoµ x· héi chñ nghÜa ViÖt Nam\n"
        "§éc lËp - Tù do - H¹nh phóc\n\n"
        "Th«ng b¸o vÒ viÖc ¸p dông quy chÕ míi trong c«ng t¸c qu¶n lý v¨n b¶n.\n"
        "C¸c ®¬n vÞ cÇn nghiªm tóc thùc hiÖn theo ®óng híng dÉn cña cÊp trªn.\n"
        "Nh÷ng trêng hîp vi ph¹m sÏ bÞ xö lý nghiªm theo quy ®Þnh cña ph¸p luËt."
    )
    page.insert_textbox(fitz.Rect(50, 100, 545, 400), tcvn3_text, fontsize=13)
    doc.save(str(filepath))
    doc.close()
    return filepath


def create_vni_pdf() -> Path:
    """Tạo PDF chứa văn bản dùng bảng mã VNI."""
    filepath = FIXTURES_DIR / "vni_document.pdf"
    doc = fitz.open()
    page = doc.new_page(width=595, height=842)

    vni_text = (
        "Co65ng hoa2 xa4 ho65i chu3 nghi4a Vie65t Nam\n"
        "D9o65c la65p - Tu75 do - Ha5nh phu1c\n\n"
        "Chu1ng to6i xin tra6n tro5ng tho6ng ba1o ve62 du75 a1n mo71i.\n"
        "Mo5i tha1nh vie6n ca62n hoa2n tha2nh nhie65m vu5 d9u1ng tho72i ha5n."
    )
    page.insert_textbox(fitz.Rect(50, 100, 545, 400), vni_text, fontsize=13)
    doc.save(str(filepath))
    doc.close()
    return filepath


def create_detached_accents_pdf() -> Path:
    """Tạo PDF có dấu thanh bị rời rạc (combining diacritics cách khoảng) và ngắt dòng cứng."""
    filepath = FIXTURES_DIR / "detached_accents.pdf"
    doc = fitz.open()
    page = doc.new_page(width=595, height=842)

    # Viê\u0323t -> Vi\u1ec7t, ho\u0300a -> h\u00f2a
    bad_accent_text = (
        "Trang 5\n"
        "Ta\u0300i liê\u0323u na\u0300y co\u0301 ca\u0301c d\u1ea5u thanh bi\u0323 ta\u0301ch\n"
        "r\u1eddi r\u1ea1c gi\u1eefa nguy\u00ean \u00e2m v\u00e0 d\u1ea5u trong t\u1eebng d\u00f2ng.\n"
        "Ngo\u00e0i ra co\u0300n co\u0301 hi\u1ec7n t\u01b0\u1ee3ng ng\u1eaft do\u0300ng b\u1eeba\n"
        "b\u00e3i l\u00e0m gi\u1ecdng \u0111\u1ecdc b\u1ecb v\u1ea5p.\n"
        "- 5 -"
    )
    page.insert_textbox(fitz.Rect(50, 100, 545, 400), bad_accent_text, fontsize=13)
    doc.save(str(filepath))
    doc.close()
    return filepath


def create_scanned_image_pdf() -> Path:
    """Tạo PDF dạng scan (chỉ có ảnh bitmap thuần túy, không có text layer)."""
    filepath = FIXTURES_DIR / "scanned_image.pdf"

    # Tạo ảnh trắng có chữ vẽ bằng PIL
    img = Image.new("RGB", (1240, 1754), color=(255, 255, 255))
    draw = ImageDraw.Draw(img)
    # Vẽ vài dòng mô phỏng văn bản scan
    draw.text((100, 150), "CONG HOA XA HOI CHU NGHIA VIET NAM", fill=(20, 20, 20))
    draw.text((100, 220), "DOC LAP - TU DO - HANH PHUC", fill=(20, 20, 20))
    draw.text((100, 320), "Day la tai lieu scan mau khong co lop text goc.", fill=(20, 20, 20))
    draw.text((100, 390), "He thong se nhan dien needs_ocr = True.", fill=(20, 20, 20))

    img_bytes_stream = Path(FIXTURES_DIR / "temp_scan.png")
    img.save(str(img_bytes_stream), format="PNG")

    doc = fitz.open()
    page = doc.new_page(width=595, height=842)
    page.insert_image(page.rect, filename=str(img_bytes_stream))
    doc.save(str(filepath))
    doc.close()

    if img_bytes_stream.exists():
        img_bytes_stream.unlink()

    return filepath


def create_broken_font_pdf() -> Path:
    """Tạo PDF chứa ký tự rác (mất font map, chứa replacement char \ufffd hoặc PUA)."""
    filepath = FIXTURES_DIR / "broken_font.pdf"
    doc = fitz.open()
    page = doc.new_page(width=595, height=842)

    garbage_text = (
        "\ufffd\ufffd\ufffd \ue001\ue002\ue003 §¨©® "
        "th\ufffdng b\ufffd\ufffd v\ufffd vi\ufffdc h\ufffdng font "
        "k\ufffd t\ufffd r\ufffdc v\ufffd ngh\ufffda"
    )
    page.insert_textbox(fitz.Rect(50, 100, 545, 400), garbage_text, fontsize=13)
    doc.save(str(filepath))
    doc.close()
    return filepath


def create_standard_epub() -> Path:
    """Tạo sách điện tử EPUB tiếng Việt chuẩn với nhiều chương để kiểm thử."""
    import zipfile
    filepath = FIXTURES_DIR / "sample_book.epub"
    with zipfile.ZipFile(filepath, "w") as zf:
        zf.writestr("mimetype", "application/epub+zip")
        zf.writestr(
            "META-INF/container.xml",
            '<?xml version="1.0"?>\n'
            '<container version="1.0" xmlns="urn:oasis:names:tc:opendocument:xmlns:container">\n'
            '  <rootfiles>\n'
            '    <rootfile full-path="OEBPS/content.opf" media-type="application/oebps-package+xml"/>\n'
            '  </rootfiles>\n'
            '</container>',
        )
        zf.writestr(
            "OEBPS/content.opf",
            '<?xml version="1.0" encoding="utf-8"?>\n'
            '<package xmlns="http://www.idpf.org/2007/opf" version="2.0" unique-identifier="BookId">\n'
            '  <metadata xmlns:dc="http://purl.org/dc/elements/1.1/">\n'
            '    <dc:title>Sách Thử Nghiệm EPUB Tiếng Việt</dc:title>\n'
            '    <dc:language>vi</dc:language>\n'
            '    <dc:identifier id="BookId">urn:uuid:vn-pdf-reader-epub-test</dc:identifier>\n'
            '  </metadata>\n'
            '  <manifest>\n'
            '    <item id="ch1" href="ch1.xhtml" media-type="application/xhtml+xml"/>\n'
            '    <item id="ch2" href="ch2.xhtml" media-type="application/xhtml+xml"/>\n'
            '  </manifest>\n'
            '  <spine>\n'
            '    <itemref idref="ch1"/>\n'
            '    <itemref idref="ch2"/>\n'
            '  </spine>\n'
            '</package>',
        )
        zf.writestr(
            "OEBPS/ch1.xhtml",
            '<?xml version="1.0" encoding="utf-8"?>\n'
            '<!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.1//EN" "http://www.w3.org/TR/xhtml11/DTD/xhtml11.dtd">\n'
            '<html xmlns="http://www.w3.org/1999/xhtml">\n'
            '<head><title>Chương 1</title></head>\n'
            '<body>\n'
            '  <h1>Chương 1: Bình Minh Mới</h1>\n'
            '  <p>Đây là cuốn sách điện tử định dạng EPUB được mở trực tiếp bằng PyMuPDF.</p>\n'
            '  <p>Văn bản tiếng Việt dàn trang mượt mà không bị ngắt dòng khó chịu như file PDF in ấn.</p>\n'
            '</body>\n'
            '</html>',
        )
        zf.writestr(
            "OEBPS/ch2.xhtml",
            '<?xml version="1.0" encoding="utf-8"?>\n'
            '<!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.1//EN" "http://www.w3.org/TR/xhtml11/DTD/xhtml11.dtd">\n'
            '<html xmlns="http://www.w3.org/1999/xhtml">\n'
            '<head><title>Chương 2</title></head>\n'
            '<body>\n'
            '  <h1>Chương 2: Khám Phá Tri Thức</h1>\n'
            '  <p>Hệ thống hỗ trợ đọc giọng AI Kokoro và Edge Neural trên cả file EPUB này.</p>\n'
            '</body>\n'
            '</html>',
        )
    return filepath


def create_standard_txt() -> Path:
    """Tạo tệp văn bản TXT tiếng Việt chuẩn để kiểm thử phân trang và trích xuất."""
    filepath = FIXTURES_DIR / "sample_document.txt"
    content = (
        "Chương 1: Mở Đầu Cuốn Sách TXT\n\n"
        "Đây là tệp văn bản thô tiếng Việt định dạng TXT.\n"
        "Văn bản được phân trang tự động và hỗ trợ giọng đọc AI trơn tru.\n\n"
        "Chương 2: Kết Nối Tương Lai\n\n"
        "Hệ thống tự động phát hiện mã hóa và xử lý tiếng Việt hoàn hảo.\n"
    )
    filepath.write_text(content, encoding="utf-8")
    return filepath


def create_encrypted_pdf() -> Path:
    """Tạo file PDF có đặt mật khẩu bảo vệ (User Password) để kiểm thử mở khóa."""
    filepath = FIXTURES_DIR / "encrypted_document.pdf"
    doc = fitz.open()
    fontfile = "C:/Windows/Fonts/arial.ttf" if Path("C:/Windows/Fonts/arial.ttf").exists() else None
    fontname = "arial" if fontfile else None

    page = doc.new_page(width=595, height=842)
    page.insert_textbox(
        fitz.Rect(50, 50, 545, 120),
        "TÀI LIỆU NỘI BỘ BẢO MẬT NGÂN HÀNG\n\nNội dung này được bảo vệ bằng mật khẩu người dùng.",
        fontsize=14,
        fontfile=fontfile,
        fontname=fontname,
    )
    doc.save(
        filepath,
        encryption=fitz.PDF_ENCRYPT_AES_256,
        user_pw="MatKhau123@",
        owner_pw="admin_owner_pwd",
    )
    doc.close()
    return filepath


def generate_all_fixtures() -> dict[str, Path]:
    """Sinh toàn bộ các file thử nghiệm (PDF, EPUB, TXT)."""
    return {
        "standard_unicode": create_standard_unicode_pdf(),
        "tcvn3": create_tcvn3_pdf(),
        "vni": create_vni_pdf(),
        "detached_accents": create_detached_accents_pdf(),
        "scanned_image": create_scanned_image_pdf(),
        "broken_font": create_broken_font_pdf(),
        "sample_epub": create_standard_epub(),
        "sample_txt": create_standard_txt(),
        "encrypted": create_encrypted_pdf(),
    }


if __name__ == "__main__":
    generated = generate_all_fixtures()
    print("Đã tạo thành công các file PDF fixtures:")
    for k, v in generated.items():
        print(f" - {k}: {v.name} ({v.stat().st_size} bytes)")

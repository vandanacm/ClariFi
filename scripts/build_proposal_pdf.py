from pathlib import Path
import re
import textwrap

ROOT = Path(__file__).resolve().parents[1]
SRC = ROOT / "reports" / "clarifi_proposal.md"
OUT = ROOT / "reports" / "clarifi_proposal.pdf"

PAGE_W, PAGE_H = 612, 792
MARGIN = 72
COL_GAP = 24
COL_W = (PAGE_W - 2 * MARGIN - COL_GAP) / 2
LINE = 13.5

FONT_REG = "F1"
FONT_BOLD = "F2"
FONT_ITALIC = "F3"


def esc(text):
    return text.replace("\\", "\\\\").replace("(", "\\(").replace(")", "\\)")


def approx_width(text, size=11, bold=False):
    factor = 0.55 if bold else 0.51
    wide = sum(1 for ch in text if ch in "MW@#%&")
    narrow = sum(1 for ch in text if ch in "il.,;:' ")
    return size * (factor * len(text) + 0.12 * wide - 0.12 * narrow)


def wrap(text, width, size=11, bold=False):
    words = text.split()
    lines, current = [], ""
    for word in words:
        candidate = word if not current else f"{current} {word}"
        if approx_width(candidate, size, bold) <= width:
            current = candidate
        else:
            if current:
                lines.append(current)
            current = word
    if current:
        lines.append(current)
    return lines or [""]


class PdfBuilder:
    def __init__(self):
        self.pages = []
        self.ops = []
        self.page_index = 0
        self.col = 0
        self.x = MARGIN
        self.y = PAGE_H - MARGIN

    def new_page(self):
        if self.ops:
            self.pages.append("\n".join(self.ops))
        self.ops = []
        self.page_index += 1
        self.col = 0
        self.x = MARGIN
        self.y = PAGE_H - MARGIN

    def finish(self):
        if self.ops:
            self.pages.append("\n".join(self.ops))

    def next_column(self):
        if self.col == 0:
            self.col = 1
            self.x = MARGIN + COL_W + COL_GAP
            self.y = PAGE_H - MARGIN
        else:
            self.new_page()

    def ensure(self, needed):
        if self.y - needed < MARGIN:
            self.next_column()

    def text(self, x, y, text, size=11, font=FONT_REG):
        self.ops.append(f"BT /{font} {size} Tf {x:.2f} {y:.2f} Td ({esc(text)}) Tj ET")

    def rule(self, x1, y1, x2, y2):
        self.ops.append(f"0.78 0.83 0.86 RG {x1:.2f} {y1:.2f} m {x2:.2f} {y2:.2f} l S")

    def add_heading(self, text):
        self.ensure(26)
        self.text(self.x, self.y, text, 12, FONT_BOLD)
        self.y -= 15
        self.rule(self.x, self.y + 4, self.x + COL_W, self.y + 4)
        self.y -= 4

    def add_paragraph(self, text, bullet=False):
        size = 11
        prefix = "- " if bullet else ""
        indent = 10 if bullet else 0
        lines = wrap(text, COL_W - indent, size=size)
        self.ensure(len(lines) * LINE + 5)
        for i, line in enumerate(lines):
            self.text(self.x + indent, self.y, (prefix if i == 0 else "  ") + line, size, FONT_REG)
            self.y -= LINE
        self.y -= 3

    def add_title(self, title, subtitle):
        self.text(MARGIN, PAGE_H - MARGIN, title, 15, FONT_BOLD)
        self.text(MARGIN, PAGE_H - MARGIN - 18, subtitle, 10.5, FONT_REG)
        self.rule(MARGIN, PAGE_H - MARGIN - 28, PAGE_W - MARGIN, PAGE_H - MARGIN - 28)
        self.y = PAGE_H - MARGIN - 45

    def add_table(self, lines):
        self.ensure(88)
        size = 7.8
        col_x = [self.x, self.x + 31, self.x + 83, self.x + 178]
        widths = [28, 49, 89, 45]
        rows = []
        for line in lines:
            if set(line.strip()) <= {"|", "-", " "}:
                continue
            cells = [cell.strip() for cell in line.strip().strip("|").split("|")]
            rows.append(cells)
        for row_i, cells in enumerate(rows):
            wrapped = []
            max_lines = 1
            for cell, width in zip(cells, widths):
                cell_lines = wrap(cell, width, size=size, bold=(row_i == 0))
                wrapped.append(cell_lines)
                max_lines = max(max_lines, len(cell_lines))
            row_h = max_lines * 9.6 + 5
            self.ensure(row_h)
            for col_i, cell_lines in enumerate(wrapped):
                for j, line in enumerate(cell_lines):
                    font = FONT_BOLD if row_i == 0 else FONT_REG
                    self.text(col_x[col_i], self.y - j * 9.6, line, size, font)
            self.y -= row_h
        self.y -= 3


def parse_sections(md):
    body, refs = [], []
    target = body
    table_buffer = []
    for raw in md.splitlines():
        line = raw.rstrip()
        if line == "## References":
            if table_buffer:
                target.append(("table", table_buffer))
                table_buffer = []
            target = refs
            target.append(("heading", "References"))
            continue
        if line.startswith("|"):
            table_buffer.append(line)
            continue
        if table_buffer:
            target.append(("table", table_buffer))
            table_buffer = []
        if not line:
            continue
        if line.startswith("# "):
            target.append(("title", line[2:]))
        elif line.startswith("## "):
            target.append(("heading", line[3:]))
        elif line.startswith("- "):
            target.append(("bullet", line[2:]))
        else:
            target.append(("para", line))
    if table_buffer:
        target.append(("table", table_buffer))
    return body, refs


def build_pdf():
    md = SRC.read_text()
    body, refs = parse_sections(md)
    pdf = PdfBuilder()
    subtitle = ""
    for kind, text in body:
        if kind == "title":
            continue
        subtitle = text
        break

    title = body[0][1]
    pdf.add_title(title, subtitle)
    skip_subtitle = True
    for kind, value in body[1:]:
        if skip_subtitle and kind == "para":
            skip_subtitle = False
            continue
        if kind == "heading":
            pdf.add_heading(value)
        elif kind == "para":
            pdf.add_paragraph(value)
        elif kind == "bullet":
            pdf.add_paragraph(value, bullet=True)
        elif kind == "table":
            pdf.add_table(value)

    if len(pdf.pages) + 1 > 2:
        print("Warning: proposal body may exceed two pages.")

    pdf.new_page()
    pdf.text(MARGIN, PAGE_H - MARGIN, "References", 14, FONT_BOLD)
    pdf.y = PAGE_H - MARGIN - 24
    for kind, value in refs:
        if kind == "heading":
            continue
        if kind == "para":
            for line in wrap(value, PAGE_W - 2 * MARGIN, size=10):
                pdf.ensure(12)
                pdf.text(MARGIN, pdf.y, line, 10, FONT_REG)
                pdf.y -= 12
            pdf.y -= 5

    pdf.finish()
    write_pdf(pdf.pages)
    print(f"Wrote {OUT}")


def write_pdf(page_streams):
    objects = []

    def add(obj):
        objects.append(obj)
        return len(objects)

    font1 = add("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>")
    font2 = add("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>")
    font3 = add("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Oblique >>")

    page_ids = []
    content_ids = []
    for stream in page_streams:
        encoded = stream.encode("latin-1", "replace")
        content_ids.append(add(f"<< /Length {len(encoded)} >>\nstream\n{stream}\nendstream"))
        page_ids.append(None)

    pages_id_placeholder = len(objects) + len(page_streams) + 1
    for i, content_id in enumerate(content_ids):
        page_ids[i] = add(
            f"<< /Type /Page /Parent {pages_id_placeholder} 0 R /MediaBox [0 0 {PAGE_W} {PAGE_H}] "
            f"/Resources << /Font << /F1 {font1} 0 R /F2 {font2} 0 R /F3 {font3} 0 R >> >> "
            f"/Contents {content_id} 0 R >>"
        )

    pages_id = add(f"<< /Type /Pages /Kids [{' '.join(f'{pid} 0 R' for pid in page_ids)}] /Count {len(page_ids)} >>")
    catalog_id = add(f"<< /Type /Catalog /Pages {pages_id} 0 R >>")

    chunks = ["%PDF-1.4\n%\xe2\xe3\xcf\xd3\n"]
    offsets = [0]
    for i, obj in enumerate(objects, 1):
        offsets.append(sum(len(c.encode("latin-1", "replace")) for c in chunks))
        chunks.append(f"{i} 0 obj\n{obj}\nendobj\n")
    xref_offset = sum(len(c.encode("latin-1", "replace")) for c in chunks)
    chunks.append(f"xref\n0 {len(objects) + 1}\n0000000000 65535 f \n")
    for offset in offsets[1:]:
        chunks.append(f"{offset:010d} 00000 n \n")
    chunks.append(f"trailer\n<< /Size {len(objects) + 1} /Root {catalog_id} 0 R >>\nstartxref\n{xref_offset}\n%%EOF\n")
    OUT.write_bytes("".join(chunks).encode("latin-1", "replace"))


if __name__ == "__main__":
    build_pdf()

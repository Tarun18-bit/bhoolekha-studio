"""Diagnostic: what the holder-column reader sees on this machine. Safe to delete later."""
import glob
from bhulekh_columns import parse_holders_from_pdf
pdf = glob.glob("../public/uploads/scan_ULPIN1793392324_*.pdf")[0]
hs = parse_holders_from_pdf(open(pdf, "rb").read(), debug=True)
print("--- holders:", len(hs))
for h in hs:
    print("  HOLDER:", h["name"], "|", h["relative"], "| age", h["minorAge"], "| guardian", h["guardian"])

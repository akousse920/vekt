"""Create three fictitious CV PDFs for screening qualification.

Requires reportlab. These are synthetic profiles, never real applicant data.
"""

from pathlib import Path

from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfgen import canvas


ROOT = Path(__file__).resolve().parents[1]
OUTPUT = ROOT / "tests" / "fixtures" / "cvs"
OUTPUT.mkdir(parents=True, exist_ok=True)

FONT_PATH = Path("/System/Library/Fonts/Supplemental/Arial.ttf")
if FONT_PATH.exists():
    pdfmetrics.registerFont(TTFont("CVArial", str(FONT_PATH)))
    FONT = "CVArial"
else:
    FONT = "Helvetica"

PROFILES = [
    (
        "pertinent.pdf",
        "Alice Exemple",
        "Développeuse backend TypeScript",
        [
            "Expérience : 6 ans en développement backend Node.js et TypeScript.",
            "2020-2026 : conception d'API REST et de services de paiement.",
            "PostgreSQL : schémas, index, requêtes SQL et migrations Prisma.",
            "Docker : création d'images, tests et déploiement de services.",
            "Tests : intégration API, contrôle d'accès et observabilité.",
            "Langues : français et anglais professionnel.",
        ],
    ),
    (
        "moyen.pdf",
        "Bruno Exemple",
        "Développeur web",
        [
            "Expérience : 2 ans en développement web React et JavaScript.",
            "2024-2026 : interfaces utilisateur, formulaires et accessibilité.",
            "Node.js : quelques petites API personnelles, sans déploiement en production.",
            "PostgreSQL : notions de base ; Docker : formation en cours.",
            "Tests : tests de composants et revue de code.",
            "Langues : français courant, anglais intermédiaire.",
        ],
    ),
    (
        "hors_sujet.pdf",
        "Carine Exemple",
        "Conseillère clientèle",
        [
            "Expérience : 7 ans en accueil et relation clientèle.",
            "2019-2026 : gestion de dossiers administratifs et suivi commercial.",
            "Compétences : communication, organisation, saisie bureautique.",
            "Aucune expérience en développement logiciel, API ou bases de données.",
            "Langues : français courant.",
        ],
    ),
]


def draw_pdf(filename: str, name: str, title: str, lines: list[str]) -> None:
    target = OUTPUT / filename
    pdf = canvas.Canvas(str(target), pagesize=A4)
    width, height = A4
    pdf.setFillColor(colors.HexColor("#13324a"))
    pdf.rect(0, height - 110, width, 110, fill=1, stroke=0)
    pdf.setFillColor(colors.white)
    pdf.setFont(FONT, 20)
    pdf.drawString(48, height - 55, name)
    pdf.setFont(FONT, 11)
    pdf.drawString(48, height - 78, title)
    pdf.setFillColor(colors.HexColor("#1c2e3b"))
    pdf.setFont(FONT, 12)
    pdf.drawString(48, height - 145, "Profil et compétences")
    pdf.setStrokeColor(colors.HexColor("#9db4bf"))
    pdf.line(48, height - 155, width - 48, height - 155)
    pdf.setFont(FONT, 10)
    y = height - 185
    for line in lines:
        pdf.drawString(48, y, line)
        y -= 34
    pdf.setFillColor(colors.HexColor("#607d8b"))
    pdf.setFont(FONT, 8)
    pdf.drawString(48, 36, "Profil entièrement fictif - jeu de qualification Vekt")
    pdf.save()


for profile in PROFILES:
    draw_pdf(*profile)

print(f"Created {len(PROFILES)} fictitious CVs in {OUTPUT}")

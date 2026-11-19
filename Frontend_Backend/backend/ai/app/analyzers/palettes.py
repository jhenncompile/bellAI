"""HU-006: paletas de las 12 estaciones de colorimetría.

Cada estación tiene colores base, neutros y de acento, colores que reducen la armonía
(con el motivo), metales, labiales y monturas recomendadas. Los nombres de estación
coinciden con el tipo ColorSeason de la app móvil.
"""
from __future__ import annotations

from typing import Dict, List

SEASONS: List[str] = [
    "Invierno Fuerte (Deep Winter)", "Invierno Frio (True Winter)", "Invierno Brillante (Clear Winter)",
    "Verano Suave (Soft Summer)", "Verano Frio (True Summer)", "Verano Claro (Light Summer)",
    "Otono Calido (True Autumn)", "Otono Fuerte (Deep Autumn)", "Otono Suave (Soft Autumn)",
    "Primavera Brillante (Clear Spring)", "Primavera Calida (True Spring)", "Primavera Clara (Light Spring)",
]


def _sw(hex_: str, name: str, cat: str, tip: str = "") -> Dict[str, str]:
    d = {"hex": hex_, "name": name, "category": cat}
    if tip:
        d["usageTip"] = tip
    return d


def _av(hex_: str, name: str, reason: str) -> Dict[str, str]:
    return {"hex": hex_, "name": name, "reason": reason}


_WINTER_AVOID = [
    _av("#C8A165", "Mostaza apagado", "Su base cálida y apagada da un tono cetrino a tu piel."),
    _av("#D9B99B", "Beige camel", "Resta contraste y deslava tus rasgos."),
    _av("#E07B39", "Naranja calabaza", "Choca con tu subtono frío y enrojece la piel."),
]
_SUMMER_AVOID = [
    _av("#000000", "Negro puro", "Es demasiado duro y marca sombras en facciones suaves."),
    _av("#FF6A00", "Naranja intenso", "Su calidez y saturación opacan tu rostro."),
    _av("#8B5A2B", "Marrón cálido", "Apaga tu piel y la vuelve grisácea."),
]
_AUTUMN_AVOID = [
    _av("#FF1493", "Fucsia frío", "Choca con tu subtono dorado y te hace ver pálida."),
    _av("#B0C4DE", "Azul hielo", "Es demasiado frío y apaga tu calidez natural."),
    _av("#FFFFFF", "Blanco óptico", "Contrasta en exceso; prefiere marfil o crema."),
]
_SPRING_AVOID = [
    _av("#2F3640", "Gris pizarra oscuro", "Apaga tu luminosidad y endurece el rostro."),
    _av("#4B0026", "Vino frío", "Es demasiado denso y frío para tu calidez."),
    _av("#000000", "Negro puro", "Te resta frescura; prefiere azul marino o chocolate."),
]

_COOL_BEAUTY = {"metals": ["Plata", "Oro blanco", "Platino"]}
_WARM_BEAUTY = {"metals": ["Oro amarillo", "Bronce", "Cobre"]}

PALETTES: Dict[str, Dict] = {
    "Invierno Fuerte (Deep Winter)": {
        "colors": [
            _sw("#0B0B0F", "Negro azabache", "base", "Abrigos, pantalones y blazers"),
            _sw("#1B2A4A", "Azul noche", "base"), _sw("#4A0E2E", "Ciruela profundo", "base"),
            _sw("#3A3A40", "Gris carbón", "neutro"), _sw("#F4F4F6", "Blanco nieve", "neutro"),
            _sw("#B3122E", "Rojo rubí", "acento", "Tu color de autoridad"),
            _sw("#0F5E4A", "Verde pino", "acento"), _sw("#5B1E7A", "Púrpura real", "acento"),
        ],
        "avoid": _WINTER_AVOID, **_COOL_BEAUTY,
        "lipsticks": ["Vino profundo", "Rojo frambuesa", "Ciruela"],
        "frames": ["Acetato negro", "Carey oscuro frío", "Metal gunmetal"],
        "hairShades": ["Castaño espresso", "Negro natural", "Chocolate frío"],
        "avoidHairShades": ["Rubio dorado", "Cobrizo claro"],
    },
    "Invierno Frio (True Winter)": {
        "colors": [
            _sw("#000000", "Negro puro", "base"), _sw("#1E3A8A", "Azul real", "base"),
            _sw("#4B5563", "Gris acero", "neutro"), _sw("#FFFFFF", "Blanco puro", "neutro"),
            _sw("#BE123C", "Rojo carmesí", "acento"), _sw("#9D174D", "Magenta", "acento"),
            _sw("#047857", "Esmeralda", "acento"), _sw("#1D4ED8", "Zafiro", "acento"),
        ],
        "avoid": _WINTER_AVOID, **_COOL_BEAUTY,
        "lipsticks": ["Rojo cereza azulado", "Fucsia", "Baya"],
        "frames": ["Negro brillante", "Plata", "Azul marino"],
        "hairShades": ["Negro azulado", "Castaño cenizo oscuro"],
        "avoidHairShades": ["Rubio dorado", "Caramelo"],
    },
    "Invierno Brillante (Clear Winter)": {
        "colors": [
            _sw("#000000", "Negro", "base"), _sw("#0A2463", "Azul cobalto oscuro", "base"),
            _sw("#9CA3AF", "Gris plata", "neutro"), _sw("#FFFFFF", "Blanco óptico", "neutro"),
            _sw("#E11D48", "Rojo vivo frío", "acento"), _sw("#06B6D4", "Turquesa hielo", "acento"),
            _sw("#DB2777", "Rosa fucsia", "acento"), _sw("#10B981", "Verde esmeralda brillante", "acento"),
        ],
        "avoid": _WINTER_AVOID, **_COOL_BEAUTY,
        "lipsticks": ["Rojo puro", "Fucsia brillante", "Rosa frío"],
        "frames": ["Negro", "Transparente frío", "Cobalto"],
        "hairShades": ["Negro brillante", "Castaño oscuro frío"],
        "avoidHairShades": ["Rubio miel", "Cobrizo apagado"],
    },
    "Verano Suave (Soft Summer)": {
        "colors": [
            _sw("#4B5563", "Gris pizarra", "base"), _sw("#3F4E6B", "Azul denim apagado", "base"),
            _sw("#A8A29E", "Topo", "neutro"), _sw("#E7E5E4", "Blanco roto", "neutro"),
            _sw("#B07A8C", "Malva", "acento"), _sw("#6B8F8A", "Verde salvia", "acento"),
            _sw("#8E7CA8", "Lavanda grisácea", "acento"), _sw("#9F5F6B", "Rosa antiguo", "acento"),
        ],
        "avoid": _SUMMER_AVOID, **_COOL_BEAUTY,
        "lipsticks": ["Rosa malva", "Nude rosado", "Frambuesa suave"],
        "frames": ["Gris humo", "Carey suave", "Plata mate"],
        "hairShades": ["Castaño cenizo", "Rubio oscuro cenizo"],
        "avoidHairShades": ["Negro azulado", "Cobrizo intenso"],
    },
    "Verano Frio (True Summer)": {
        "colors": [
            _sw("#1E3A5F", "Azul marino suave", "base"), _sw("#475569", "Gris azulado", "base"),
            _sw("#94A3B8", "Gris perla", "neutro"), _sw("#F1F5F9", "Blanco suave", "neutro"),
            _sw("#3B82F6", "Azul lavanda", "acento"), _sw("#DB7093", "Rosa frambuesa suave", "acento"),
            _sw("#5F9EA0", "Azul petróleo suave", "acento"), _sw("#9370DB", "Lila", "acento"),
        ],
        "avoid": _SUMMER_AVOID, **_COOL_BEAUTY,
        "lipsticks": ["Rosa frío", "Frambuesa", "Malva"],
        "frames": ["Plata", "Azul grisáceo", "Transparente rosado"],
        "hairShades": ["Castaño medio cenizo", "Rubio ceniza"],
        "avoidHairShades": ["Dorado", "Negro intenso"],
    },
    "Verano Claro (Light Summer)": {
        "colors": [
            _sw("#5B7DB1", "Azul periwinkle", "base"), _sw("#7D8CA3", "Gris azul claro", "base"),
            _sw("#CBD5E1", "Gris niebla", "neutro"), _sw("#F8FAFC", "Blanco suave", "neutro"),
            _sw("#F4A6C0", "Rosa algodón", "acento"), _sw("#A7C7E7", "Azul cielo", "acento"),
            _sw("#B8E0D2", "Menta suave", "acento"), _sw("#C8A2C8", "Lila claro", "acento"),
        ],
        "avoid": _SUMMER_AVOID, **_COOL_BEAUTY,
        "lipsticks": ["Rosa pastel", "Nude rosado claro", "Coral rosado suave"],
        "frames": ["Plata claro", "Transparente", "Rosa empolvado"],
        "hairShades": ["Rubio ceniza claro", "Rubio beige"],
        "avoidHairShades": ["Negro", "Castaño muy oscuro"],
    },
    "Otono Calido (True Autumn)": {
        "colors": [
            _sw("#78350F", "Terracota", "base"), _sw("#3F6212", "Verde oliva", "base"),
            _sw("#A16207", "Camel", "neutro"), _sw("#FEF3C7", "Crema", "neutro"),
            _sw("#B45309", "Mostaza dorado", "acento"), _sw("#9A3412", "Óxido", "acento"),
            _sw("#D97706", "Ámbar", "acento"), _sw("#0F766E", "Verde azulado cálido", "acento"),
        ],
        "avoid": _AUTUMN_AVOID, **_WARM_BEAUTY,
        "lipsticks": ["Terracota", "Ladrillo", "Nude cálido"],
        "frames": ["Carey", "Oro", "Marrón miel"],
        "hairShades": ["Castaño cobrizo", "Caramelo", "Avellana"],
        "avoidHairShades": ["Negro azulado", "Platino"],
    },
    "Otono Fuerte (Deep Autumn)": {
        "colors": [
            _sw("#3B1F0E", "Chocolate", "base"), _sw("#1F3B2D", "Verde bosque", "base"),
            _sw("#5C4033", "Marrón café", "neutro"), _sw("#F5E6CC", "Marfil", "neutro"),
            _sw("#8B1E1E", "Rojo tomate oscuro", "acento"), _sw("#B8860B", "Oro viejo", "acento"),
            _sw("#7C2D12", "Caoba", "acento"), _sw("#134E4A", "Petróleo", "acento"),
        ],
        "avoid": _AUTUMN_AVOID, **_WARM_BEAUTY,
        "lipsticks": ["Rojo ladrillo", "Chocolate rosado", "Burdeos cálido"],
        "frames": ["Carey oscuro", "Bronce", "Marrón chocolate"],
        "hairShades": ["Castaño chocolate", "Caoba"],
        "avoidHairShades": ["Rubio cenizo", "Negro azulado"],
    },
    "Otono Suave (Soft Autumn)": {
        "colors": [
            _sw("#6B4F3A", "Moka", "base"), _sw("#6B7B4C", "Verde musgo", "base"),
            _sw("#B5A48B", "Arena", "neutro"), _sw("#EFE6D8", "Hueso", "neutro"),
            _sw("#C08261", "Melocotón tostado", "acento"), _sw("#8A9A5B", "Salvia cálida", "acento"),
            _sw("#B76E79", "Rosa palo cálido", "acento"), _sw("#5F7A7A", "Azul verdoso grisáceo", "acento"),
        ],
        "avoid": _AUTUMN_AVOID, **_WARM_BEAUTY,
        "lipsticks": ["Nude melocotón", "Rosa canela", "Terracota suave"],
        "frames": ["Carey claro", "Oro mate", "Verde oliva"],
        "hairShades": ["Rubio oscuro dorado", "Castaño claro miel"],
        "avoidHairShades": ["Negro", "Rojo intenso"],
    },
    "Primavera Brillante (Clear Spring)": {
        "colors": [
            _sw("#0B3D91", "Azul marino brillante", "base"), _sw("#0284C7", "Azul caribe", "base"),
            _sw("#E5E7EB", "Gris claro", "neutro"), _sw("#FFFBEB", "Blanco cálido", "neutro"),
            _sw("#FB7185", "Coral", "acento"), _sw("#22C55E", "Verde manzana", "acento"),
            _sw("#F59E0B", "Amarillo dorado", "acento"), _sw("#14B8A6", "Turquesa", "acento"),
        ],
        "avoid": _SPRING_AVOID, **_WARM_BEAUTY,
        "lipsticks": ["Coral vivo", "Rojo amapola", "Rosa melocotón"],
        "frames": ["Carey brillante", "Oro", "Azul vivo"],
        "hairShades": ["Castaño dorado", "Castaño medio cálido"],
        "avoidHairShades": ["Ceniza apagado", "Negro azulado"],
    },
    "Primavera Calida (True Spring)": {
        "colors": [
            _sw("#7C4A1E", "Marrón dorado", "base"), _sw("#1E5F74", "Azul pavo real", "base"),
            _sw("#D6C7B2", "Beige arena", "neutro"), _sw("#FFF7E6", "Marfil", "neutro"),
            _sw("#F97316", "Mandarina", "acento"), _sw("#84CC16", "Verde lima", "acento"),
            _sw("#FBBF24", "Dorado", "acento"), _sw("#F43F5E", "Coral rojizo", "acento"),
        ],
        "avoid": _SPRING_AVOID, **_WARM_BEAUTY,
        "lipsticks": ["Coral", "Melocotón", "Rojo anaranjado"],
        "frames": ["Carey miel", "Oro", "Ámbar"],
        "hairShades": ["Rubio miel", "Cobrizo dorado"],
        "avoidHairShades": ["Ceniza", "Negro"],
    },
    "Primavera Clara (Light Spring)": {
        "colors": [
            _sw("#5B8DB8", "Azul aguamarina", "base"), _sw("#B08968", "Camel claro", "base"),
            _sw("#E7DCCB", "Crema", "neutro"), _sw("#FFFDF5", "Blanco marfil", "neutro"),
            _sw("#FFB4A2", "Melocotón", "acento"), _sw("#A7F3D0", "Verde menta cálido", "acento"),
            _sw("#FDE68A", "Vainilla", "acento"), _sw("#F9A8D4", "Rosa claro cálido", "acento"),
        ],
        "avoid": _SPRING_AVOID, **_WARM_BEAUTY,
        "lipsticks": ["Melocotón claro", "Rosa coral", "Nude dorado"],
        "frames": ["Oro claro", "Transparente cálido", "Carey claro"],
        "hairShades": ["Rubio dorado claro", "Rubio fresa"],
        "avoidHairShades": ["Negro", "Castaño oscuro frío"],
    },
}


def palette_for(season: str) -> Dict:
    return PALETTES[season]

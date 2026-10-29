from pathlib import Path
from datetime import date
import sys

import pytest

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from extractor import leer_cpe

EJEMPLO = Path(__file__).resolve().parents[1] / "ejemplos" / "cpe-00001-00026528.pdf"


@pytest.mark.skipif(not EJEMPLO.exists(), reason="falta ejemplos/cpe-00001-00026528.pdf")
def test_cpe_ejemplo():
    c = leer_cpe(str(EJEMPLO))
    assert c.nro_cpe == "00001-00026528"
    assert c.ctg == "10134300029"
    assert c.fecha == date(2026, 8, 11)
    assert c.grano == "Maíz"
    assert c.peso_neto == 29960
    assert c.observaciones == "Fortin Paunero"
    assert c.patente == "HDE283"
    assert c.transportista == "BARBESINI CLAUDIO OSCAR"
    assert c.advertencias == []

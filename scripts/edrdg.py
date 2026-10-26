"""Access to the EDRDG dictionaries (KANJIDIC2, JMdict; CC BY-SA 4.0) used by the data scripts."""

import gzip
import urllib.request
from pathlib import Path

KANJIDIC_URL = "http://www.edrdg.org/kanjidic/kanjidic2.xml.gz"
JMDICT_URL = "http://ftp.edrdg.org/pub/Nihongo/JMdict_e.gz"


def read_dictionary(path: Path | None, url: str) -> bytes:
    """XML of a dictionary: from `path` (gzipped or not), or downloaded from `url` when no path is given."""
    if path is None:
        with urllib.request.urlopen(url) as response:
            return gzip.decompress(response.read())
    raw = path.read_bytes()
    return gzip.decompress(raw) if path.suffix == ".gz" else raw

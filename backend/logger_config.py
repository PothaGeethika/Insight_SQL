import logging
import sys
import os
from logging.handlers import RotatingFileHandler

# ── Log file location ────────────────────────────────────────────────────────
LOG_FILE = os.path.join(os.path.dirname(__file__), "insightsql.log")

# ── ANSI colour codes for console output ────────────────────────────────────
class _ColourFormatter(logging.Formatter):
    COLOURS = {
        logging.DEBUG:    "\033[36m",   # Cyan
        logging.INFO:     "\033[32m",   # Green
        logging.WARNING:  "\033[33m",   # Yellow
        logging.ERROR:    "\033[31m",   # Red
        logging.CRITICAL: "\033[35m",   # Magenta
    }
    RESET = "\033[0m"

    def format(self, record):
        colour = self.COLOURS.get(record.levelno, self.RESET)
        record.levelname = f"{colour}{record.levelname:8}{self.RESET}"
        return super().format(record)

# ── Formatter strings ────────────────────────────────────────────────────────
CONSOLE_FMT = "%(asctime)s | %(levelname)s | %(name)s | %(message)s"
FILE_FMT    = "%(asctime)s | %(levelname)-8s | %(name)s | %(filename)s:%(lineno)d | %(message)s"
DATE_FMT    = "%Y-%m-%d %H:%M:%S"

# ── Root logger setup ────────────────────────────────────────────────────────
root_logger = logging.getLogger()
root_logger.setLevel(logging.DEBUG)

# Console handler – INFO and above, coloured
_console = logging.StreamHandler(sys.stdout)
_console.setLevel(logging.INFO)
_console.setFormatter(_ColourFormatter(CONSOLE_FMT, datefmt=DATE_FMT))

# Rotating file handler – DEBUG and above, plain text
# Keeps 5 × 5 MB log files = up to 25 MB of history
_file = RotatingFileHandler(LOG_FILE, maxBytes=5 * 1024 * 1024, backupCount=5, encoding="utf-8")
_file.setLevel(logging.DEBUG)
_file.setFormatter(logging.Formatter(FILE_FMT, datefmt=DATE_FMT))

root_logger.addHandler(_console)
root_logger.addHandler(_file)

# ── Public helper ────────────────────────────────────────────────────────────
def get_logger(name: str) -> logging.Logger:
    """Return a child logger prefixed with InsightSQL.<name>."""
    return logging.getLogger(f"InsightSQL.{name}")

# Default logger used by legacy code that imports `logger` directly
logger = get_logger("core")
logger.info("Logger initialised – console=INFO, file=DEBUG → %s", LOG_FILE)

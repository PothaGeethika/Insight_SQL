import logging
import sys
import os
from logging.handlers import RotatingFileHandler

# Define the log file path
LOG_FILE = os.path.join(os.path.dirname(__file__), "insightsql.log")

# Basic configuration to ensure it works globally
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    handlers=[
        logging.StreamHandler(sys.stdout)
    ]
)

# Get the logger
logger = logging.getLogger("InsightSQL")
logger.info("Logger initialized successfully.")

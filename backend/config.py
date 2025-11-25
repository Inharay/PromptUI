import os

# Base directories
UPLOAD_BASE_DIR = "uploads"
OUTPUT_DIR = "outputs"

# Specific upload directories
KB_DIR = os.path.join(UPLOAD_BASE_DIR, "knowledge_base")
UNSTRUCTURED_DIR = os.path.join(UPLOAD_BASE_DIR, "unstructured_data")

# Specific output directories
SMART_OUTPUT_SUBDIR = "smart"
UNSTRUCTURED_OUTPUT_SUBDIR = "unstructured"

SMART_OUTPUT_DIR = os.path.join(OUTPUT_DIR, SMART_OUTPUT_SUBDIR)
UNSTRUCTURED_OUTPUT_DIR = os.path.join(OUTPUT_DIR, UNSTRUCTURED_OUTPUT_SUBDIR)

# Ensure directories exist
os.makedirs(KB_DIR, exist_ok=True)
os.makedirs(UNSTRUCTURED_DIR, exist_ok=True)
os.makedirs(OUTPUT_DIR, exist_ok=True)
os.makedirs(SMART_OUTPUT_DIR, exist_ok=True)
os.makedirs(UNSTRUCTURED_OUTPUT_DIR, exist_ok=True)

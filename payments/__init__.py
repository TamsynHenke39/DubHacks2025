"""
Payments service package initializer.

This file makes the `payments` directory a Python package so we can use
package imports like `from payments.db import init_db` when running:
    uvicorn payments.main:app --reload --port 8001
"""
__version__ = "0.1.0"

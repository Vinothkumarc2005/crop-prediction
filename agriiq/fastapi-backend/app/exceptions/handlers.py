"""
Global exception handlers registered on the FastAPI application.

Maps common Python exceptions to appropriate HTTP status codes,
preventing stack traces from leaking to clients.
"""
import logging

from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse

logger = logging.getLogger(__name__)


def register_exception_handlers(app: FastAPI) -> None:
    """Register all global exception handlers on *app*."""

    @app.exception_handler(ValueError)
    async def value_error_handler(request: Request, exc: ValueError) -> JSONResponse:
        logger.warning("ValueError: %s %s — %s", request.method, request.url.path, exc)
        return JSONResponse(status_code=400, content={"detail": str(exc)})

    @app.exception_handler(PermissionError)
    async def permission_error_handler(request: Request, exc: PermissionError) -> JSONResponse:
        logger.warning("PermissionError: %s %s — %s", request.method, request.url.path, exc)
        return JSONResponse(status_code=403, content={"detail": str(exc)})

    @app.exception_handler(KeyError)
    async def key_error_handler(request: Request, exc: KeyError) -> JSONResponse:
        resource = str(exc).strip("'")
        logger.warning("KeyError (not found): %s %s — %s", request.method, request.url.path, exc)
        return JSONResponse(status_code=404, content={"detail": f"{resource} not found"})

    @app.exception_handler(LookupError)
    async def lookup_error_handler(request: Request, exc: LookupError) -> JSONResponse:
        logger.warning("LookupError: %s %s — %s", request.method, request.url.path, exc)
        return JSONResponse(status_code=404, content={"detail": str(exc)})

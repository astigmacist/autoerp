from rest_framework.views import exception_handler
from rest_framework.response import Response
from rest_framework import status


class BusinessError(Exception):
    """Raised for domain errors that should return a clean JSON error to the client."""

    def __init__(self, detail, code="business_error", errors=None, http_status=status.HTTP_400_BAD_REQUEST):
        self.detail = detail
        self.code = code
        self.errors = errors or []
        self.http_status = http_status
        super().__init__(detail)


def custom_exception_handler(exc, context):
    if isinstance(exc, BusinessError):
        return Response(
            {"code": exc.code, "detail": exc.detail, "errors": exc.errors},
            status=exc.http_status,
        )

    response = exception_handler(exc, context)
    if response is not None:
        detail = response.data
        code = "error"
        errors = []
        if isinstance(detail, dict):
            # DRF validation errors: {field: [msgs]}
            code = "validation_error"
            errors = [
                {"field": k, "message": v if isinstance(v, str) else "; ".join(str(x) for x in v)}
                for k, v in detail.items()
            ]
            detail = "Ошибка валидации данных"
        response.data = {"code": code, "detail": detail, "errors": errors}
    return response

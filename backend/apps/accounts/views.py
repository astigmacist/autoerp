from rest_framework.generics import RetrieveAPIView
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework_simplejwt.views import TokenObtainPairView

from .models import User
from .serializers import MyTokenObtainPairSerializer, UserSerializer


class MyTokenObtainPairView(TokenObtainPairView):
    serializer_class = MyTokenObtainPairSerializer


class MeView(RetrieveAPIView):
    serializer_class = UserSerializer
    permission_classes = [IsAuthenticated]

    def get_object(self):
        return self.request.user


class PermissionsView(APIView):
    """Returns the current user's effective permissions (for frontend UI gating)."""

    permission_classes = [IsAuthenticated]

    def get(self, request):
        u = request.user
        return Response(
            {
                "role": u.role,
                "can_see_cost": u.can_see_cost,
                "can_manage_catalog": u.role in ("owner", "stock"),
                "can_manage_users": u.role == "owner",
                "discount_limit_percent": u.discount_limit_percent,
            }
        )

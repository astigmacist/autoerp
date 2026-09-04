from django.urls import path
from rest_framework_simplejwt.views import TokenRefreshView

from .views import MeView, MyTokenObtainPairView, PermissionsView

urlpatterns = [
    path("login/", MyTokenObtainPairView.as_view(), name="token_obtain_pair"),
    path("refresh/", TokenRefreshView.as_view(), name="token_refresh"),
    path("me/", MeView.as_view(), name="me"),
    path("permissions/", PermissionsView.as_view(), name="permissions"),
]

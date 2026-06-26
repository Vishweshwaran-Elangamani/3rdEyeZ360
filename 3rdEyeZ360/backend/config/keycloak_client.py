from keycloak import KeycloakOpenID, KeycloakAdmin
from dotenv import load_dotenv
import os

load_dotenv(override=True)

KEYCLOAK_URL = os.getenv("KEYCLOAK_URL", "http://localhost:8080").rstrip("/") + "/"
KEYCLOAK_REALM = os.getenv("KEYCLOAK_REALM", "3rdEyeZ360")
KEYCLOAK_CLIENT_ID = os.getenv("KEYCLOAK_CLIENT_ID", "3rdeyez360-app")
KEYCLOAK_CLIENT_SECRET = os.getenv("KEYCLOAK_CLIENT_SECRET", "")
KEYCLOAK_ADMIN_USERNAME = os.getenv("KEYCLOAK_ADMIN_USERNAME", "admin")
KEYCLOAK_ADMIN_PASSWORD = os.getenv("KEYCLOAK_ADMIN_PASSWORD", "admin123")

keycloakopenid = KeycloakOpenID(
    server_url=KEYCLOAK_URL,
    realm_name=KEYCLOAK_REALM,
    client_id=KEYCLOAK_CLIENT_ID,
    client_secret_key=KEYCLOAK_CLIENT_SECRET or None,
)

keycloakadmin = KeycloakAdmin(
    server_url=KEYCLOAK_URL,
    username=KEYCLOAK_ADMIN_USERNAME,
    password=KEYCLOAK_ADMIN_PASSWORD,
    realm_name=KEYCLOAK_REALM,
    user_realm_name="master",
    verify=False,
)

keycloak_openid = keycloakopenid
keycloak_admin = keycloakadmin
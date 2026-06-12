from keycloak import KeycloakOpenID, KeycloakAdmin
from dotenv import load_dotenv
import os

load_dotenv()

keycloak_openid = KeycloakOpenID(
    server_url=os.getenv("KEYCLOAK_URL"),
    realm_name=os.getenv("KEYCLOAK_REALM"),
    client_id=os.getenv("KEYCLOAK_CLIENT_ID"),
    client_secret_key=os.getenv("KEYCLOAK_CLIENT_SECRET")
)

keycloak_admin = KeycloakAdmin(
    server_url=os.getenv("KEYCLOAK_URL"),
    username="admin",
    password="admin123",
    realm_name=os.getenv("KEYCLOAK_REALM"),
    verify=False
)
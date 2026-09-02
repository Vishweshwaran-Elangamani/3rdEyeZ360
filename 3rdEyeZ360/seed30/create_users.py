import requests

KEYCLOAK_URL = "http://localhost:8080"
REALM_NAME = "3rdEyeZ360"

ADMIN_USERNAME = "admin"
ADMIN_PASSWORD = "admin123"

DEFAULT_PASSWORD = "Admin@123456"
ROLE_NAME = "Candidate"


def get_admin_token():
    url = f"{KEYCLOAK_URL}/realms/master/protocol/openid-connect/token"

    data = {
        "client_id": "admin-cli",
        "grant_type": "password",
        "username": ADMIN_USERNAME,
        "password": ADMIN_PASSWORD,
    }

    response = requests.post(url, data=data)
    response.raise_for_status()

    return response.json()["access_token"]


def get_role(token):
    headers = {
        "Authorization": f"Bearer {token}"
    }

    url = f"{KEYCLOAK_URL}/admin/realms/{REALM_NAME}/roles/{ROLE_NAME}"

    response = requests.get(url, headers=headers)
    response.raise_for_status()

    return response.json()


def create_user(token, user):
    headers = {
        "Authorization": f"Bearer {token}",
        "Content-Type": "application/json"
    }

    payload = {
        "username": user["email"],
        "firstName": user["firstName"],
        "lastName": user["lastName"],
        "email": user["email"],
        "emailVerified": True,
        "enabled": True,
        "attributes": {
            "createdByScript": ["true"]
        },
        "credentials": [
            {
                "type": "password",
                "value": DEFAULT_PASSWORD,
                "temporary": False
            }
        ]
    }

    create_url = f"{KEYCLOAK_URL}/admin/realms/{REALM_NAME}/users"

    response = requests.post(
        create_url,
        headers=headers,
        json=payload
    )

    if response.status_code == 409:
        print(f"⚠️ User already exists: {user['email']}")
        return None

    response.raise_for_status()

    search_url = (
        f"{KEYCLOAK_URL}/admin/realms/{REALM_NAME}/users"
        f"?email={user['email']}"
    )

    users = requests.get(
        search_url,
        headers=headers
    ).json()

    return users[0]["id"]


def assign_role(token, user_id, role):
    headers = {
        "Authorization": f"Bearer {token}",
        "Content-Type": "application/json"
    }

    url = (
        f"{KEYCLOAK_URL}/admin/realms/{REALM_NAME}"
        f"/users/{user_id}/role-mappings/realm"
    )

    response = requests.post(
        url,
        headers=headers,
        json=[role]
    )

    response.raise_for_status()


def delete_created_users(token):
    headers = {
        "Authorization": f"Bearer {token}"
    }

    users_url = (
        f"{KEYCLOAK_URL}/admin/realms/"
        f"{REALM_NAME}/users?max=1000"
    )

    users = requests.get(
        users_url,
        headers=headers
    ).json()

    deleted = 0

    for user in users:

        email = user.get("email", "").lower()

        if (
            email.startswith("user")
            and email.endswith("@mail.com")
        ):

            delete_url = (
                f"{KEYCLOAK_URL}/admin/realms/"
                f"{REALM_NAME}/users/{user['id']}"
            )

            requests.delete(
                delete_url,
                headers=headers
            ).raise_for_status()

            deleted += 1

            print(f"🗑 Deleted {email}")

    print(f"\n✅ Deleted {deleted} generated users")


def generate_users():
    users = []

    for i in range(1, 31):
        users.append({
            "firstName": f"User{i}",
            "lastName": f"Test{i}",
            "email": f"user{i}@mail.com"
        })

    return users


def main():

    print("\n==========================")
    print("KEYCLOAK USER MANAGEMENT")
    print("==========================")
    print("1. Create 30 Candidate Users")
    print("2. Delete Users Created By Script")
    print("==========================")

    choice = input("Enter choice (1/2): ").strip()

    print("Getting admin token...")
    token = get_admin_token()

    if choice == "1":

        print("Fetching Candidate role...")
        candidate_role = get_role(token)

        users = generate_users()

        for user in users:
            try:
                user_id = create_user(token, user)

                if user_id:
                    assign_role(
                        token,
                        user_id,
                        candidate_role
                    )

                    print(
                        f"✅ Created {user['email']} "
                        f"and assigned Candidate role"
                    )

            except Exception as e:
                print(f"❌ Error: {user['email']} -> {e}")

        print("\nDone!")
        print("Password for all users:")
        print(DEFAULT_PASSWORD)

    elif choice == "2":

        delete_created_users(token)

    else:

        print("Invalid choice")


if __name__ == "__main__":
    main()
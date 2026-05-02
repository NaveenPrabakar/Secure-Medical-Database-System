import json
import boto3
import os
import hmac
import hashlib
import base64
import uuid
from datetime import datetime, timezone
from botocore.exceptions import ClientError

cognito = boto3.client("cognito-idp")
dynamodb = boto3.resource("dynamodb", region_name="us-east-2")

CLIENT_ID = os.environ["CLIENT_ID"]
CLIENT_SECRET = os.environ.get("CLIENT_SECRET")  # optional
LOGS_TABLE = os.environ.get("LOGS_TABLE", "logs")

def _response(status, body):
    return {
        "statusCode": status,
        "headers": {
            "Content-Type": "application/json",
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Credentials": "true"
        },
        "body": json.dumps(body)
    }

def get_secret_hash(username):
    if not CLIENT_SECRET:
        return None
    message = username + CLIENT_ID
    dig = hmac.new(
        CLIENT_SECRET.encode("utf-8"),
        msg=message.encode("utf-8"),
        digestmod=hashlib.sha256
    ).digest()
    return base64.b64encode(dig).decode()


def write_log(staff_name, status, detail):
    try:
        table = dynamodb.Table(LOGS_TABLE)
        table.put_item(
            Item={
                "staffname": staff_name or "unknown",
                "logid": str(uuid.uuid4()),
                "action": "LOGIN",
                "status": status,
                "detail": detail,
                "timestamp": datetime.now(timezone.utc).isoformat()
            }
        )
    except Exception as exc:
        print(f"Failed to write audit log: {exc}")

def login_handler(event, context):
    try:
        if "body" not in event:
            return _response(400, {"error": "Missing request body"})

        body = json.loads(event["body"] or "{}")
        email = body.get("email")
        password = body.get("password")

        if not email or not password:
            return _response(400, {"error": "Email and password required"})

        auth_params = {
            "USERNAME": email,
            "PASSWORD": password
        }

        secret_hash = get_secret_hash(email)
        if secret_hash:
            auth_params["SECRET_HASH"] = secret_hash

        # USER_PASSWORD_AUTH flow
        response = cognito.initiate_auth(
            ClientId=CLIENT_ID,
            AuthFlow="USER_PASSWORD_AUTH",
            AuthParameters=auth_params
        )

        write_log(email, "SUCCESS", "Login successful")

        return _response(200, {
            "message": "Login successful",
            "id_token": response["AuthenticationResult"]["IdToken"],
            "access_token": response["AuthenticationResult"]["AccessToken"],
            "refresh_token": response["AuthenticationResult"]["RefreshToken"],
            "expires_in": response["AuthenticationResult"]["ExpiresIn"],
            "token_type": response["AuthenticationResult"]["TokenType"]
        })

    except cognito.exceptions.NotAuthorizedException:
        write_log(locals().get("email"), "FAILED", "Incorrect username or password")
        return _response(400, {"error": "Incorrect username or password"})

    except cognito.exceptions.UserNotConfirmedException:
        write_log(locals().get("email"), "FAILED", "User not confirmed")
        return _response(400, {"error": "User not confirmed. Verify email first."})

    except ClientError as e:
        print("Cognito ClientError:", e.response["Error"]["Message"])
        write_log(locals().get("email"), "FAILED", e.response["Error"]["Message"])
        return _response(500, {"error": "Internal server error"})

    except Exception as e:
        print("Unexpected error:", str(e))
        write_log(locals().get("email"), "FAILED", str(e))
        return _response(500, {"error": "Internal server error"})

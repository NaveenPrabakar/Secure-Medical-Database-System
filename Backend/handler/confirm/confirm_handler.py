import json
import boto3
import os
import hmac
import hashlib
import base64
from botocore.exceptions import ClientError

cognito = boto3.client("cognito-idp")

CLIENT_ID = os.environ["CLIENT_ID"]
CLIENT_SECRET = os.environ.get("CLIENT_SECRET")  # optional

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

def confirm_signup_handler(event, context):
    try:
        if "body" not in event:
            return _response(400, {"error": "Missing request body"})

        body = json.loads(event["body"] or "{}")
        email = body.get("email")
        code = body.get("confirmation_code")

        if not email or not code:
            return _response(400, {"error": "Email and confirmation code required"})

        # Call Cognito to confirm signup
        cognito.confirm_sign_up(
            ClientId=CLIENT_ID,
            Username=email,
            ConfirmationCode=code,
            SecretHash=get_secret_hash(email),
            ForceAliasCreation=False
        )

        return _response(200, {"message": "Signup confirmed. You may now log in."})

    except cognito.exceptions.CodeMismatchException:
        return _response(400, {"error": "Invalid confirmation code"})

    except cognito.exceptions.ExpiredCodeException:
        return _response(400, {"error": "Confirmation code expired"})

    except cognito.exceptions.UserNotFoundException:
        return _response(400, {"error": "User not found"})

    except cognito.exceptions.UserAlreadyConfirmedException:
        return _response(200, {"message": "User already confirmed"})

    except ClientError as e:
        print("Cognito ClientError:", e.response["Error"]["Message"])
        return _response(500, {"error": "Internal server error"})

    except Exception as e:
        print("Unexpected error:", str(e))
        return _response(500, {"error": "Internal server error"})
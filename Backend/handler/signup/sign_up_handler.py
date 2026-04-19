import json
import boto3
import os
import hmac
import hashlib
import base64
from botocore.exceptions import ClientError

cognito = boto3.client("cognito-idp")

CLIENT_ID = os.environ["CLIENT_ID"]       # App Client ID
CLIENT_SECRET = os.environ.get("CLIENT_SECRET")  # App Client Secret (if used)

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
        CLIENT_SECRET.encode('utf-8'),
        msg=message.encode('utf-8'),
        digestmod=hashlib.sha256
    ).digest()
    return base64.b64encode(dig).decode()

def signup_handler(event, context):
    try:
        if "body" not in event:
            return _response(400, {"error": "Missing request body"})
        
        body = json.loads(event["body"] or "{}")
        email = body.get("email")
        password = body.get("password")

        if not email or not password:
            return _response(400, {"error": "Email and password required"})
        if len(password) < 8:
            return _response(400, {"error": "Weak password"})
        
        # ---- Call Cognito SignUp ----
        cognito.sign_up(
            ClientId=CLIENT_ID,
            Username=email,
            Password=password,
            SecretHash=get_secret_hash(email),  # include if app client has secret
            UserAttributes=[{"Name": "email", "Value": email}]
        )

        return _response(200, {"message": "User created. Verify email before login."})

    except cognito.exceptions.UsernameExistsException:
        # Mask account existence to prevent enumeration
        return _response(200, {"message": "If the account exists, verification is required."})

    except cognito.exceptions.InvalidPasswordException:
        return _response(400, {"error": "Password does not meet requirements"})

    except cognito.exceptions.InvalidParameterException:
        return _response(400, {"error": "Invalid input"})

    except ClientError as e:
        print("Cognito ClientError:", e.response['Error']['Message'])
        return _response(500, {"error": "Internal server error"})

    except Exception as e:
        print("Unexpected error:", str(e))
        return _response(500, {"error": "Internal server error"})
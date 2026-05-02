import base64
import boto3
import os
import uuid
from datetime import datetime, timezone

s3 = boto3.client('s3')
dynamodb = boto3.resource("dynamodb", region_name="us-east-2")
BUCKET = os.environ['BUCKET_NAME']
LOGS_TABLE = os.environ.get("LOGS_TABLE", "logs")


def get_staff_name(event):
    headers = event.get("headers") or {}
    query = event.get("queryStringParameters") or {}
    authorizer = event.get("requestContext", {}).get("authorizer", {})
    jwt_claims = authorizer.get("jwt", {}).get("claims", {})
    lambda_claims = authorizer.get("claims", {})

    return (
        headers.get("x-staff-name")
        or headers.get("X-Staff-Name")
        or query.get("staffname")
        or jwt_claims.get("email")
        or jwt_claims.get("cognito:username")
        or lambda_claims.get("email")
        or lambda_claims.get("cognito:username")
        or "unknown"
    )


def write_log(staff_name, patient_id, image_key, status, detail):
    try:
        table = dynamodb.Table(LOGS_TABLE)
        table.put_item(
            Item={
                "staffname": staff_name,
                "logid": str(uuid.uuid4()),
                "action": "UPLOAD_XRAY_IMAGE",
                "patient_id": patient_id,
                "image_key": image_key,
                "status": status,
                "detail": detail,
                "timestamp": datetime.now(timezone.utc).isoformat()
            }
        )
    except Exception as exc:
        print(f"Failed to write audit log: {exc}")

def lambda_handler(event, context):
    patient_id = event['queryStringParameters']['patient_id']
    staff_name = get_staff_name(event)

    try:
        body = event['body']
        
        if event.get('isBase64Encoded', False):
            file_bytes = base64.b64decode(body)
        else:
            file_bytes = body.encode()

        image_name = f"{uuid.uuid4()}.png"
        key = f"mri/{patient_id}/{image_name}"

        s3.put_object(
            Bucket=BUCKET,
            Key=key,
            Body=file_bytes,
            ContentType='image/png',
            ServerSideEncryption='aws:kms'
        )

        write_log(staff_name, patient_id, key, "SUCCESS", "Image uploaded successfully")

        return {
            "statusCode": 200,
            "body": f"Uploaded to {key}"
        }
    except Exception as exc:
        write_log(staff_name, patient_id, None, "FAILED", str(exc))
        return {
            "statusCode": 500,
            "body": str(exc)
        }

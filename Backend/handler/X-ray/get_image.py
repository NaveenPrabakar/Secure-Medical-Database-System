import boto3
import os
import json
import uuid
from datetime import datetime, timezone
from botocore.config import Config

s3 = boto3.client(
    "s3",
    region_name="us-east-2",
    config=Config(
        signature_version="s3v4",
        s3={
            "addressing_style": "virtual"
        }
    )
)
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


def write_log(staff_name, patient_id, image_count, status):
    try:
        table = dynamodb.Table(LOGS_TABLE)
        table.put_item(
            Item={
                "staffname": staff_name,
                "logid": str(uuid.uuid4()),
                "action": "VIEW_XRAY_IMAGES",
                "patient_id": patient_id,
                "image_count": image_count,
                "status": status,
                "timestamp": datetime.now(timezone.utc).isoformat()
            }
        )
    except Exception as exc:
        print(f"Failed to write audit log: {exc}")

def lambda_handler(event, context):
    patient_id = event["pathParameters"]["patient_id"]
    staff_name = get_staff_name(event)

    try:
        prefix = f"mri/{patient_id}/"

        response = s3.list_objects_v2(
            Bucket=BUCKET,
            Prefix=prefix
        )

        files = []

        for obj in response.get('Contents', []):
            url = s3.generate_presigned_url(
                'get_object',
                Params={
                    'Bucket': BUCKET,
                    'Key': obj['Key']
                },
                ExpiresIn=300
            )

            files.append({
                "key": obj['Key'],
                "url": url
            })

        write_log(staff_name, patient_id, len(files), "SUCCESS")

        return {
            "statusCode": 200,
            "headers": {
                "Content-Type": "application/json"
            },
            "body": json.dumps({
                "patient_id": patient_id,
                "images": files
            })
        }
    except Exception as exc:
        write_log(staff_name, patient_id, 0, "FAILED")
        return {
            "statusCode": 500,
            "headers": {
                "Content-Type": "application/json"
            },
            "body": json.dumps({
                "error": str(exc)
            })
        }

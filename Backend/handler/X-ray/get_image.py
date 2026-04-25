import boto3
import os
import json
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
BUCKET = os.environ['BUCKET_NAME']

def lambda_handler(event, context):
    patient_id = event["pathParameters"]["patient_id"]

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
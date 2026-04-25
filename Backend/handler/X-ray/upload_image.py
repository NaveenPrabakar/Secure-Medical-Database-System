import base64
import boto3
import os
import uuid

s3 = boto3.client('s3')
BUCKET = os.environ['BUCKET_NAME']

def lambda_handler(event, context):
    patient_id = event['queryStringParameters']['patient_id']

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

    return {
        "statusCode": 200,
        "body": f"Uploaded to {key}"
    }
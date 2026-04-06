import csv
import os
import base64
import random
import string
import boto3
import pymysql

# AWS clients
kms = boto3.client('kms')

# Env vars
DB_HOST = os.environ['DB_HOST']
DB_NAME = os.environ['DB_NAME']
DB_USER = os.environ['DB_USER']
DB_PASSWORD = os.environ['DB_PASSWORD']
DB_PORT = int(os.environ.get('DB_PORT', 3306))
KMS_KEY_ID = os.environ['KMS_KEY_ID']
CSV_FILE_PATH = os.environ['CSV_FILE_PATH']

# ---------- Helpers ----------

def encrypt_value(value: str) -> str:
    if value is None or value == "":
        return None
    
    response = kms.encrypt(
        KeyId=KMS_KEY_ID,
        Plaintext=value.encode('utf-8')
    )
    
    ciphertext = response['CiphertextBlob']
    return base64.b64encode(ciphertext).decode('utf-8')


def generate_random_name(length=10):
    return ''.join(random.choices(string.ascii_lowercase, k=length))


# ---------- Lambda Handler ----------

def lambda_handler(event, context):

    # Connect to MySQL
    conn = pymysql.connect(
        host=DB_HOST,
        user=DB_USER,
        password=DB_PASSWORD,
        database=DB_NAME,
        port=DB_PORT,
        autocommit=False
    )

    cursor = conn.cursor()

    batch_size = 100
    batch_data = []

    with open(CSV_FILE_PATH, 'r') as file:
        reader = csv.DictReader(file)

        for row in reader:

            encrypted_row = {}
            for key, value in row.items():
                encrypted_row[key] = encrypt_value(value)

            random_name = generate_random_name()

            # Adjust column names to match your CSV + schema
            batch_data.append((
                random_name,
                encrypted_row.get('col1'),
                encrypted_row.get('col2'),
                encrypted_row.get('col3')
            ))

            # Batch insert
            if len(batch_data) >= batch_size:
                cursor.executemany("""
                    INSERT INTO your_table (
                        random_name,
                        col1,
                        col2,
                        col3
                    ) VALUES (%s, %s, %s, %s)
                """, batch_data)

                conn.commit()
                batch_data.clear()

    # Insert remaining rows
    if batch_data:
        cursor.executemany("""
            INSERT INTO your_table (
                random_name,
                col1,
                col2,
                col3
            ) VALUES (%s, %s, %s, %s)
        """, batch_data)
        conn.commit()

    cursor.close()
    conn.close()

    return {
        "statusCode": 200,
        "body": "CSV processed and inserted into MySQL successfully"
    }
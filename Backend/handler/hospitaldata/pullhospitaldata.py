import json
import os
import base64
import boto3
import pymysql
import cryptography
import uuid
from datetime import datetime, timezone

print("Layer loaded successfully")

CORS_HEADERS = {
    "Access-Control-Allow-Origin": "*",  # or "http://localhost:5173" for stricter dev setup
    "Access-Control-Allow-Headers": "Content-Type,Authorization",
    "Access-Control-Allow-Methods": "GET,POST,PUT,DELETE,OPTIONS"
}

# ---------- AWS boto 3 clients ----------
kms = boto3.client('kms')
secrets_client = boto3.client('secretsmanager')
dynamodb = boto3.resource("dynamodb", region_name="us-east-2")


SECRET_NAME = os.environ['SECRET_NAME']

DB_HOST = os.environ['DB_HOST']
DB_NAME = os.environ['DB_NAME']
DB_PORT = int(os.environ.get('DB_PORT', 3306))
KMS_KEY_ID = os.environ['KMS_KEY_ID']
LOGS_TABLE = os.environ.get("LOGS_TABLE", "logs")

# secrets manager (DB credentials)
def get_db_secret():
    response = secrets_client.get_secret_value(SecretId=SECRET_NAME)
    return json.loads(response['SecretString'])

def get_connection():
    secret = get_db_secret()

    print(secret['username'], secret['password'])

    return pymysql.connect(
        host=DB_HOST,
        user=secret['username'],
        password=secret['password'],
        database=DB_NAME,
        port=DB_PORT,
        autocommit=False
    )


# ---------- ENCRYPT / DECRYPT ----------
def encrypt_value(value):
    if value is None or value == "":
        return None

    response = kms.encrypt(
        KeyId=KMS_KEY_ID,
        Plaintext=str(value).encode("utf-8")
    )
    return base64.b64encode(response["CiphertextBlob"]).decode("utf-8")


def decrypt_value(ciphertext):
    if ciphertext is None:
        return None

    # already plaintext numeric / non-encrypted field
    if isinstance(ciphertext, (int, float)):
        return ciphertext

    try:
        decoded = base64.b64decode(ciphertext)
    except Exception:
        return ciphertext  # fallback: not encrypted

    response = kms.decrypt(CiphertextBlob=decoded)
    return response["Plaintext"].decode("utf-8")


def decrypt_row(row):
    return {k: decrypt_value(v) for k, v in row.items()}


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


def write_log(staff_name, action, patient_id, status, detail):
    try:
        table = dynamodb.Table(LOGS_TABLE)
        table.put_item(
            Item={
                "staffname": staff_name,
                "logid": str(uuid.uuid4()),
                "action": action,
                "patient_id": str(patient_id) if patient_id is not None else "unknown",
                "status": status,
                "detail": detail,
                "timestamp": datetime.now(timezone.utc).isoformat()
            }
        )
    except Exception as exc:
        print(f"Failed to write audit log: {exc}")


# ---------- HELPERS ----------
def get_or_create_condition(cursor, enc_condition, cache):
    if not enc_condition:
        return None

    if enc_condition in cache:
        return cache[enc_condition]

    cursor.execute("""
        SELECT condition_id FROM MedicalConditions
        WHERE condition_name=%s
    """, (enc_condition,))
    
    result = cursor.fetchone()

    if result:
        cid = result[0]
    else:
        cursor.execute("""
            INSERT INTO MedicalConditions (condition_name)
            VALUES (%s)
        """, (enc_condition,))
        cid = cursor.lastrowid

    cache[enc_condition] = cid
    return cid


# ---------- CREATE ----------
def create_patient_full(body):
    conn = get_connection()
    cursor = conn.cursor()

    enc = {k: encrypt_value(v) for k, v in body.items()}
    cache = {}

    # Patients
    cursor.execute("""
        INSERT INTO Patients (age, gender)
        VALUES (%s, %s)
    """, (enc.get('Age'), enc.get('Gender')))
    patient_id = cursor.lastrowid

    # Condition
    cid = get_or_create_condition(cursor, enc.get('Medical Condition'), cache)
    if cid:
        cursor.execute("""
            INSERT INTO PatientConditions (patient_id, condition_id)
            VALUES (%s, %s)
        """, (patient_id, cid))

    # Vitals
    cursor.execute("""
        INSERT INTO Vitals VALUES (%s,%s,%s,%s,%s)
    """, (
        patient_id,
        enc.get('Glucose'),
        enc.get('Blood Pressure'),
        enc.get('BMI'),
        enc.get('Oxygen Saturation')
    ))

    # Labs
    cursor.execute("""
        INSERT INTO LabResults VALUES (%s,%s,%s,%s)
    """, (
        patient_id,
        enc.get('Cholesterol'),
        enc.get('Triglycerides'),
        enc.get('HbA1c')
    ))

    # Lifestyle
    cursor.execute("""
        INSERT INTO Lifestyle VALUES (%s,%s,%s,%s,%s,%s,%s)
    """, (
        patient_id,
        enc.get('Smoking'),
        enc.get('Alcohol'),
        enc.get('Physical Activity'),
        enc.get('Diet Score'),
        enc.get('Sleep Hours'),
        enc.get('Stress Level')
    ))

    # Family
    cursor.execute("""
        INSERT INTO FamilyHistory VALUES (%s,%s)
    """, (
        patient_id,
        enc.get('Family History')
    ))

    # Hospital
    cursor.execute("""
        INSERT INTO Hospitalization VALUES (%s,%s)
    """, (
        patient_id,
        enc.get('LengthOfStay')
    ))

    conn.commit()
    cursor.close()
    conn.close()

    return {"patient_id": patient_id}


# ---------- READ ----------
def get_patient_full(patient_id):
    conn = get_connection()
    cursor = conn.cursor(pymysql.cursors.DictCursor)

    result = {}

    tables = [
        "Patients", "Vitals", "LabResults",
        "Lifestyle", "FamilyHistory", "Hospitalization"
    ]

    for table in tables:
        cursor.execute(f"SELECT * FROM {table} WHERE patient_id=%s", (patient_id,))
        row = cursor.fetchone()
        if row:
            result[table] = decrypt_row(row)

    cursor.close()
    conn.close()

    return result


# ---------- UPDATE ----------
def update_patient_full(patient_id, body):
    conn = get_connection()
    cursor = conn.cursor()

    enc = {k: encrypt_value(v) for k, v in body.items()}

    # Patients
    cursor.execute("""
        UPDATE Patients SET age=%s, gender=%s
        WHERE patient_id=%s
    """, (enc.get('Age'), enc.get('Gender'), patient_id))

    # Vitals
    cursor.execute("""
        UPDATE Vitals SET glucose=%s, blood_pressure=%s, bmi=%s, oxygen_saturation=%s
        WHERE patient_id=%s
    """, (
        enc.get('Glucose'),
        enc.get('Blood Pressure'),
        enc.get('BMI'),
        enc.get('Oxygen Saturation'),
        patient_id
    ))

    # Labs
    cursor.execute("""
        UPDATE LabResults SET cholesterol=%s, triglycerides=%s, hba1c=%s
        WHERE patient_id=%s
    """, (
        enc.get('Cholesterol'),
        enc.get('Triglycerides'),
        enc.get('HbA1c'),
        patient_id
    ))

    # Lifestyle
    cursor.execute("""
        UPDATE Lifestyle SET smoking=%s, alcohol=%s, physical_activity=%s,
        diet_score=%s, sleep_hours=%s, stress_level=%s
        WHERE patient_id=%s
    """, (
        enc.get('Smoking'),
        enc.get('Alcohol'),
        enc.get('Physical Activity'),
        enc.get('Diet Score'),
        enc.get('Sleep Hours'),
        enc.get('Stress Level'),
        patient_id
    ))

    # Family
    cursor.execute("""
        UPDATE FamilyHistory SET has_family_history=%s
        WHERE patient_id=%s
    """, (enc.get('Family History'), patient_id))

    # Hospital
    cursor.execute("""
        UPDATE Hospitalization SET length_of_stay=%s
        WHERE patient_id=%s
    """, (enc.get('LengthOfStay'), patient_id))

    conn.commit()
    cursor.close()
    conn.close()

    return {"message": "updated"}


# ---------- DELETE ----------
def delete_patient_full(patient_id):
    conn = get_connection()
    cursor = conn.cursor()

    tables = [
        "PatientConditions", "Vitals", "LabResults",
        "Lifestyle", "FamilyHistory", "Hospitalization"
    ]

    for table in tables:
        cursor.execute(f"DELETE FROM {table} WHERE patient_id=%s", (patient_id,))

    cursor.execute("DELETE FROM Patients WHERE patient_id=%s", (patient_id,))

    conn.commit()
    cursor.close()
    conn.close()

    return {"message": "deleted"}


def lambda_handler(event, context):
    method = None
    path = None
    pid = None
    staff_name = get_staff_name(event)

    try:
        # normalize method (REST API v1 + HTTP API v2)
        method = (
            event.get("httpMethod")
            or event.get("requestContext", {}).get("http", {}).get("method")
        )

        path = event.get("resource") or event.get("path")
        pid = (event.get("pathParameters") or {}).get("id")

        print("METHOD:", method)
        print("PATH:", path)
        print("PID:", pid)

        if method == "OPTIONS":
            return {
                "statusCode": 204,
                "headers": CORS_HEADERS,
                "body": ""
            }

        if method == "POST" and path == "/patients":
            body = json.loads(event.get("body", "{}"))
            result = create_patient_full(body)
            write_log(staff_name, "CREATE_PATIENT", result.get("patient_id"), "SUCCESS", "Patient created")
            return response(201, result)

        if method == "GET" and pid:
            result = get_patient_full(pid)
            write_log(staff_name, "READ_PATIENT", pid, "SUCCESS", "Patient record retrieved")
            return response(200, result)

        if method == "PUT" and pid:
            body = json.loads(event.get("body", "{}"))
            result = update_patient_full(pid, body)
            write_log(staff_name, "UPDATE_PATIENT", pid, "SUCCESS", "Patient record updated")
            return response(200, result)

        if method == "DELETE" and pid:
            result = delete_patient_full(pid)
            write_log(staff_name, "DELETE_PATIENT", pid, "SUCCESS", "Patient record deleted")
            return response(200, result)

        return response(404, {
            "error": "Route not found",
            "debug": {"method": method, "path": path, "pid": pid}
        })

    except Exception as e:
        action_map = {
            "POST": "CREATE_PATIENT",
            "GET": "READ_PATIENT",
            "PUT": "UPDATE_PATIENT",
            "DELETE": "DELETE_PATIENT"
        }
        write_log(staff_name, action_map.get(method, "UNKNOWN_ACTION"), pid, "FAILED", str(e))
        return response(500, {"error": str(e)})


# ---------- RESPONSE ----------
def response(status_code, body):
    return {
        "statusCode": status_code,
        "headers": {
            "Content-Type": "application/json",
            **CORS_HEADERS
        },
        "body": json.dumps(body)
    }

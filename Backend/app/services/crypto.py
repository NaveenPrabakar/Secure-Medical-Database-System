from cryptography.fernet import Fernet

# NOTE: In production, load this from a secure key vault
FERNET_KEY = Fernet.generate_key()
fernet = Fernet(FERNET_KEY)


def encrypt_text(value: str) -> str:
    return fernet.encrypt(value.encode('utf-8')).decode('utf-8')


def decrypt_text(token: str) -> str:
    return fernet.decrypt(token.encode('utf-8')).decode('utf-8')

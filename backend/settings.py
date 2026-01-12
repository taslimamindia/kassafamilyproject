import os
from dotenv import load_dotenv


class Settings:
    def __init__(self):
        # Load environment variables from .env if present
        load_dotenv()

        # Environment (required)
        self.env = os.environ["BACKEND_ENV"]

        # Database (AWS / Local)
        self.online_db_host = os.getenv("BACKEND_ONLINE_DB_HOST")
        self.online_db_user = os.getenv("BACKEND_ONLINE_DB_USER")
        self.online_db_pass = os.getenv("BACKEND_ONLINE_DB_PASS")
        self.online_db_name = os.getenv("BACKEND_ONLINE_DB_NAME")
        self.online_db_port = int(os.getenv("BACKEND_ONLINE_DB_PORT"))

        self.local_db_host = os.getenv("BACKEND_LOCAL_DB_HOST")
        self.local_db_user = os.getenv("BACKEND_LOCAL_DB_USER")
        self.local_db_pass = os.getenv("BACKEND_LOCAL_DB_PASS")
        self.local_db_name = os.getenv("BACKEND_LOCAL_DB_NAME")
        self.local_db_port = int(os.getenv("BACKEND_LOCAL_DB_PORT", "3306"))

        # JWT (required)
        self.jwt_secret = os.environ["BACKEND_JWT_SECRET"]
        self.jwt_algorithm = os.environ["BACKEND_JWT_ALGORITHM"]
        self.jwt_exp_minutes = int(os.environ["BACKEND_JWT_EXP_MINUTES"])

        # Public paths (required)
        public_paths_raw = os.environ["BACKEND_PUBLIC_PATHS"]
        self.public_paths = {p.strip() for p in public_paths_raw.split(",") if p.strip()}

        # Default user password (required)
        self.user_password_default = os.environ["BACKEND_USER_PASSWORD_DEFAULT"]

        # Admin overrides for initial seed (optional)
        self.admin_username = os.getenv("BACKEND_ADMIN_USERNAME")
        self.admin_password = os.getenv("BACKEND_ADMIN_PASSWORD")
        self.admin_email = os.getenv("BACKEND_ADMIN_EMAIL")
        self.admin_telephone = os.getenv("BACKEND_ADMIN_TELEPHONE")
        self.admin_birthday = os.getenv("BACKEND_ADMIN_BIRTHDAY")

        # AWS S3 configuration (optional in local dev)
        self.aws_s3_bucket = os.getenv("BACKEND_AWS_S3_BUCKET")
        self.aws_region = os.getenv("BACKEND_AWS_REGION")
        self.aws_access_key_id = os.getenv("BACKEND_AWS_ACCESS_KEY_ID")
        self.aws_secret_access_key = os.getenv("BACKEND_AWS_SECRET_ACCESS_KEY")
        self.aws_s3_public_base = os.getenv("BACKEND_AWS_S3_PUBLIC_BASE")
        # Optional: base folder prefix inside the bucket (e.g., "kassa-dev")
        self.aws_s3_base_folder = os.getenv("BACKEND_AWS_S3_BASE_FOLDER")
        self.aws_base_folder = os.getenv("BACKEND_AWS_BASE_FOLDER")

    def get_db_config(self):
        if self.env == "prod":
            return {
                "host": self.online_db_host,
                "user": self.online_db_user,
                "password": self.online_db_pass,
                "database": self.online_db_name,
                "port": self.online_db_port,
                "connect_timeout": 5,
            }
        else:
            return {
                "host": self.local_db_host,
                "user": self.local_db_user,
                "password": self.local_db_pass,
                "database": self.local_db_name,
                "port": self.local_db_port,
                "connect_timeout": 5,
            }


# Singleton settings instance
settings = Settings()

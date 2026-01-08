import os
from dotenv import load_dotenv


class Settings:
    def __init__(self):
        # Load environment variables from .env if present
        load_dotenv()

        # Environment (required)
        self.env = os.environ["ENV"]

        # Database (AWS / Local)
        self.aws_db_host = os.getenv("AWS_DB_HOST")
        self.aws_db_user = os.getenv("AWS_DB_USER")
        self.aws_db_pass = os.getenv("AWS_DB_PASS")
        self.aws_db_name = os.getenv("AWS_DB_NAME")

        self.local_db_host = os.getenv("LOCAL_DB_HOST")
        self.local_db_user = os.getenv("LOCAL_DB_USER")
        self.local_db_pass = os.getenv("LOCAL_DB_PASS")
        self.local_db_name = os.getenv("LOCAL_DB_NAME")

        # JWT (required)
        self.jwt_secret = os.environ["JWT_SECRET"]
        self.jwt_algorithm = os.environ["JWT_ALGORITHM"]
        self.jwt_exp_minutes = int(os.environ["JWT_EXP_MINUTES"])

        # Public paths (required)
        public_paths_raw = os.environ["PUBLIC_PATHS"]
        self.public_paths = {p.strip() for p in public_paths_raw.split(",") if p.strip()}

        # Default user password (required)
        self.user_password_default = os.environ["USER_PASSWORD_DEFAULT"]

        # Admin overrides for initial seed (optional)
        self.admin_username = os.getenv("ADMIN_USERNAME")
        self.admin_password = os.getenv("ADMIN_PASSWORD")
        self.admin_email = os.getenv("ADMIN_EMAIL")
        self.admin_telephone = os.getenv("ADMIN_TELEPHONE")
        self.admin_birthday = os.getenv("ADMIN_BIRTHDAY")

        # AWS S3 configuration (optional in local dev)
        self.aws_s3_bucket = os.getenv("AWS_S3_BUCKET")
        self.aws_region = os.getenv("AWS_REGION")
        self.aws_access_key_id = os.getenv("AWS_ACCESS_KEY_ID")
        self.aws_secret_access_key = os.getenv("AWS_SECRET_ACCESS_KEY")
        self.aws_s3_public_base = os.getenv("AWS_S3_PUBLIC_BASE")
        # Optional: base folder prefix inside the bucket (e.g., "kassa-dev")
        self.aws_s3_base_folder = os.getenv("AWS_S3_BASE_FOLDER")
        self.aws_base_folder = os.getenv("AWS_BASE_FOLDER")

    def get_db_config(self):
        if self.env == "prod":
            return {
                "host": self.aws_db_host,
                "user": self.aws_db_user,
                "password": self.aws_db_pass,
                "database": self.aws_db_name,
                "connect_timeout": 5,
            }
        else:
            return {
                "host": self.local_db_host,
                "user": self.local_db_user,
                "password": self.local_db_pass,
                "database": self.local_db_name,
            }


# Singleton settings instance
settings = Settings()

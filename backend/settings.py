import os
from pathlib import Path
from dotenv import load_dotenv


class Settings:
    def __init__(self):
        # Load environment variables from .env if present
        load_dotenv()

        # Base directories to help resolve relative paths robustly
        self._backend_dir = Path(__file__).resolve().parent
        # Project root assumed to be parent of backend directory
        self._project_root = self._backend_dir.parent

        # Environment (required)
        self.env = os.environ["BACKEND_ENV"]

        # Database (AWS / Local)
        self.online_db_host = os.getenv("BACKEND_ONLINE_DB_HOST")
        self.online_db_user = os.getenv("BACKEND_ONLINE_DB_USER")
        self.online_db_pass = os.getenv("BACKEND_ONLINE_DB_PASS")
        self.online_db_name = os.getenv("BACKEND_ONLINE_DB_NAME")
        
        online_port = os.getenv("BACKEND_ONLINE_DB_PORT")
        self.online_db_port = int(online_port) if online_port else 3306

        self.local_db_host = os.getenv("BACKEND_LOCAL_DB_HOST")
        self.local_db_user = os.getenv("BACKEND_LOCAL_DB_USER")
        self.local_db_pass = os.getenv("BACKEND_LOCAL_DB_PASS")
        self.local_db_name = os.getenv("BACKEND_LOCAL_DB_NAME")
        self.local_db_port = int(os.getenv("BACKEND_LOCAL_DB_PORT", "3306"))

        # Optional: route DB via SSH tunnel (e.g., Lightsail with PEM)
        self.db_via_ssh = str(os.getenv("BACKEND_DB_VIA_SSH", "false")).strip().lower() in {"1", "true", "yes"}
        
        if self.db_via_ssh:
            self.ssh_host = os.getenv("BACKEND_SSH_HOST")
            self.ssh_port = int(os.getenv("BACKEND_SSH_PORT", "22"))
            self.ssh_user = os.getenv("BACKEND_SSH_USER")
            # Absolute or relative path to the .pem private key
            self.ssh_key_path = os.getenv("BACKEND_SSH_KEY_PATH")
            # Optional SSH key passphrase and/or password
            self.ssh_key_password = os.getenv("BACKEND_SSH_KEY_PASSWORD")
            self.ssh_password = os.getenv("BACKEND_SSH_PASSWORD")
            # Where MySQL is listening on the remote host (usually 127.0.0.1:3306)
            self.ssh_remote_bind_host = os.getenv("BACKEND_SSH_REMOTE_BIND_HOST", "127.0.0.1")
            self.ssh_remote_bind_port = int(os.getenv("BACKEND_SSH_REMOTE_BIND_PORT", "3306"))
        else:
            self.ssh_host = None
            self.ssh_port = 22
            self.ssh_user = None
            self.ssh_key_path = None
            self.ssh_key_password = None
            self.ssh_password = None
            self.ssh_remote_bind_host = "127.0.0.1"
            self.ssh_remote_bind_port = 3306

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

        # Resolve SSH key path early so downstream code consistently gets an absolute path
        if self.db_via_ssh:
            if self.ssh_key_path:
                resolved = self._resolve_path(self.ssh_key_path)
                if Path(resolved).exists():
                    self.ssh_key_path = resolved
                else:
                    # Fallback to common key filenames at project root
                    for candidate in [
                        self._project_root / "new_key",
                        self._project_root / "new_key.pem",
                    ]:
                        if candidate.exists():
                            self.ssh_key_path = str(candidate.resolve())
                            break
                    else:
                        # Keep the resolved path even if missing; downstream code will error clearly
                        self.ssh_key_path = resolved
            else:
                # Optional default: if a file named 'new_key' exists at project root, use it
                default_key = self._project_root / "new_key"
                if default_key.exists():
                    self.ssh_key_path = str(default_key)
                # Else leave as None; code paths will handle missing key configuration

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

    def _resolve_path(self, path_str: str) -> str:
        """Resolve a potentially relative path to an absolute path.
        Tries current working directory, backend directory, and project root.
        Also expands ~ (home) and environment variables.
        """
        # Expand ~ and environment variables first
        expanded = os.path.expanduser(os.path.expandvars(path_str))
        candidate_paths = [
            Path(expanded),
            self._backend_dir / expanded,
            self._project_root / expanded,
        ]
        for p in candidate_paths:
            try:
                if p.exists():
                    return str(p.resolve())
            except Exception:
                # If path is malformed, skip
                pass
        # If none exist, return absolute path based on expanded as-is
        return str(Path(expanded).resolve())


# Singleton settings instance
settings = Settings()

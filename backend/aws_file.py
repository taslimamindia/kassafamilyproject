import boto3
import io
from botocore.exceptions import BotoCoreError, ClientError
from typing import Dict, Optional
import logging

logger = logging.getLogger("aws")

class AwsFile:
    def delete_image(self, url: Optional[str]) -> bool:
        """Delete an image from S3 using its URL."""
        if not url:
            return False
        # Extract key from URL
        base_url = self.settings.aws_s3_public_base.rstrip('/') if self.settings.aws_s3_public_base else None
        if base_url and url.startswith(base_url):
            key = url[len(base_url):].lstrip('/')
        else:
            # fallback for default AWS url
            parts = url.split(f".amazonaws.com/")
            key = parts[1] if len(parts) == 2 else None
        if not key:
            logger.warning(f"[aws] Unable to extract key from url: {url}")
            return False
        try:
            self._client.delete_object(Bucket=self.settings.aws_s3_bucket, Key=key)
            logger.info(f"[aws] Deleted image: {key}")
            return True
        except Exception as e:
            logger.exception(f"[aws] Failed to delete image: {key}")
            return False
    def __init__(self, settings):
        self.settings = settings
        if not self.settings.aws_s3_bucket or not self.settings.aws_region:
            raise RuntimeError("AWS S3 not configured: missing bucket or region")
        self._client = self._build_client()

    def _build_client(self):
        session_kwargs = {}
        if self.settings.aws_access_key_id and self.settings.aws_secret_access_key:
            session_kwargs.update(
                aws_access_key_id=self.settings.aws_access_key_id,
                aws_secret_access_key=self.settings.aws_secret_access_key,
            )
        return boto3.client("s3", region_name=self.settings.aws_region, **session_kwargs)

    def _ext_from(self, filename: Optional[str], content_type: Optional[str]) -> str:
        if filename and "." in filename:
            return filename.rsplit(".", 1)[-1].lower()
        if content_type:
            try:
                _, sub = content_type.split("/", 1)
                known_types = {
                    "jpeg": "jpg",
                    "svg+xml": "svg",
                    "x-icon": "ico",
                    "vnd.microsoft.icon": "ico",
                    "tiff": "tiff",
                    "webp": "webp",
                    "png": "png",
                    "gif": "gif",
                    "bmp": "bmp"
                }
                return known_types.get(sub, sub)
            except Exception:
                pass
        return "bin"

    def _safe_username(self, username: str) -> str:
        uname = (username or "").strip()
        safe = "".join(ch for ch in uname if ch.isalnum() or ch in ("-", "_"))
        return safe

    def _base_folder(self) -> str:
        # Prefer AWS_S3_BASE_FOLDER; fallback to AWS_BASE_FOLDER if provided
        base = (self.settings.aws_s3_base_folder or self.settings.aws_base_folder or "").strip()
        if not base:
            return ""
        # normalize: no leading/trailing slashes; we'll add one when composing
        base = base.strip("/")
        return base

    def _upload_core(self, upload_file, folder: str, filename: Optional[str] = None) -> Dict[str, str]:
        content_type = getattr(upload_file, "content_type", None) or "application/octet-stream"
        if not content_type.startswith("image/"):
            raise ValueError("Le fichier doit être une image")

        ext = self._ext_from(getattr(upload_file, "filename", None), content_type)
        
        if filename:
            safe_name = self._safe_username(filename)
        else:
            orig_name = getattr(upload_file, "filename", "image")
            if "." in orig_name:
                orig_name = orig_name.rsplit(".", 1)[0]
            safe_name = self._safe_username(orig_name)
            
        if not safe_name:
            safe_name = "image"
            
        full_filename = f"{safe_name}.{ext}"
        base = self._base_folder()
        clean_folder = folder.strip("/")
        
        key_parts = [p for p in (base, clean_folder, full_filename) if p]
        key = "/".join(key_parts)

        try:
            logger.info("[aws] Upload start: bucket=%s, key=%s, content_type=%s", self.settings.aws_s3_bucket, key, content_type)
            # Read the entire stream upfront to safely retry without depending on original stream state
            try:
                data = upload_file.file.read()
            finally:
                # Best effort reset (some frameworks may reuse the file later)
                if hasattr(upload_file.file, "seek"):
                    try:
                        upload_file.file.seek(0)
                    except Exception:
                        pass

            # First try with ACL public-read (legacy buckets). Some buckets enforce Object Ownership and disable ACLs.
            try:
                self._client.upload_fileobj(
                    io.BytesIO(data),
                    self.settings.aws_s3_bucket,
                    key,
                    ExtraArgs={"ContentType": content_type, "ACL": "public-read"},
                )
            except ClientError as ce:
                code = getattr(ce, "response", {}).get("Error", {}).get("Code")
                msg = str(ce)
                acl_not_supported = code == "AccessControlListNotSupported" or ("ACL" in msg and "not allow" in msg)
                if acl_not_supported:
                    logger.warning("[aws] Bucket does not allow ACLs; retrying without ACL for key=%s", key)
                    self._client.upload_fileobj(
                        io.BytesIO(data),
                        self.settings.aws_s3_bucket,
                        key,
                        ExtraArgs={"ContentType": content_type},
                    )
                else:
                    raise
        except (BotoCoreError, ClientError, Exception) as e:
            logger.exception("[aws] Upload failed for key=%s", key)
            raise RuntimeError(str(e))

        if self.settings.aws_s3_public_base:
            url = f"{self.settings.aws_s3_public_base.rstrip('/')}/{key}"
        else:
            url = f"https://{self.settings.aws_s3_bucket}.s3.{self.settings.aws_region}.amazonaws.com/{key}"
        logger.info("[aws] Upload success: key=%s, url=%s", key, url)
        return {"url": url, "key": key}

    def add_image(self, upload_file, folder: str, filename: Optional[str] = None) -> Dict[str, str]:
        """Upload an image to a specific folder in S3."""
        return self._upload_core(upload_file, folder, filename)

    def update_image(self, old_url: Optional[str], upload_file, folder: str, filename: Optional[str] = None) -> Dict[str, str]:
        """Update an image. Ignores old_url as deletion is disabled."""
        return self._upload_core(upload_file, folder, filename)


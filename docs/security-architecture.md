# Security Architecture

## Overview

A comprehensive security framework designed to protect trading assets, API credentials, system infrastructure, and sensitive data through multiple layers of defense, encryption, access controls, and continuous monitoring.

## Security Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                            Security Command Center                              │
│                   (SIEM, Threat Intelligence, Incident Response)                  │
└─────────────────────────────────────────────────────────────────────────────────┘
                                            │
┌─────────────────────────────────────────────────────────────────────────────────┐
│                           Defense in Depth Layers                                │
│  ┌─────────────┐ ┌─────────────┐ ┌─────────────┐ ┌─────────────┐ ┌─────────────┐│
│  │   Network   │ │ Application │ │    Data     │ │   Identity  │ │   Physical  ││
│  │ Security    │ │  Security   │ │  Security   │ │ & Access    │ │ Security    ││
│  └─────────────┘ └─────────────┘ └─────────────┘ └─────────────┘ └─────────────┘│
└─────────────────────────────────────────────────────────────────────────────────┘
                                            │
┌─────────────────────────────────────────────────────────────────────────────────┐
│                           Core Security Services                                 │
│  ┌─────────────┐ ┌─────────────┐ ┌─────────────┐ ┌─────────────┐ ┌─────────────┐│
│  │   Secrets   │ │   Identity  │ │ Encryption  │ │   Audit &   │ │   Threat    ││
│  │ Management  │ │ & Access    ││   Service   ││   Logging   ││ Detection   ││
│  └─────────────┘ └─────────────┘ └─────────────┘ └─────────────┘ └─────────────┘│
└─────────────────────────────────────────────────────────────────────────────────┘
                                            │
┌─────────────────────────────────────────────────────────────────────────────────┐
│                          Compliance & Governance                                │
│  ┌─────────────┐ ┌─────────────┐ ┌─────────────┐ ┌─────────────┐ ┌─────────────┐│
│  │   SOC 2     │ │   ISO 27001 │ │   GDPR      │ │   SOX       │ │   Risk      ││
│  │Compliance   │ │Compliance   │ │Compliance   │ │Compliance   │ │ Management  ││
│  └─────────────┘ └─────────────┘ └─────────────┘ └─────────────┘ └─────────────┘│
└─────────────────────────────────────────────────────────────────────────────────┘
```

## Core Security Components

### Secrets Management System
```python
import asyncio
import os
import json
import hashlib
import hmac
import base64
from cryptography.fernet import Fernet
from cryptography.hazmat.primitives import hashes
from cryptography.hazmat.primitives.kdf.pbkdf2 import PBKDF2HMAC
from typing import Dict, List, Optional, Any, Tuple
from datetime import datetime, timedelta
from enum import Enum
import logging
import aiofiles
import aiohttp

class SecretType(Enum):
    API_KEY = "api_key"
    PRIVATE_KEY = "private_key"
    PASSWORD = "password"
    CERTIFICATE = "certificate"
    DATABASE_CREDENTIALS = "database_credentials"
    ENCRYPTION_KEY = "encryption_key"

class AccessLevel(Enum):
    READ = "read"
    WRITE = "write"
    ADMIN = "admin"
    EMERGENCY = "emergency"

@dataclass
class SecretMetadata:
    name: str
    type: SecretType
    description: str
    owner: str
    created_at: datetime
    last_rotated: datetime
    rotation_interval_days: int
    access_level: AccessLevel
    tags: List[str]
    environment: str  # development, staging, production

class SecretsManager:
    def __init__(self, config: Dict[str, Any]):
        self.config = config
        self.encryption_key = None
        self.secrets_store = {}
        self.access_log = []
        self.rotation_schedule = {}
        self.logger = logging.getLogger(__name__)

        # Initialize encryption
        self._initialize_encryption()

        # Load existing secrets
        asyncio.create_task(self._load_secrets())

    def _initialize_encryption(self):
        """Initialize encryption system with master key"""
        # Derive encryption key from master password
        master_password = self.config.get('master_password').encode()
        salt = self.config.get('encryption_salt', b'moondev_trading_salt').encode()

        kdf = PBKDF2HMAC(
            algorithm=hashes.SHA256(),
            length=32,
            salt=salt,
            iterations=100000,
        )
        key = base64.urlsafe_b64encode(kdf.derive(master_password))
        self.encryption_key = key

    def _encrypt_secret(self, secret_data: str) -> str:
        """Encrypt secret data"""
        f = Fernet(self.encryption_key)
        encrypted_data = f.encrypt(secret_data.encode())
        return base64.urlsafe_b64encode(encrypted_data).decode()

    def _decrypt_secret(self, encrypted_data: str) -> str:
        """Decrypt secret data"""
        f = Fernet(self.encryption_key)
        encrypted_bytes = base64.urlsafe_b64decode(encrypted_data.encode())
        decrypted_data = f.decrypt(encrypted_bytes)
        return decrypted_data.decode()

    async def store_secret(self, name: str, secret_data: str, metadata: SecretMetadata,
                         requester: str, reason: str) -> bool:
        """Store a new secret with full audit trail"""
        try:
            # Validate requester permissions
            if not await self._validate_permissions(requester, AccessLevel.WRITE, metadata.environment):
                raise PermissionError(f"User {requester} lacks write permissions")

            # Encrypt the secret
            encrypted_secret = self._encrypt_secret(secret_data)

            # Store in memory and persistent storage
            secret_entry = {
                'name': name,
                'encrypted_data': encrypted_secret,
                'metadata': metadata,
                'checksum': self._calculate_checksum(secret_data)
            }

            self.secrets_store[name] = secret_entry

            # Save to persistent storage
            await self._save_secret_to_storage(name, secret_entry)

            # Log access
            await self._log_access(name, requester, 'store', reason, True)

            # Schedule rotation
            await self._schedule_rotation(name, metadata)

            self.logger.info(f"Secret {name} stored successfully by {requester}")
            return True

        except Exception as e:
            self.logger.error(f"Failed to store secret {name}: {e}")
            await self._log_access(name, requester, 'store', reason, False, str(e))
            return False

    async def retrieve_secret(self, name: str, requester: str, reason: str) -> Optional[str]:
        """Retrieve a secret with full audit trail"""
        try:
            # Check if secret exists
            if name not in self.secrets_store:
                self.logger.warning(f"Secret {name} not found")
                return None

            secret_entry = self.secrets_store[name]
            metadata = secret_entry['metadata']

            # Validate permissions
            if not await self._validate_permissions(requester, AccessLevel.READ, metadata.environment):
                raise PermissionError(f"User {requester} lacks read permissions")

            # Decrypt the secret
            decrypted_secret = self._decrypt_secret(secret_entry['encrypted_data'])

            # Verify integrity
            current_checksum = self._calculate_checksum(decrypted_secret)
            if current_checksum != secret_entry['checksum']:
                raise ValueError("Secret integrity check failed")

            # Log access
            await self._log_access(name, requester, 'retrieve', reason, True)

            self.logger.info(f"Secret {name} retrieved by {requester}")
            return decrypted_secret

        except Exception as e:
            self.logger.error(f"Failed to retrieve secret {name}: {e}")
            await self._log_access(name, requester, 'retrieve', reason, False, str(e))
            return None

    async def rotate_secret(self, name: str, new_secret_data: str,
                           requester: str, reason: str) -> bool:
        """Rotate an existing secret"""
        try:
            if name not in self.secrets_store:
                raise ValueError(f"Secret {name} not found")

            secret_entry = self.secrets_store[name]
            metadata = secret_entry['metadata']

            # Validate admin permissions for rotation
            if not await self._validate_permissions(requester, AccessLevel.ADMIN, metadata.environment):
                raise PermissionError(f"User {requester} lacks admin permissions")

            # Create backup of old secret
            old_secret = self._decrypt_secret(secret_entry['encrypted_data'])
            await self._create_secret_backup(name, old_secret, metadata)

            # Update with new secret
            await self.store_secret(name, new_secret_data, metadata, requester, reason)

            # Update metadata
            metadata.last_rotated = datetime.now()
            secret_entry['metadata'] = metadata

            # Log rotation
            await self._log_access(name, requester, 'rotate', reason, True)

            self.logger.info(f"Secret {name} rotated successfully by {requester}")
            return True

        except Exception as e:
            self.logger.error(f"Failed to rotate secret {name}: {e}")
            await self._log_access(name, requester, 'rotate', reason, False, str(e))
            return False

    async def revoke_secret(self, name: str, requester: str, reason: str) -> bool:
        """Revoke access to a secret"""
        try:
            if name not in self.secrets_store:
                raise ValueError(f"Secret {name} not found")

            # Validate admin permissions
            secret_entry = self.secrets_store[name]
            metadata = secret_entry['metadata']

            if not await self._validate_permissions(requester, AccessLevel.ADMIN, metadata.environment):
                raise PermissionError(f"User {requester} lacks admin permissions")

            # Create backup before revocation
            old_secret = self._decrypt_secret(secret_entry['encrypted_data'])
            await self._create_secret_backup(name, old_secret, metadata)

            # Remove from active store
            del self.secrets_store[name]

            # Remove from storage
            await self._remove_secret_from_storage(name)

            # Log revocation
            await self._log_access(name, requester, 'revoke', reason, True)

            self.logger.info(f"Secret {name} revoked by {requester}")
            return True

        except Exception as e:
            self.logger.error(f"Failed to revoke secret {name}: {e}")
            await self._log_access(name, requester, 'revoke', reason, False, str(e))
            return False

    async def get_exchange_credentials(self, exchange: str, requester: str,
                                     reason: str) -> Optional[Dict[str, str]]:
        """Get complete exchange credentials with audit trail"""
        try:
            # Retrieve API key
            api_key_name = f"{exchange}_api_key"
            api_key = await self.retrieve_secret(api_key_name, requester, reason)
            if not api_key:
                return None

            # Retrieve secret
            secret_name = f"{exchange}_secret"
            secret = await self.retrieve_secret(secret_name, requester, reason)
            if not secret:
                return None

            # Check for additional credentials (passphrase, etc.)
            passphrase_name = f"{exchange}_passphrase"
            passphrase = await self.retrieve_secret(passphrase_name, requester, reason)

            credentials = {
                'api_key': api_key,
                'secret': secret
            }

            if passphrase:
                credentials['passphrase'] = passphrase

            return credentials

        except Exception as e:
            self.logger.error(f"Failed to retrieve {exchange} credentials: {e}")
            return None

    async def _validate_permissions(self, requester: str, required_level: AccessLevel,
                                  environment: str) -> bool:
        """Validate user permissions for secret access"""
        # This would integrate with your IAM system
        # For now, implement basic role-based checking

        user_roles = await self._get_user_roles(requester)
        environment_access = await self._get_environment_access(requester)

        # Check environment access
        if environment not in environment_access:
            return False

        # Check permission level
        role_hierarchy = {
            'read_only': AccessLevel.READ,
            'trader': AccessLevel.WRITE,
            'admin': AccessLevel.ADMIN,
            'emergency_responder': AccessLevel.EMERGENCY
        }

        max_permission = max([role_hierarchy.get(role, AccessLevel.READ) for role in user_roles])

        return max_permission.value >= required_level.value

    async def _get_user_roles(self, user: str) -> List[str]:
        """Get user roles from IAM system"""
        # This would integrate with your authentication system
        # For demo purposes, return basic roles
        if user.startswith('admin'):
            return ['admin']
        elif user.startswith('trader'):
            return ['trader']
        else:
            return ['read_only']

    async def _get_environment_access(self, user: str) -> List[str]:
        """Get user's environment access permissions"""
        # This would integrate with your access control system
        # For demo purposes, return all environments
        return ['development', 'staging', 'production']

    def _calculate_checksum(self, data: str) -> str:
        """Calculate SHA-256 checksum of data"""
        return hashlib.sha256(data.encode()).hexdigest()

    async def _log_access(self, secret_name: str, requester: str, action: str,
                         reason: str, success: bool, error: str = None):
        """Log all secret access attempts"""
        access_log_entry = {
            'timestamp': datetime.now().isoformat(),
            'secret_name': secret_name,
            'requester': requester,
            'action': action,
            'reason': reason,
            'success': success,
            'error': error,
            'ip_address': '127.0.0.1',  # Would be extracted from request
            'user_agent': 'System'  # Would be extracted from request
        }

        self.access_log.append(access_log_entry)

        # Also log to security monitoring system
        await self._log_to_security_system(access_log_entry)

    async def _log_to_security_system(self, log_entry: Dict[str, Any]):
        """Send log entry to security monitoring system"""
        # Integration with your SIEM or security monitoring
        self.logger.info(f"Security log: {json.dumps(log_entry)}")

    async def _save_secret_to_storage(self, name: str, secret_entry: Dict[str, Any]):
        """Save secret to persistent storage"""
        storage_path = self.config.get('secrets_storage_path', '/var/secrets')
        file_path = os.path.join(storage_path, f"{name}.secret")

        os.makedirs(storage_path, exist_ok=True)

        # Convert metadata to serializable format
        serializable_entry = secret_entry.copy()
        serializable_entry['metadata'] = {
            'name': secret_entry['metadata'].name,
            'type': secret_entry['metadata'].type.value,
            'description': secret_entry['metadata'].description,
            'owner': secret_entry['metadata'].owner,
            'created_at': secret_entry['metadata'].created_at.isoformat(),
            'last_rotated': secret_entry['metadata'].last_rotated.isoformat(),
            'rotation_interval_days': secret_entry['metadata'].rotation_interval_days,
            'access_level': secret_entry['metadata'].access_level.value,
            'tags': secret_entry['metadata'].tags,
            'environment': secret_entry['metadata'].environment
        }

        async with aiofiles.open(file_path, 'w') as f:
            await f.write(json.dumps(serializable_entry))

        # Set secure file permissions
        os.chmod(file_path, 0o600)

    async def _load_secrets(self):
        """Load existing secrets from storage"""
        storage_path = self.config.get('secrets_storage_path', '/var/secrets')

        if not os.path.exists(storage_path):
            return

        for filename in os.listdir(storage_path):
            if filename.endswith('.secret'):
                secret_name = filename[:-7]  # Remove .secret extension
                file_path = os.path.join(storage_path, filename)

                try:
                    async with aiofiles.open(file_path, 'r') as f:
                        secret_data = json.loads(await f.read())

                    # Convert metadata back to SecretMetadata object
                    metadata_dict = secret_data['metadata']
                    metadata = SecretMetadata(
                        name=metadata_dict['name'],
                        type=SecretType(metadata_dict['type']),
                        description=metadata_dict['description'],
                        owner=metadata_dict['owner'],
                        created_at=datetime.fromisoformat(metadata_dict['created_at']),
                        last_rotated=datetime.fromisoformat(metadata_dict['last_rotated']),
                        rotation_interval_days=metadata_dict['rotation_interval_days'],
                        access_level=AccessLevel(metadata_dict['access_level']),
                        tags=metadata_dict['tags'],
                        environment=metadata_dict['environment']
                    )

                    secret_entry = {
                        'name': secret_data['name'],
                        'encrypted_data': secret_data['encrypted_data'],
                        'metadata': metadata,
                        'checksum': secret_data['checksum']
                    }

                    self.secrets_store[secret_name] = secret_entry

                except Exception as e:
                    self.logger.error(f"Failed to load secret {secret_name}: {e}")

    async def _create_secret_backup(self, name: str, secret_data: str, metadata: SecretMetadata):
        """Create backup of secret before rotation/revocation"""
        backup_path = self.config.get('backup_path', '/var/secrets/backups')
        os.makedirs(backup_path, exist_ok=True)

        timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
        backup_filename = f"{name}_backup_{timestamp}.secret"
        backup_file_path = os.path.join(backup_path, backup_filename)

        backup_data = {
            'name': name,
            'secret_data': secret_data,  # Store unencrypted in backup
            'metadata': {
                'name': metadata.name,
                'type': metadata.type.value,
                'description': metadata.description,
                'owner': metadata.owner,
                'created_at': metadata.created_at.isoformat(),
                'last_rotated': metadata.last_rotated.isoformat(),
                'rotation_interval_days': metadata.rotation_interval_days,
                'access_level': metadata.access_level.value,
                'tags': metadata.tags,
                'environment': metadata.environment
            },
            'backup_timestamp': datetime.now().isoformat()
        }

        async with aiofiles.open(backup_file_path, 'w') as f:
            await f.write(json.dumps(backup_data))

        # Encrypt backup file
        await self._encrypt_backup_file(backup_file_path)

    async def _encrypt_backup_file(self, file_path: str):
        """Encrypt backup file with additional layer of security"""
        # This would implement additional encryption for backup files
        os.chmod(file_path, 0o600)

    async def _remove_secret_from_storage(self, name: str):
        """Remove secret from persistent storage"""
        storage_path = self.config.get('secrets_storage_path', '/var/secrets')
        file_path = os.path.join(storage_path, f"{name}.secret")

        if os.path.exists(file_path):
            os.remove(file_path)

    async def _schedule_rotation(self, name: str, metadata: SecretMetadata):
        """Schedule automatic secret rotation"""
        if metadata.rotation_interval_days > 0:
            next_rotation = metadata.last_rotated + timedelta(days=metadata.rotation_interval_days)
            self.rotation_schedule[name] = next_rotation

    async def check_rotation_schedule(self):
        """Check and execute scheduled secret rotations"""
        now = datetime.now()

        for name, rotation_time in self.rotation_schedule.items():
            if now >= rotation_time:
                await self._auto_rotate_secret(name)

    async def _auto_rotate_secret(self, name: str):
        """Automatically rotate a secret"""
        # This would implement automatic rotation logic
        # For API keys, it would call the exchange's rotation API
        # For passwords, it would generate new ones
        self.logger.info(f"Auto-rotating secret: {name}")
        # Implementation depends on secret type
```

### API Key Management for Exchanges
```python
import hmac
import hashlib
import time
from typing import Dict, Optional, Tuple
from urllib.parse import urlencode

class ExchangeAPIAuthenticator:
    def __init__(self, secrets_manager: SecretsManager):
        self.secrets_manager = secrets_manager
        self.nonce_cache = {}

    async def authenticate_hyperliquid_request(self, method: str, endpoint: str,
                                             payload: Dict[str, Any],
                                             requester: str = "system") -> Dict[str, str]:
        """Authenticate Hyperliquid API request"""
        try:
            # Get exchange credentials
            credentials = await self.secrets_manager.get_exchange_credentials(
                "hyperliquid", requester, f"API request to {endpoint}"
            )

            if not credentials:
                raise ValueError("Hyperliquid credentials not available")

            api_key = credentials['api_key']
            secret_key = credentials['secret']

            # Generate timestamp
            timestamp = str(int(time.time() * 1000))

            # Create signature
            message = timestamp + json.dumps(payload, separators=(',', ':'))
            signature = hmac.new(
                secret_key.encode(),
                message.encode(),
                hashlib.sha256
            ).hexdigest()

            headers = {
                'Content-Type': 'application/json',
                'Authorization': f'Bearer {api_key}',
                'X-Signature': signature,
                'X-Timestamp': timestamp
            }

            return headers

        except Exception as e:
            self.logger.error(f"Failed to authenticate Hyperliquid request: {e}")
            raise

    async def authenticate_phemex_request(self, method: str, endpoint: str,
                                        payload: Dict[str, Any],
                                        requester: str = "system") -> Dict[str, str]:
        """Authenticate Phemex API request"""
        try:
            # Get exchange credentials
            credentials = await self.secrets_manager.get_exchange_credentials(
                "phemex", requester, f"API request to {endpoint}"
            )

            if not credentials:
                raise ValueError("Phemex credentials not available")

            api_key = credentials['api_key']
            secret_key = credentials['secret']

            # Generate nonce
            nonce = str(int(time.time() * 1000))
            self.nonce_cache[f"phemex_{api_key}"] = nonce

            # Create signature
            message = f"{method}{endpoint}{nonce}{json.dumps(payload, separators=(',', ':'))}"
            signature = hmac.new(
                secret_key.encode(),
                message.encode(),
                hashlib.sha256
            ).hexdigest()

            headers = {
                'Content-Type': 'application/json',
                'Authorization': f'Bearer {api_key}',
                'X-Signature': signature,
                'X-Nonce': nonce
            }

            return headers

        except Exception as e:
            self.logger.error(f"Failed to authenticate Phemex request: {e}")
            raise

    async def create_secure_api_session(self, exchange: str,
                                      requester: str = "system") -> Optional[Dict[str, str]]:
        """Create secure API session with enhanced security"""
        try:
            # Get exchange credentials
            credentials = await self.secrets_manager.get_exchange_credentials(
                exchange, requester, "Create API session"
            )

            if not credentials:
                return None

            # Generate session token
            session_token = self._generate_session_token()

            # Store session securely
            session_data = {
                'exchange': exchange,
                'api_key': credentials['api_key'],
                'session_token': session_token,
                'created_at': datetime.now().isoformat(),
                'expires_at': (datetime.now() + timedelta(hours=1)).isoformat(),
                'requester': requester
            }

            # This would store in Redis or other session store
            await self._store_secure_session(session_token, session_data)

            return {
                'session_token': session_token,
                'exchange': exchange,
                'expires_in': 3600  # 1 hour
            }

        except Exception as e:
            self.logger.error(f"Failed to create secure API session: {e}")
            return None

    def _generate_session_token(self) -> str:
        """Generate secure session token"""
        import secrets
        return secrets.token_urlsafe(32)

    async def _store_secure_session(self, token: str, session_data: Dict[str, Any]):
        """Store session securely"""
        # This would integrate with Redis or other secure session store
        pass
```

### Network Security & Firewall Configuration
```python
import iptables
import asyncio
from typing import List, Dict, Optional
from ipaddress import ip_network, ip_address
import geoip2.database

class NetworkSecurityManager:
    def __init__(self, config: Dict[str, Any]):
        self.config = config
        self.allowed_ips = set()
        self.blocked_ips = set()
        self.rate_limits = {}
        self.geoip_db = None
        self.logger = logging.getLogger(__name__)

        # Initialize GeoIP database
        self._initialize_geoip()

        # Load security rules
        self._load_security_rules()

    def _initialize_geoip(self):
        """Initialize GeoIP database for geographic blocking"""
        try:
            geoip_db_path = self.config.get('geoip_db_path', '/var/lib/GeoIP/GeoLite2-City.mmdb')
            self.geoip_db = geoip2.database.Reader(geoip_db_path)
        except Exception as e:
            self.logger.warning(f"Could not initialize GeoIP database: {e}")

    def _load_security_rules(self):
        """Load network security rules"""
        # Load allowed IP ranges
        allowed_ranges = self.config.get('allowed_ip_ranges', [
            '127.0.0.1/32',  # Localhost
            '10.0.0.0/8',    # Private networks
            '172.16.0.0/12', # Private networks
            '192.168.0.0/16' # Private networks
        ])

        for range_str in allowed_ranges:
            self.allowed_ips.update(ip_network(range_str))

        # Load blocked countries
        self.blocked_countries = self.config.get('blocked_countries', [])

        # Initialize rate limits
        default_rate_limits = {
            'api_requests': {'requests': 100, 'window': 60},  # 100 requests per minute
            'auth_attempts': {'requests': 5, 'window': 300},  # 5 attempts per 5 minutes
            'failed_logins': {'requests': 3, 'window': 900},  # 3 attempts per 15 minutes
        }

        self.rate_limits.update(self.config.get('rate_limits', default_rate_limits))

    async def validate_request(self, client_ip: str, endpoint: str,
                             method: str, headers: Dict[str, str]) -> Tuple[bool, Optional[str]]:
        """Validate incoming request against security rules"""
        try:
            # Check IP whitelist/blacklist
            if not await self._validate_ip_address(client_ip):
                return False, "IP address not allowed"

            # Check geographic restrictions
            if not await self._validate_geographic_location(client_ip):
                return False, "Geographic location not allowed"

            # Check rate limiting
            if not await self._check_rate_limit(client_ip, endpoint):
                return False, "Rate limit exceeded"

            # Check request headers for security
            if not await self._validate_request_headers(headers):
                return False, "Invalid request headers"

            # Check for common attack patterns
            if not await self._check_attack_patterns(endpoint, method, headers):
                return False, "Suspicious request pattern detected"

            return True, None

        except Exception as e:
            self.logger.error(f"Error validating request from {client_ip}: {e}")
            return False, "Validation error"

    async def _validate_ip_address(self, client_ip: str) -> bool:
        """Validate IP address against whitelist/blacklist"""
        try:
            ip = ip_address(client_ip)

            # Check if IP is blocked
            if ip in self.blocked_ips:
                return False

            # Check if IP is in allowed ranges
            for allowed_network in self.allowed_ips:
                if ip in allowed_network:
                    return True

            # If no allowed ranges are configured, allow all (except blocked)
            if not self.allowed_ips:
                return True

            return False

        except ValueError:
            return False

    async def _validate_geographic_location(self, client_ip: str) -> bool:
        """Validate IP address against geographic restrictions"""
        if not self.geoip_db or not self.blocked_countries:
            return True

        try:
            response = self.geoip_db.city(client_ip)
            country_code = response.country.iso_code

            return country_code not in self.blocked_countries

        except Exception:
            # If GeoIP lookup fails, allow the request
            return True

    async def _check_rate_limit(self, client_ip: str, endpoint: str) -> bool:
        """Check if client has exceeded rate limits"""
        # This would integrate with Redis or other rate limiting store
        # For now, implement basic in-memory rate limiting
        current_time = int(time.time())

        for limit_name, limit_config in self.rate_limits.items():
            key = f"{client_ip}:{endpoint}:{limit_name}"

            if key not in self.rate_limits:
                self.rate_limits[key] = {'count': 0, 'reset_time': current_time + limit_config['window']}

            limit_data = self.rate_limits[key]

            # Reset counter if window has expired
            if current_time >= limit_data['reset_time']:
                limit_data['count'] = 0
                limit_data['reset_time'] = current_time + limit_config['window']

            # Check limit
            if limit_data['count'] >= limit_config['requests']:
                return False

            limit_data['count'] += 1

        return True

    async def _validate_request_headers(self, headers: Dict[str, str]) -> bool:
        """Validate request headers for security"""
        # Check for required security headers
        required_headers = ['User-Agent']
        for header in required_headers:
            if header not in headers:
                return False

        # Check for suspicious headers
        suspicious_headers = [
            'X-Forwarded-For',
            'X-Real-IP',
            'X-Originating-IP'
        ]

        for header in suspicious_headers:
            if header in headers:
                # Additional validation for these headers
                pass

        return True

    async def _check_attack_patterns(self, endpoint: str, method: str,
                                   headers: Dict[str, str]) -> bool:
        """Check for common attack patterns"""
        # SQL Injection patterns
        sql_patterns = ["'", '"', ';', '--', '/*', '*/', 'xp_', 'sp_']
        user_agent = headers.get('User-Agent', '')

        for pattern in sql_patterns:
            if pattern in user_agent:
                return False

        # XSS patterns
        xss_patterns = ['<script', '</script>', 'javascript:', 'onload=', 'onerror=']
        for pattern in xss_patterns:
            if pattern in user_agent:
                return False

        # Path traversal
        if '../' in endpoint or '%2e%2e%2f' in endpoint.lower():
            return False

        # Command injection
        command_patterns = ['|', '&', ';', '$(', '`', '&&', '||']
        for pattern in command_patterns:
            if pattern in endpoint:
                return False

        return True

    async def block_ip_address(self, ip_address: str, reason: str,
                             duration_hours: int = 24):
        """Block an IP address"""
        try:
            ip = ip_address(ip_address)
            self.blocked_ips.add(ip)

            # Log blocking
            self.logger.warning(f"Blocked IP address {ip_address} for {duration_hours} hours. Reason: {reason}")

            # Schedule unblock
            asyncio.create_task(self._unblock_ip_after_duration(ip, duration_hours))

            # Update firewall rules
            await self._update_firewall_rules()

        except ValueError as e:
            self.logger.error(f"Invalid IP address {ip_address}: {e}")

    async def _unblock_ip_after_duration(self, ip: ip_address, duration_hours: int):
        """Unblock IP address after specified duration"""
        await asyncio.sleep(duration_hours * 3600)

        if ip in self.blocked_ips:
            self.blocked_ips.remove(ip)
            self.logger.info(f"Unblocked IP address {ip}")

            # Update firewall rules
            await self._update_firewall_rules()

    async def _update_firewall_rules(self):
        """Update firewall rules with current IP blocks"""
        # This would integrate with your firewall management system
        # For now, just log the update
        self.logger.info(f"Updating firewall rules. Blocked IPs: {len(self.blocked_ips)}")

    async def get_security_status(self) -> Dict[str, Any]:
        """Get current security status"""
        return {
            'allowed_networks': [str(network) for network in self.allowed_ips],
            'blocked_ips': len(self.blocked_ips),
            'blocked_countries': self.blocked_countries,
            'rate_limits_active': len(self.rate_limits),
            'geoip_enabled': self.geoip_db is not None,
            'timestamp': datetime.now().isoformat()
        }
```

### Identity and Access Management (IAM)
```python
import jwt
import bcrypt
from datetime import datetime, timedelta
from typing import Dict, List, Optional, Any, Tuple
from enum import Enum

class UserRole(Enum):
    TRADER = "trader"
    RISK_ANALYST = "risk_analyst"
    SYSTEM_ADMIN = "system_admin"
    SECURITY_ADMIN = "security_admin"
    COMPLIANCE_OFFICER = "compliance_officer"
    EMERGENCY_RESPONDER = "emergency_responder"

class Permission(Enum):
    READ_MARKET_DATA = "read_market_data"
    PLACE_ORDERS = "place_orders"
    MANAGE_POSITIONS = "manage_positions"
    VIEW_RISK_METRICS = "view_risk_metrics"
    MODIFY_RISK_PARAMETERS = "modify_risk_parameters"
    ACCESS_SECRETS = "access_secrets"
    MANAGE_USERS = "manage_users"
    VIEW_AUDIT_LOGS = "view_audit_logs"
    EMERGENCY_OVERRIDE = "emergency_override"

class IAMManager:
    def __init__(self, config: Dict[str, Any]):
        self.config = config
        self.jwt_secret = config.get('jwt_secret')
        self.user_sessions = {}
        self.audit_log = []
        self.logger = logging.getLogger(__name__)

        # Initialize role-permission mappings
        self._initialize_role_permissions()

    def _initialize_role_permissions(self):
        """Initialize role-permission mappings"""
        self.role_permissions = {
            UserRole.TRADER: [
                Permission.READ_MARKET_DATA,
                Permission.PLACE_ORDERS,
                Permission.MANAGE_POSITIONS,
                Permission.VIEW_RISK_METRICS
            ],
            UserRole.RISK_ANALYST: [
                Permission.READ_MARKET_DATA,
                Permission.VIEW_RISK_METRICS,
                Permission.MODIFY_RISK_PARAMETERS,
                Permission.VIEW_AUDIT_LOGS
            ],
            UserRole.SYSTEM_ADMIN: [
                Permission.READ_MARKET_DATA,
                Permission.ACCESS_SECRETS,
                Permission.MANAGE_USERS,
                Permission.VIEW_AUDIT_LOGS
            ],
            UserRole.SECURITY_ADMIN: [
                Permission.ACCESS_SECRETS,
                Permission.MANAGE_USERS,
                Permission.VIEW_AUDIT_LOGS,
                Permission.EMERGENCY_OVERRIDE
            ],
            UserRole.COMPLIANCE_OFFICER: [
                Permission.READ_MARKET_DATA,
                Permission.VIEW_RISK_METRICS,
                Permission.VIEW_AUDIT_LOGS
            ],
            UserRole.EMERGENCY_RESPONDER: [
                Permission.READ_MARKET_DATA,
                Permission.MANAGE_POSITIONS,
                Permission.VIEW_RISK_METRICS,
                Permission.EMERGENCY_OVERRIDE
            ]
        }

    async def authenticate_user(self, username: str, password: str,
                              client_ip: str) -> Optional[str]:
        """Authenticate user and return JWT token"""
        try:
            # Get user credentials from database
            user_data = await self._get_user_credentials(username)

            if not user_data:
                await self._log_authentication_event(username, client_ip, False, "User not found")
                return None

            # Verify password
            if not self._verify_password(password, user_data['password_hash']):
                await self._log_authentication_event(username, client_ip, False, "Invalid password")
                return None

            # Check if user is active
            if not user_data.get('is_active', True):
                await self._log_authentication_event(username, client_ip, False, "User inactive")
                return None

            # Generate JWT token
            token = self._generate_jwt_token(username, user_data['roles'], client_ip)

            # Store session
            session_id = self._generate_session_id()
            self.user_sessions[session_id] = {
                'username': username,
                'roles': user_data['roles'],
                'client_ip': client_ip,
                'created_at': datetime.now(),
                'last_activity': datetime.now()
            }

            await self._log_authentication_event(username, client_ip, True, "Authentication successful")

            return token

        except Exception as e:
            self.logger.error(f"Authentication error for user {username}: {e}")
            await self._log_authentication_event(username, client_ip, False, str(e))
            return None

    async def authorize_action(self, token: str, required_permission: Permission,
                             resource: str, client_ip: str) -> Tuple[bool, Optional[str]]:
        """Authorize user action based on JWT token and permissions"""
        try:
            # Validate JWT token
            payload = self._validate_jwt_token(token, client_ip)
            if not payload:
                return False, "Invalid or expired token"

            username = payload['username']
            user_roles = [UserRole(role) for role in payload['roles']]

            # Check if user has required permission
            has_permission = self._check_permission(user_roles, required_permission)

            if not has_permission:
                await self._log_authorization_event(username, required_permission.value,
                                                  resource, client_ip, False, "Insufficient permissions")
                return False, "Insufficient permissions"

            # Update session activity
            await self._update_session_activity(username)

            # Log successful authorization
            await self._log_authorization_event(username, required_permission.value,
                                              resource, client_ip, True, "Authorized")

            return True, None

        except Exception as e:
            self.logger.error(f"Authorization error: {e}")
            return False, "Authorization error"

    def _verify_password(self, password: str, password_hash: str) -> bool:
        """Verify password against hash"""
        return bcrypt.checkpw(password.encode('utf-8'), password_hash.encode('utf-8'))

    def _hash_password(self, password: str) -> str:
        """Hash password using bcrypt"""
        salt = bcrypt.gensalt()
        return bcrypt.hashpw(password.encode('utf-8'), salt).decode('utf-8')

    def _generate_jwt_token(self, username: str, roles: List[str], client_ip: str) -> str:
        """Generate JWT token for authenticated user"""
        payload = {
            'username': username,
            'roles': roles,
            'client_ip': client_ip,
            'iat': datetime.utcnow(),
            'exp': datetime.utcnow() + timedelta(hours=24)  # 24 hour expiration
        }

        return jwt.encode(payload, self.jwt_secret, algorithm='HS256')

    def _validate_jwt_token(self, token: str, client_ip: str) -> Optional[Dict]:
        """Validate JWT token and return payload"""
        try:
            payload = jwt.decode(token, self.jwt_secret, algorithms=['HS256'])

            # Check if token is blacklisted
            if self._is_token_blacklisted(token):
                return None

            # Check IP address match (optional enhanced security)
            if payload.get('client_ip') != client_ip:
                self.logger.warning(f"IP address mismatch for token: {payload.get('client_ip')} vs {client_ip}")

            return payload

        except jwt.ExpiredSignatureError:
            return None
        except jwt.InvalidTokenError:
            return None

    def _check_permission(self, user_roles: List[UserRole], required_permission: Permission) -> bool:
        """Check if any of the user's roles have the required permission"""
        for role in user_roles:
            if role in self.role_permissions:
                if required_permission in self.role_permissions[role]:
                    return True
        return False

    def _generate_session_id(self) -> str:
        """Generate secure session ID"""
        import secrets
        return secrets.token_urlsafe(32)

    async def _update_session_activity(self, username: str):
        """Update user's last activity timestamp"""
        for session_id, session_data in self.user_sessions.items():
            if session_data['username'] == username:
                session_data['last_activity'] = datetime.now()
                break

    async def logout_user(self, token: str) -> bool:
        """Logout user and invalidate token"""
        try:
            payload = self._validate_jwt_token(token, "")
            if payload:
                username = payload['username']

                # Remove from sessions
                sessions_to_remove = [
                    session_id for session_id, session_data in self.user_sessions.items()
                    if session_data['username'] == username
                ]

                for session_id in sessions_to_remove:
                    del self.user_sessions[session_id]

                # Blacklist token
                self._blacklist_token(token)

                self.logger.info(f"User {username} logged out")
                return True

        except Exception as e:
            self.logger.error(f"Logout error: {e}")

        return False

    def _blacklist_token(self, token: str):
        """Add token to blacklist"""
        # This would integrate with Redis or other token blacklist store
        # For now, implement in-memory blacklist
        if not hasattr(self, 'token_blacklist'):
            self.token_blacklist = set()
        self.token_blacklist.add(token)

    def _is_token_blacklisted(self, token: str) -> bool:
        """Check if token is blacklisted"""
        return hasattr(self, 'token_blacklist') and token in self.token_blacklist

    async def _get_user_credentials(self, username: str) -> Optional[Dict]:
        """Get user credentials from database"""
        # This would integrate with your user database
        # For demo purposes, return mock data
        if username == "admin":
            return {
                'username': 'admin',
                'password_hash': self._hash_password("admin123"),
                'roles': ['system_admin', 'security_admin'],
                'is_active': True
            }
        elif username == "trader":
            return {
                'username': 'trader',
                'password_hash': self._hash_password("trader123"),
                'roles': ['trader'],
                'is_active': True
            }
        return None

    async def _log_authentication_event(self, username: str, client_ip: str,
                                      success: bool, reason: str):
        """Log authentication events"""
        event = {
            'timestamp': datetime.now().isoformat(),
            'event_type': 'authentication',
            'username': username,
            'client_ip': client_ip,
            'success': success,
            'reason': reason
        }

        self.audit_log.append(event)
        self.logger.info(f"Auth event: {username} from {client_ip} - {'Success' if success else 'Failed'} ({reason})")

    async def _log_authorization_event(self, username: str, permission: str,
                                     resource: str, client_ip: str,
                                     success: bool, reason: str):
        """Log authorization events"""
        event = {
            'timestamp': datetime.now().isoformat(),
            'event_type': 'authorization',
            'username': username,
            'permission': permission,
            'resource': resource,
            'client_ip': client_ip,
            'success': success,
            'reason': reason
        }

        self.audit_log.append(event)
        self.logger.info(f"Authz event: {username} requesting {permission} on {resource} from {client_ip} - {'Success' if success else 'Failed'} ({reason})")

    async def get_user_permissions(self, username: str) -> List[Permission]:
        """Get all permissions for a user"""
        user_data = await self._get_user_credentials(username)
        if not user_data:
            return []

        user_roles = [UserRole(role) for role in user_data['roles']]
        permissions = set()

        for role in user_roles:
            if role in self.role_permissions:
                permissions.update(self.role_permissions[role])

        return list(permissions)
```

This comprehensive security architecture provides enterprise-grade protection through multiple layers of defense, including secrets management, network security, identity and access management, and continuous monitoring and auditing.
from flask import Flask, render_template, jsonify, request, redirect, url_for, flash, session, Response
from flask_login import LoginManager, UserMixin, login_user, logout_user, login_required, current_user
from flask_mail import Mail, Message
from flask_wtf.csrf import CSRFProtect
from werkzeug.security import check_password_hash, generate_password_hash
from werkzeug.utils import secure_filename
import json
import os
import psycopg2
from psycopg2.extras import RealDictCursor
from datetime import datetime, timedelta
import secrets
import threading
import shutil
from pathlib import Path
from dotenv import load_dotenv
import re

# Load environment variables from .env file if it exists
load_dotenv()

# No-op logger for deployment environments that don't accept logging
# All logger calls will work but won't actually log anything
class NoOpLogger:
    """A logger that does nothing - all methods are no-ops"""
    def debug(self, *args, **kwargs): pass
    def info(self, *args, **kwargs): pass
    def warning(self, *args, **kwargs): pass
    def error(self, *args, **kwargs): pass
    def critical(self, *args, **kwargs): pass
    def exception(self, *args, **kwargs): pass
    def setLevel(self, *args, **kwargs): pass
    def addHandler(self, *args, **kwargs): pass

logger = NoOpLogger()

app = Flask(__name__)

# CRITICAL: Secret key must be from environment variable
SECRET_KEY = os.getenv('APP_SECRET_KEY')
if not SECRET_KEY or SECRET_KEY == 'dev-secret-key-change-in-production':
    logger.critical('SECURITY ERROR: Using default secret key. Set APP_SECRET_KEY environment variable!')
    if os.getenv('FLASK_ENV') == 'production':
        raise ValueError('APP_SECRET_KEY must be set in production')
    SECRET_KEY = secrets.token_hex(32)
    logger.warning(f'Generated temporary secret key (DEV ONLY): {SECRET_KEY}')

app.secret_key = SECRET_KEY

# Session configuration
app.config['PERMANENT_SESSION_LIFETIME'] = timedelta(hours=1)
app.config['SESSION_COOKIE_SECURE'] = os.getenv('FLASK_ENV', 'development') == 'production'
app.config['SESSION_COOKIE_HTTPONLY'] = True
app.config['SESSION_COOKIE_SAMESITE'] = 'Lax'

# CSRF Protection
csrf = CSRFProtect(app)

# Image upload configuration (stored in database, not filesystem)
ALLOWED_EXTENSIONS = {'png', 'jpg', 'jpeg', 'gif', 'webp'}
MAX_FILE_SIZE = 5 * 1024 * 1024  # 5MB in bytes

app.config['MAX_CONTENT_LENGTH'] = MAX_FILE_SIZE

# Image database connection string (separate from main database)
IMAGE_DATABASE_URL = os.getenv('IMAGE_DATABASE_URL')

# Convert asyncpg connection string format to psycopg2 format if needed
if IMAGE_DATABASE_URL.startswith('postgresql+asyncpg://'):
    IMAGE_DATABASE_URL = IMAGE_DATABASE_URL.replace('postgresql+asyncpg://', 'postgresql://', 1)

if not IMAGE_DATABASE_URL:
    logger.error('IMAGE_DATABASE_URL environment variable not set!')
    raise ValueError('IMAGE_DATABASE_URL must be set for image storage')

# Database connection string
DATABASE_URL = os.getenv('DATABASE_URL')
if not DATABASE_URL:
    logger.error('DATABASE_URL environment variable not set!')
    if os.getenv('FLASK_ENV') == 'production':
        raise ValueError('DATABASE_URL must be set in production')
    logger.warning('Using SQLite fallback for development')

# Connection pool for better performance
from psycopg2 import pool
_db_pool = None
_db_pool_lock = threading.Lock()

def init_db_pool():
    """Initialize database connection pool"""
    global _db_pool
    if not DATABASE_URL:
        logger.warning('Skipping connection pool initialization: DATABASE_URL not set')
        return False
    
    try:
        with _db_pool_lock:
            _db_pool = psycopg2.pool.SimpleConnectionPool(1, 5, DATABASE_URL)
        logger.info('Database connection pool created successfully')
        return True
    except Exception as e:
        logger.error(f'Error creating connection pool: {e}')
        _db_pool = None
        return False

def get_db_connection():
    """Get a database connection from the pool"""
    global _db_pool
    if not DATABASE_URL:
        logger.error('DATABASE_URL not configured')
        raise ValueError('Database not configured')
    
    if _db_pool is None:
        if not init_db_pool():
            raise ValueError('Failed to initialize connection pool')
    
    if _db_pool:
        try:
            return _db_pool.getconn()
        except Exception as e:
            logger.error(f'Error getting connection from pool: {e}')
            raise
    else:
        logger.error('Connection pool is not available')
        raise ValueError('Connection pool failed')

def return_db_connection(conn):
    """Return a connection to the pool"""
    global _db_pool
    if _db_pool and conn:
        try:
            _db_pool.putconn(conn)
        except Exception as e:
            logger.error(f'Error returning connection to pool: {e}')
            try:
                conn.close()
            except:
                pass
    elif conn:
        try:
            conn.close()
        except:
            pass

@app.teardown_appcontext
def close_connection(exception):
    """Clean up database connection on request end"""
    if exception:
        logger.error(f'Request context error: {exception}')

# Image database connection pool (separate from main database)
_image_db_pool = None
_image_db_pool_lock = threading.Lock()
_image_db_initialized = False

def init_image_db_pool():
    """Initialize image database connection pool"""
    global _image_db_pool
    if not IMAGE_DATABASE_URL:
        logger.error('IMAGE_DATABASE_URL not set')
        return False
    
    try:
        with _image_db_pool_lock:
            _image_db_pool = psycopg2.pool.SimpleConnectionPool(1, 5, IMAGE_DATABASE_URL)
        logger.info('Image database connection pool created successfully')
        return True
    except Exception as e:
        logger.error(f'Error creating image database connection pool: {e}')
        _image_db_pool = None
        return False

def get_image_db_connection():
    """Get a connection from the image database pool"""
    global _image_db_pool
    if not IMAGE_DATABASE_URL:
        raise ValueError('IMAGE_DATABASE_URL not configured')
    
    if _image_db_pool is None:
        if not init_image_db_pool():
            raise ValueError('Failed to initialize image database connection pool')
    
    if _image_db_pool:
        try:
            return _image_db_pool.getconn()
        except Exception as e:
            logger.error(f'Error getting image database connection: {e}')
            raise
    else:
        raise ValueError('Image database connection pool failed')

def return_image_db_connection(conn):
    """Return a connection to the image database pool"""
    global _image_db_pool
    if _image_db_pool and conn:
        try:
            _image_db_pool.putconn(conn)
        except Exception as e:
            logger.error(f'Error returning image database connection: {e}')
            try:
                conn.close()
            except:
                pass
    elif conn:
        try:
            conn.close()
        except:
            pass

def init_image_db(force=False):
    """Initialize image database table if it doesn't exist"""
    global _image_db_initialized
    if _image_db_initialized and not force:
        return
    
    if not IMAGE_DATABASE_URL:
        logger.error('IMAGE_DATABASE_URL not set, cannot initialize image database')
        return
    
    conn = None
    try:
        conn = get_image_db_connection()
        cur = conn.cursor()
        
        # Create images table
        cur.execute('''
            CREATE TABLE IF NOT EXISTS uploaded_images (
                id SERIAL PRIMARY KEY,
                filename VARCHAR(255) NOT NULL,
                file_data BYTEA NOT NULL,
                content_type VARCHAR(100) NOT NULL,
                file_size INTEGER NOT NULL,
                project_id INTEGER,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                UNIQUE(filename)
            )
        ''')
        
        # Create index on filename for faster lookups
        cur.execute('''
            CREATE INDEX IF NOT EXISTS idx_uploaded_images_filename 
            ON uploaded_images(filename)
        ''')
        
        conn.commit()
        cur.close()
        _image_db_initialized = True
        logger.info('Image database initialized successfully')
    except Exception as e:
        logger.error(f'Error initializing image database: {e}')
        _image_db_initialized = False
        raise
    finally:
        if conn:
            return_image_db_connection(conn)

# Initialize database tables
_db_initialized = False

def init_db(force=False):
    """Initialize database tables if they don't exist"""
    global _db_initialized
    if _db_initialized and not force:
        return
    
    if not DATABASE_URL:
        logger.warning('Skipping database initialization: DATABASE_URL not set')
        return
    
    conn = None
    try:
        conn = get_db_connection()
        cur = conn.cursor()
        
        # Create users table
        cur.execute('''
            CREATE TABLE IF NOT EXISTS users (
                id SERIAL PRIMARY KEY,
                username VARCHAR(80) UNIQUE NOT NULL,
                email VARCHAR(120) UNIQUE NOT NULL,
                password_hash VARCHAR(255) NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                is_active BOOLEAN DEFAULT TRUE,
                is_admin BOOLEAN DEFAULT FALSE,
                force_password_change BOOLEAN DEFAULT FALSE
            )
        ''')
        
        # Create password_reset_tokens table
        cur.execute('''
            CREATE TABLE IF NOT EXISTS password_reset_tokens (
                id SERIAL PRIMARY KEY,
                user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
                token VARCHAR(255) UNIQUE NOT NULL,
                expires_at TIMESTAMP NOT NULL,
                used BOOLEAN DEFAULT FALSE,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        ''')
        
        # Create login_attempts table for brute-force protection
        cur.execute('''
            CREATE TABLE IF NOT EXISTS login_attempts (
                id SERIAL PRIMARY KEY,
                username VARCHAR(80),
                attempted_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                success BOOLEAN DEFAULT FALSE
            )
        ''')
        
        # Create audit_logs table
        cur.execute('''
            CREATE TABLE IF NOT EXISTS audit_logs (
                id SERIAL PRIMARY KEY,
                user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
                action VARCHAR(255) NOT NULL,
                resource_type VARCHAR(100),
                resource_id VARCHAR(255),
                details TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        ''')
        
        # Create projects table
        cur.execute('''
            CREATE TABLE IF NOT EXISTS projects (
                id SERIAL PRIMARY KEY,
                boma_id VARCHAR(50),
                name VARCHAR(255) NOT NULL,
                status VARCHAR(50) NOT NULL,
                units INTEGER DEFAULT 0,
                image TEXT,
                lat DECIMAL(10, 8),
                lon DECIMAL(11, 8),
                description TEXT,
                unit_types TEXT,
                price_start INTEGER,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        ''')
        
        # Create default admin user if it doesn't exist
        cur.execute('SELECT COUNT(*) FROM users WHERE username = %s', ('admin',))
        if cur.fetchone()[0] == 0:
            # CRITICAL: Generate strong temporary password
            temp_password = secrets.token_urlsafe(16)
            admin_hash = generate_password_hash(temp_password)
            cur.execute('''
                INSERT INTO users (username, email, password_hash, is_active, is_admin, force_password_change)
                VALUES (%s, %s, %s, %s, %s, %s)
            ''', ('admin', 'info@spationex.com', admin_hash, True, True, True))
            logger.warning(f'DEFAULT ADMIN CREATED - TEMPORARY PASSWORD: {temp_password} - SET APP_ADMIN_PASSWORD IN .env IMMEDIATELY!')
        
        conn.commit()
        cur.close()
        _db_initialized = True
        logger.info('Database initialized successfully')
    except Exception as e:
        logger.error(f'Error initializing database: {e}')
        _db_initialized = False  # Reset flag so it can be retried
        raise
    finally:
        if conn:
            return_db_connection(conn)

# Initialize Flask-Login
login_manager = LoginManager()
login_manager.init_app(app)
login_manager.login_view = 'login'
login_manager.login_message = 'Please log in to access the admin panel.'
login_manager.login_message_category = 'info'

# Initialize Flask-Mail
app.config['MAIL_SERVER'] = os.environ.get('MAIL_SERVER', 'smtp.gmail.com')
app.config['MAIL_PORT'] = int(os.environ.get('MAIL_PORT', 587))
app.config['MAIL_USE_TLS'] = os.environ.get('MAIL_USE_TLS', 'true').lower() in ['true', 'on', '1']
app.config['MAIL_USERNAME'] = os.environ.get('MAIL_USERNAME', '')
app.config['MAIL_PASSWORD'] = os.environ.get('MAIL_PASSWORD', '')
app.config['MAIL_DEFAULT_SENDER'] = os.environ.get('MAIL_DEFAULT_SENDER', 'noreply@kituihousing.com')

mail = Mail(app)

# User class for Flask-Login
class User(UserMixin):
    def __init__(self, id, username=None, email=None, is_admin=False):
        self.id = id
        self.username = username
        self.email = email
        self.is_admin = is_admin

@login_manager.user_loader
def load_user(user_id):
    """Load user from database"""
    conn = None
    try:
        conn = get_db_connection()
        cur = conn.cursor(cursor_factory=RealDictCursor)
        cur.execute('SELECT id, username, email, is_admin FROM users WHERE id = %s AND is_active = TRUE', (user_id,))
        user_data = cur.fetchone()
        cur.close()
        
        if user_data:
            return User(
                id=user_data['id'],
                username=user_data['username'],
                email=user_data['email'],
                is_admin=user_data['is_admin']
            )
        return None
    except Exception as e:
        logger.error(f'Error loading user: {e}')
        return None
    finally:
        if conn:
            return_db_connection(conn)

# Database helper functions
def get_user_by_username(username):
    """Get user by username"""
    conn = None
    try:
        conn = get_db_connection()
        cur = conn.cursor(cursor_factory=RealDictCursor)
        cur.execute('SELECT * FROM users WHERE username = %s', (username,))
        user = cur.fetchone()
        cur.close()
        return user
    except Exception as e:
        logger.error(f'Error getting user: {e}')
        return None
    finally:
        if conn:
            return_db_connection(conn)

def get_user_by_email(email):
    """Get user by email"""
    conn = None
    try:
        conn = get_db_connection()
        cur = conn.cursor(cursor_factory=RealDictCursor)
        cur.execute('SELECT * FROM users WHERE email = %s', (email,))
        user = cur.fetchone()
        cur.close()
        return user
    except Exception as e:
        logger.error(f'Error getting user by email: {e}')
        return None
    finally:
        if conn:
            return_db_connection(conn)

def create_user(username, email, password_hash, is_active=False, is_admin=False):
    """Create a new user"""
    conn = None
    try:
        conn = get_db_connection()
        cur = conn.cursor()
        cur.execute('''
            INSERT INTO users (username, email, password_hash, is_active, is_admin)
            VALUES (%s, %s, %s, %s, %s)
            RETURNING id
        ''', (username, email, password_hash, is_active, is_admin))
        user_id = cur.fetchone()[0]
        conn.commit()
        cur.close()
        logger.info(f'User created: {username} (active: {is_active}, admin: {is_admin})')
        return user_id
    except psycopg2.IntegrityError as e:
        logger.warning(f'Integrity error creating user: {e}')
        if 'username' in str(e):
            raise ValueError('Username already exists')
        elif 'email' in str(e):
            raise ValueError('Email already exists')
        raise
    except Exception as e:
        logger.error(f'Error creating user: {e}')
        raise
    finally:
        if conn:
            return_db_connection(conn)

def create_password_reset_token(user_id):
    """Create a password reset token"""
    conn = None
    try:
        conn = get_db_connection()
        cur = conn.cursor()
        
        # Delete old unused tokens for this user
        cur.execute('DELETE FROM password_reset_tokens WHERE user_id = %s AND used = FALSE', (user_id,))
        
        # Create new token
        token = secrets.token_urlsafe(32)
        expires_at = datetime.utcnow() + timedelta(hours=1)  # Token valid for 1 hour
        
        cur.execute('''
            INSERT INTO password_reset_tokens (user_id, token, expires_at)
            VALUES (%s, %s, %s)
            RETURNING token
        ''', (user_id, token, expires_at))
        
        conn.commit()
        cur.close()
        logger.info(f'Password reset token created for user_id: {user_id}')
        return token
    except Exception as e:
        logger.error(f'Error creating reset token: {e}')
        raise
    finally:
        if conn:
            return_db_connection(conn)

def get_user_by_reset_token(token):
    """Get user by reset token if valid"""
    conn = None
    try:
        conn = get_db_connection()
        cur = conn.cursor(cursor_factory=RealDictCursor)
        cur.execute('''
            SELECT u.*, prt.expires_at, prt.used
            FROM users u
            JOIN password_reset_tokens prt ON u.id = prt.user_id
            WHERE prt.token = %s AND prt.used = FALSE AND prt.expires_at > CURRENT_TIMESTAMP
        ''', (token,))
        result = cur.fetchone()
        cur.close()
        return result
    except Exception as e:
        logger.error(f'Error getting user by token: {e}')
        return None
    finally:
        if conn:
            return_db_connection(conn)

def mark_token_as_used(token):
    """Mark a reset token as used"""
    conn = None
    try:
        conn = get_db_connection()
        cur = conn.cursor()
        cur.execute('UPDATE password_reset_tokens SET used = TRUE WHERE token = %s', (token,))
        conn.commit()
        cur.close()
    except Exception as e:
        logger.error(f'Error marking token as used: {e}')
    finally:
        if conn:
            return_db_connection(conn)

def update_user_password(user_id, password_hash):
    """Update user password"""
    conn = None
    try:
        conn = get_db_connection()
        cur = conn.cursor()
        cur.execute('UPDATE users SET password_hash = %s, force_password_change = FALSE WHERE id = %s', (password_hash, user_id))
        conn.commit()
        cur.close()
        logger.info(f'Password updated for user_id: {user_id}')
    except Exception as e:
        logger.error(f'Error updating password: {e}')
        raise
    finally:
        if conn:
            return_db_connection(conn)

def log_audit_event(user_id, action, resource_type, resource_id, details=None):
    """Log audit event for admin actions"""
    conn = None
    try:
        conn = get_db_connection()
        cur = conn.cursor()
        cur.execute('''
            INSERT INTO audit_logs (user_id, action, resource_type, resource_id, details)
            VALUES (%s, %s, %s, %s, %s)
        ''', (user_id, action, resource_type, resource_id, details))
        conn.commit()
        cur.close()
        logger.info(f'Audit log: user_id={user_id}, action={action}, resource={resource_type}:{resource_id}')
    except Exception as e:
        logger.error(f'Error logging audit event: {e}')
    finally:
        if conn:
            return_db_connection(conn)

# User management functions
def get_all_users():
    """Get all users from database"""
    if not DATABASE_URL:
        return []
    
    # Ensure database is initialized
    init_db()
    
    conn = None
    try:
        conn = get_db_connection()
        cur = conn.cursor(cursor_factory=RealDictCursor)
        cur.execute('''
            SELECT id, username, email, is_active, is_admin, created_at
            FROM users
            ORDER BY created_at DESC
        ''')
        users = cur.fetchall()
        cur.close()
        
        # Convert to list of dicts
        result = []
        for user in users:
            result.append({
                'id': user['id'],
                'username': user['username'],
                'email': user['email'],
                'is_active': user['is_active'],
                'is_admin': user['is_admin'],
                'created_at': user['created_at'].strftime('%Y-%m-%d %H:%M:%S') if user['created_at'] else None
            })
        
        return result
    except Exception as e:
        logger.error(f'Error loading users: {e}')
        return []
    finally:
        if conn:
            return_db_connection(conn)

def update_user_status(user_id, is_active):
    """Update user active status"""
    if not DATABASE_URL:
        raise ValueError('DATABASE_URL not set')
    
    # Ensure database is initialized
    init_db()
    
    conn = None
    try:
        conn = get_db_connection()
        cur = conn.cursor(cursor_factory=RealDictCursor)
        
        # Get user info for logging
        cur.execute('SELECT username, email FROM users WHERE id = %s', (user_id,))
        user_data = cur.fetchone()
        if not user_data:
            raise ValueError('User not found')
        
        cur.execute('UPDATE users SET is_active = %s WHERE id = %s', (is_active, user_id))
        conn.commit()
        cur.close()
        
        status = 'activated' if is_active else 'deactivated'
        logger.info(f'User {status}: {user_data["username"]} (id: {user_id})')
        return user_data['username']
    except Exception as e:
        logger.error(f'Error updating user status: {e}')
        if conn:
            conn.rollback()
        raise
    finally:
        if conn:
            return_db_connection(conn)

def update_user_admin_status(user_id, is_admin):
    """Update user admin status"""
    if not DATABASE_URL:
        raise ValueError('DATABASE_URL not set')
    
    # Ensure database is initialized
    init_db()
    
    conn = None
    try:
        conn = get_db_connection()
        cur = conn.cursor(cursor_factory=RealDictCursor)
        
        # Get user info for logging
        cur.execute('SELECT username, email FROM users WHERE id = %s', (user_id,))
        user_data = cur.fetchone()
        if not user_data:
            raise ValueError('User not found')
        
        cur.execute('UPDATE users SET is_admin = %s WHERE id = %s', (is_admin, user_id))
        conn.commit()
        cur.close()
        
        status = 'granted admin privileges' if is_admin else 'revoked admin privileges'
        logger.info(f'User {status}: {user_data["username"]} (id: {user_id})')
        return user_data['username']
    except Exception as e:
        logger.error(f'Error updating user admin status: {e}')
        if conn:
            conn.rollback()
        raise
    finally:
        if conn:
            return_db_connection(conn)

# Database functions for projects
def load_projects_from_db():
    """Load all projects from database"""
    if not DATABASE_URL:
        logger.warning('DATABASE_URL not set, falling back to JSON')
        return load_projects()
    
    # Ensure database is initialized
    init_db()
    
    conn = None
    try:
        conn = get_db_connection()
        cur = conn.cursor(cursor_factory=RealDictCursor)
        cur.execute('''
            SELECT id, boma_id, name, status, units, image, lat, lon, 
                   description, unit_types, price_start
            FROM projects
            ORDER BY id
        ''')
        projects = cur.fetchall()
        cur.close()
        
        # Convert to list of dicts
        result = []
        for project in projects:
            result.append({
                'id': project['id'],
                'boma_id': project['boma_id'] or 'N/A',
                'name': project['name'],
                'status': project['status'],
                'units': project['units'],
                'image': project['image'] or '',
                'lat': float(project['lat']) if project['lat'] else 0.0,
                'lon': float(project['lon']) if project['lon'] else 0.0,
                'description': project['description'] or '',
                'unit_types': project['unit_types'] or '',
                'price_start': project['price_start']
            })
        
        logger.debug(f'Loaded {len(result)} projects from database')
        return result
    except Exception as e:
        logger.error(f'Error loading projects from database: {e}')
        # Fallback to JSON if database fails
        logger.warning('Falling back to JSON file')
        return load_projects()
    finally:
        if conn:
            return_db_connection(conn)

def add_project_to_db(boma_id, name, status, units, image, lat, lon, description, unit_types, price_start):
    """Add a new project to database"""
    if not DATABASE_URL:
        raise ValueError('DATABASE_URL not set')
    
    # Ensure database is initialized
    init_db()
    
    conn = None
    try:
        conn = get_db_connection()
        cur = conn.cursor()
        cur.execute('''
            INSERT INTO projects (boma_id, name, status, units, image, lat, lon, description, unit_types, price_start)
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
            RETURNING id
        ''', (boma_id, name, status, units, image, lat, lon, description, unit_types, price_start))
        project_id = cur.fetchone()[0]
        conn.commit()
        cur.close()
        logger.info(f'Project added to database: {name} (id: {project_id})')
        return project_id
    except Exception as e:
        logger.error(f'Error adding project to database: {e}')
        raise
    finally:
        if conn:
            return_db_connection(conn)

def update_project_in_db(project_id, boma_id, name, status, units, image, lat, lon, description, unit_types, price_start):
    """Update a project in database"""
    if not DATABASE_URL:
        raise ValueError('DATABASE_URL not set')
    
    # Ensure database is initialized
    init_db()
    
    conn = None
    try:
        conn = get_db_connection()
        cur = conn.cursor()
        cur.execute('''
            UPDATE projects 
            SET boma_id = %s, name = %s, status = %s, units = %s, image = %s, 
                lat = %s, lon = %s, description = %s, unit_types = %s, 
                price_start = %s, updated_at = CURRENT_TIMESTAMP
            WHERE id = %s
        ''', (boma_id, name, status, units, image, lat, lon, description, unit_types, price_start, project_id))
        conn.commit()
        cur.close()
        logger.info(f'Project updated in database: {name} (id: {project_id})')
    except Exception as e:
        logger.error(f'Error updating project in database: {e}')
        raise
    finally:
        if conn:
            return_db_connection(conn)

def delete_project_from_db(project_id):
    """Delete a project from database"""
    if not DATABASE_URL:
        raise ValueError('DATABASE_URL not set')
    
    # Ensure database is initialized
    init_db()
    
    conn = None
    try:
        conn = get_db_connection()
        cur = conn.cursor()
        cur.execute('SELECT name FROM projects WHERE id = %s', (project_id,))
        result = cur.fetchone()
        if not result:
            raise ValueError('Project not found')
        
        project_name = result[0]
        cur.execute('DELETE FROM projects WHERE id = %s', (project_id,))
        conn.commit()
        cur.close()
        logger.info(f'Project deleted from database: {project_name} (id: {project_id})')
        return project_name
    except Exception as e:
        logger.error(f'Error deleting project from database: {e}')
        raise
    finally:
        if conn:
            return_db_connection(conn)

def migrate_projects_from_json(force=False):
    """Migrate projects from JSON file to database"""
    if not DATABASE_URL:
        logger.warning('DATABASE_URL not set, cannot migrate')
        return False
    
    # Ensure database is initialized first
    init_db()
    
    conn = None
    try:
        # Check if projects already exist in database (unless force is True)
        conn = get_db_connection()
        cur = conn.cursor()
        cur.execute('SELECT COUNT(*) FROM projects')
        count = cur.fetchone()[0]
        
        if count > 0 and not force:
            logger.info(f'Database already has {count} projects. Skipping migration. Use force=True to migrate anyway.')
            cur.close()
            return True
        
        # Load projects from JSON
        json_projects = load_projects()
        if not json_projects:
            logger.warning('No projects found in JSON file to migrate')
            cur.close()
            return False
        
        # Insert projects into database
        migrated = 0
        for project in json_projects:
            try:
                cur.execute('''
                    INSERT INTO projects (boma_id, name, status, units, image, lat, lon, description, unit_types, price_start)
                    VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
                ''', (
                    project.get('boma_id', 'N/A'),
                    project.get('name', ''),
                    project.get('status', 'planned'),
                    project.get('units', 0),
                    project.get('image', ''),
                    project.get('lat', 0.0),
                    project.get('lon', 0.0),
                    project.get('description', ''),
                    project.get('unit_types', ''),
                    project.get('price_start')
                ))
                migrated += 1
            except Exception as e:
                logger.error(f'Error migrating project {project.get("name", "unknown")}: {e}')
                continue
        
        conn.commit()
        cur.close()
        logger.info(f'Successfully migrated {migrated} projects from JSON to database')
        return True
    except Exception as e:
        logger.error(f'Error migrating projects: {e}')
        if conn:
            conn.rollback()
        return False
    finally:
        if conn:
            return_db_connection(conn)

# Input validation functions
def validate_email(email):
    """Validate email format"""
    pattern = r'^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$'
    return re.match(pattern, email) is not None

def validate_lat_lon(lat, lon):
    """Validate latitude and longitude ranges"""
    try:
        lat = float(lat)
        lon = float(lon)
        # Kenya's approximate bounding box
        if -5.0 <= lat <= 5.0 and 33.0 <= lon <= 42.0:
            return True, lat, lon
        return False, None, None
    except (ValueError, TypeError):
        return False, None, None

def sanitize_filename(filename):
    """Sanitize filename to prevent path traversal"""
    # Allow only alphanumeric, dots, hyphens, underscores
    filename = secure_filename(filename)
    if not filename:
        return None
    return filename

def sanitize_html(html_string):
    """Basic HTML sanitization - remove script tags"""
    import html
    # Escape HTML entities
    html_string = html.escape(html_string)
    # Remove any remaining script-like patterns
    html_string = re.sub(r'<script[^>]*>.*?</script>', '', html_string, flags=re.IGNORECASE | re.DOTALL)
    return html_string

def allowed_file(filename):
    """Check if file extension is allowed"""
    return '.' in filename and filename.rsplit('.', 1)[1].lower() in ALLOWED_EXTENSIONS

def handle_image_upload(file, project_id=None):
    """Handle image file upload and save to database, return the URL path"""
    if not file or file.filename == '':
        return None
    
    # Check file extension
    if not allowed_file(file.filename):
        raise ValueError('Invalid file type. Only image files (PNG, JPG, JPEG, GIF, WEBP) are allowed.')
    
    # Read file data
    file.seek(0, os.SEEK_END)
    file_size = file.tell()
    file.seek(0)  # Reset file pointer
    
    if file_size > MAX_FILE_SIZE:
        raise ValueError(f'File size exceeds maximum allowed size of {MAX_FILE_SIZE // (1024*1024)}MB.')
    
    # Read file content
    file_data = file.read()
    file.seek(0)  # Reset for potential future use
    
    # Determine content type
    file_ext = file.filename.rsplit('.', 1)[1].lower()
    content_type_map = {
        'jpg': 'image/jpeg',
        'jpeg': 'image/jpeg',
        'png': 'image/png',
        'gif': 'image/gif',
        'webp': 'image/webp'
    }
    content_type = content_type_map.get(file_ext, 'image/jpeg')
    
    # Generate unique filename
    timestamp = datetime.now().strftime('%Y%m%d_%H%M%S_%f')
    base_name = secure_filename(file.filename.rsplit('.', 1)[0])
    if not base_name:
        base_name = 'image'
    
    if project_id:
        filename = f'project_{project_id}_{timestamp}_{base_name}.{file_ext}'
    else:
        filename = f'project_{timestamp}_{base_name}.{file_ext}'
    
    # Ensure database is initialized
    init_image_db()
    
    # Save to database
    conn = None
    try:
        conn = get_image_db_connection()
        cur = conn.cursor()
        
        # Check if filename already exists (shouldn't happen with timestamp, but be safe)
        cur.execute('SELECT id FROM uploaded_images WHERE filename = %s', (filename,))
        if cur.fetchone():
            # Add random suffix if collision occurs
            filename = f'project_{timestamp}_{secrets.token_hex(4)}_{base_name}.{file_ext}'
        
        # Insert image into database
        cur.execute('''
            INSERT INTO uploaded_images (filename, file_data, content_type, file_size, project_id)
            VALUES (%s, %s, %s, %s, %s)
            RETURNING id
        ''', (filename, psycopg2.Binary(file_data), content_type, file_size, project_id))
        
        image_id = cur.fetchone()[0]
        conn.commit()
        cur.close()
        
        logger.info(f'Image saved to database: {filename} (id: {image_id}, size: {file_size} bytes)')
        
        # Return URL path that will serve the image from database
        return url_for('serve_image', filename=filename)
        
    except psycopg2.Error as e:
        logger.error(f'Database error saving image: {e}')
        if conn:
            conn.rollback()
        raise ValueError(f'Error saving image to database: {str(e)}')
    except Exception as e:
        logger.error(f'Error saving uploaded file: {e}')
        if conn:
            conn.rollback()
        raise ValueError(f'Error saving file: {str(e)}')
    finally:
        if conn:
            return_image_db_connection(conn)

# Cache for projects data (in-memory cache) with thread safety
_projects_cache = None
_projects_cache_time = None
_cache_lock = threading.Lock()
CACHE_DURATION = 60  # Cache for 60 seconds

# Base path for projects.json
PROJECT_ROOT = Path(__file__).parent
PROJECTS_JSON_PATH = PROJECT_ROOT / 'projects.json'

# Load data with caching and thread safety
def load_projects():
    """Load projects from JSON file with thread-safe caching"""
    global _projects_cache, _projects_cache_time
    now = datetime.now()
    
    with _cache_lock:
        # Return cached data if still valid
        if _projects_cache and _projects_cache_time:
            if (now - _projects_cache_time).total_seconds() < CACHE_DURATION:
                logger.debug('Returning cached projects')
                return _projects_cache
    
    # Load from file
    try:
        if not PROJECTS_JSON_PATH.exists():
            logger.warning(f'Projects file not found: {PROJECTS_JSON_PATH}')
            return []
        
        with open(PROJECTS_JSON_PATH, 'r', encoding='utf-8') as f:
            data = json.load(f)
        
        with _cache_lock:
            _projects_cache = data
            _projects_cache_time = now
        
        logger.debug('Projects loaded from file')
        return data
    except Exception as e:
        logger.error(f'Error loading projects: {e}')
        return []

def save_projects(projects):
    """Save projects to JSON file with backup and thread safety"""
    global _projects_cache, _projects_cache_time
    
    try:
        # Create backup before saving
        backup_path = PROJECTS_JSON_PATH.with_suffix('.json.backup')
        if PROJECTS_JSON_PATH.exists():
            try:
                shutil.copy2(PROJECTS_JSON_PATH, backup_path)
                logger.info(f'Backup created: {backup_path}')
            except Exception as e:
                logger.warning(f'Failed to create backup: {e}')
        
        # Write to temporary file first, then rename (atomic operation)
        temp_path = PROJECTS_JSON_PATH.with_suffix('.json.tmp')
        with open(temp_path, 'w', encoding='utf-8') as f:
            json.dump(projects, f, indent=4, ensure_ascii=False)
        
        # Atomic rename
        temp_path.replace(PROJECTS_JSON_PATH)
        
        # Update cache
        with _cache_lock:
            _projects_cache = projects
            _projects_cache_time = datetime.now()
        
        logger.info('Projects saved successfully')
    except Exception as e:
        logger.error(f'Error saving projects: {e}')
        raise

@app.route('/')
def index():
    """Landing page"""
    return render_template('index.html')

@app.route('/dashboard')
def dashboard():
    return render_template('dashboard.html')

@app.route('/about')
def about():
    return render_template('about.html')

@app.route('/stats')
def stats():
    return render_template('stats.html')

@app.route('/contact', methods=['GET', 'POST'])
def contact():
    if request.method == 'POST':
        name = request.form.get('name', '').strip()
        email = request.form.get('email', '').strip().lower()
        message = request.form.get('message', '').strip()
        
        # Validate inputs
        if not name or len(name) < 2:
            flash('Please enter a valid name (at least 2 characters).', 'danger')
            return redirect(url_for('contact'))
        
        if not email or not validate_email(email):
            flash('Please enter a valid email address.', 'danger')
            return redirect(url_for('contact'))
        
        if not message or len(message) < 10:
            flash('Message must be at least 10 characters long.', 'danger')
            return redirect(url_for('contact'))
        
        # Sanitize message
        message = sanitize_html(message)
        
        try:
            # Send confirmation email
            msg = Message(
                'Thank you for contacting Kitui Housing',
                recipients=[email],
                html=f'''
                <h2>Thank you for contacting us!</h2>
                <p>Hello {name},</p>
                <p>We received your message and will get back to you soon.</p>
                <p>Message received at: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}</p>
                <p>Best regards,<br>Kitui Housing Team</p>
                '''
            )
            mail.send(msg)
            logger.info(f'Contact form submitted from {email}')
            flash('Thank you! Your message has been received. We will get back to you soon.', 'success')
        except Exception as e:
            logger.error(f'Error sending contact email: {e}')
            flash('Thank you for contacting us! We will get back to you soon.', 'success')
        
        return redirect(url_for('contact'))
    
    return render_template('contact.html')

@app.route('/signup', methods=['GET', 'POST'])
def signup():
    if request.method == 'POST':
        username = request.form.get('username', '').strip()
        email = request.form.get('email', '').strip().lower()
        password = request.form.get('password')
        confirm_password = request.form.get('confirm_password')
        
        # Validation
        if not username or len(username) < 3:
            flash('Username must be at least 3 characters long!', 'danger')
            return redirect(url_for('signup'))
        
        if not email or not validate_email(email):
            flash('Please enter a valid email address!', 'danger')
            return redirect(url_for('signup'))
        
        if not password or len(password) < 6:
            flash('Password must be at least 6 characters long!', 'danger')
            return redirect(url_for('signup'))
        
        if password != confirm_password:
            flash('Passwords do not match!', 'danger')
            return redirect(url_for('signup'))
        
        # Check if username or email already exists
        if get_user_by_username(username):
            flash('Username already exists!', 'danger')
            return redirect(url_for('signup'))
        
        if get_user_by_email(email):
            flash('Email already registered!', 'danger')
            return redirect(url_for('signup'))
        
        # Create user (auto-activated, but not admin)
        try:
            password_hash = generate_password_hash(password)
            user_id = create_user(username, email, password_hash, is_active=True, is_admin=False)
            flash('Account created successfully! You can now log in with your username or email.', 'success')
            logger.info(f'New user registered and auto-activated: {username} ({email})')
            return redirect(url_for('login'))
        except ValueError as e:
            flash(str(e), 'danger')
            return redirect(url_for('signup'))
        except Exception as e:
            flash('An error occurred. Please try again.', 'danger')
            return redirect(url_for('signup'))
    
    return render_template('signup.html')

@app.route('/login', methods=['GET', 'POST'])
def login():
    if request.method == 'POST':
        username_or_email = request.form.get('username', '').strip()
        password = request.form.get('password', '')
        
        if not username_or_email or not password:
            flash('Username/Email and password are required!', 'danger')
            return redirect(url_for('login'))
        
        # Check for brute-force attempts (simplified)
        conn = None
        try:
            conn = get_db_connection()
            cur = conn.cursor()
            # Count failed login attempts in last 15 minutes
            cur.execute('''
                SELECT COUNT(*) FROM login_attempts 
                WHERE username = %s AND success = FALSE 
                AND attempted_at > CURRENT_TIMESTAMP - INTERVAL '15 minutes'
            ''', (username_or_email,))
            failed_attempts = cur.fetchone()[0]
            
            if failed_attempts >= 5:
                logger.warning(f'Brute-force attempt detected for user: {username_or_email}')
                flash('Too many failed login attempts. Please try again later.', 'danger')
                cur.close()
                return redirect(url_for('login'))
            
            cur.close()
        except Exception as e:
            logger.error(f'Error checking login attempts: {e}')
        finally:
            if conn:
                return_db_connection(conn)
        
        # Try to get user by username first, then by email
        user_data = get_user_by_username(username_or_email)
        if not user_data:
            user_data = get_user_by_email(username_or_email)
        
        if user_data and check_password_hash(user_data['password_hash'], password):
            if not user_data['is_active']:
                logger.warning(f'Login attempt for inactive user: {username_or_email}')
                flash('Your account has been deactivated. Please contact the administrator.', 'danger')
                return redirect(url_for('login'))
            
            # Log successful login
            conn = None
            try:
                conn = get_db_connection()
                cur = conn.cursor()
                cur.execute('''
                    INSERT INTO login_attempts (username, success) VALUES (%s, TRUE)
                ''', (user_data['username'],))
                conn.commit()
                cur.close()
            except Exception as e:
                logger.error(f'Error logging successful login: {e}')
            finally:
                if conn:
                    return_db_connection(conn)
            
            user = User(
                id=user_data['id'],
                username=user_data['username'],
                email=user_data['email'],
                is_admin=user_data['is_admin']
            )
            login_user(user, remember=True)
            session.permanent = True
            logger.info(f'User logged in: {user_data["username"]} (via {"email" if "@" in username_or_email else "username"})')
            
            # Check if user must change password
            if user_data.get('force_password_change'):
                flash('Please change your password on your first login.', 'warning')
                return redirect(url_for('change_password'))
            
            flash('Successfully logged in!', 'success')
            next_page = request.args.get('next')
            if next_page:
                return redirect(next_page)
            # Redirect admins to admin panel, regular users to dashboard
            elif user_data['is_admin']:
                return redirect(url_for('admin'))
            else:
                return redirect(url_for('dashboard'))
        else:
            # Log failed login attempt
            conn = None
            try:
                conn = get_db_connection()
                cur = conn.cursor()
                # Use username_or_email for logging (extract username if it was an email)
                log_username = username_or_email if '@' not in username_or_email else username_or_email.split('@')[0]
                cur.execute('''
                    INSERT INTO login_attempts (username, success) VALUES (%s, FALSE)
                ''', (log_username,))
                conn.commit()
                cur.close()
            except Exception as e:
                logger.error(f'Error logging failed login: {e}')
            finally:
                if conn:
                    return_db_connection(conn)
            
            logger.warning(f'Failed login attempt: {username_or_email}')
            flash('Invalid username/email or password!', 'danger')
    
    return render_template('login.html')

@app.route('/forgot-password', methods=['GET', 'POST'])
def forgot_password():
    if request.method == 'POST':
        email = request.form.get('email', '').strip().lower()
        
        if not email or not validate_email(email):
            flash('Please enter a valid email address!', 'danger')
            return redirect(url_for('forgot_password'))
        
        user = get_user_by_email(email)
        if user:
            try:
                token = create_password_reset_token(user['id'])
                reset_url = url_for('reset_password', token=token, _external=True)
                
                # Send email asynchronously (or with timeout to prevent blocking)
                try:
                    msg = Message(
                        'Password Reset Request - Kitui Housing',
                        recipients=[user['email']],
                        html=f'''
                        <h2>Password Reset Request</h2>
                        <p>Hello {user['username']},</p>
                        <p>You requested to reset your password. Click the link below to reset it:</p>
                        <p><a href="{reset_url}" style="background-color: #0d6efd; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px; display: inline-block;">Reset Password</a></p>
                        <p>This link will expire in 1 hour.</p>
                        <p>If you didn't request this, please ignore this email.</p>
                        <p>Best regards,<br>Kitui Housing Team</p>
                        '''
                    )
                    mail.send(msg)
                    logger.info(f'Password reset email sent to: {email}')
                except Exception as email_error:
                    logger.error(f'Error sending password reset email: {email_error}')
                    # Still show success message to prevent email enumeration
            except Exception as e:
                logger.error(f'Error creating reset token: {e}')
        else:
            logger.debug(f'Password reset request for non-existent email: {email}')
        
        # Always show the same message for security (prevent email enumeration)
        flash('If that email exists in our system, a password reset link has been sent.', 'info')
        return redirect(url_for('login'))
    
    return render_template('forgot_password.html')

@app.route('/reset-password/<token>', methods=['GET', 'POST'])
def reset_password(token):
    user_data = get_user_by_reset_token(token)
    
    if not user_data:
        logger.warning(f'Invalid password reset attempt with token: {token[:10]}...')
        flash('Invalid or expired reset token!', 'danger')
        return redirect(url_for('forgot_password'))
    
    if request.method == 'POST':
        password = request.form.get('password', '')
        confirm_password = request.form.get('confirm_password', '')
        
        if not password or len(password) < 8:
            flash('Password must be at least 8 characters long!', 'danger')
            return render_template('reset_password.html', token=token)
        
        if password != confirm_password:
            flash('Passwords do not match!', 'danger')
            return render_template('reset_password.html', token=token)
        
        # Validate password strength (at least one uppercase, one lowercase, one digit)
        if not (re.search(r'[A-Z]', password) and re.search(r'[a-z]', password) and re.search(r'\d', password)):
            flash('Password must contain uppercase, lowercase, and numbers!', 'danger')
            return render_template('reset_password.html', token=token)
        
        try:
            password_hash = generate_password_hash(password)
            update_user_password(user_data['id'], password_hash)
            mark_token_as_used(token)
            logger.info(f'Password reset successful for user_id: {user_data["id"]}')
            flash('Password reset successfully! Please log in with your new password.', 'success')
            return redirect(url_for('login'))
        except Exception as e:
            logger.error(f'Error resetting password: {e}')
            flash('Error resetting password. Please try again.', 'danger')
            return render_template('reset_password.html', token=token)
    
    return render_template('reset_password.html', token=token)

@app.route('/change-password', methods=['GET', 'POST'])
@login_required
def change_password():
    if request.method == 'POST':
        current_password = request.form.get('current_password', '')
        new_password = request.form.get('new_password', '')
        confirm_password = request.form.get('confirm_password', '')
        
        # Get current user data
        user_data = get_user_by_username(current_user.username)
        
        if not user_data or not check_password_hash(user_data['password_hash'], current_password):
            flash('Current password is incorrect!', 'danger')
            return redirect(url_for('change_password'))
        
        if not new_password or len(new_password) < 8:
            flash('New password must be at least 8 characters long!', 'danger')
            return redirect(url_for('change_password'))
        
        if new_password != confirm_password:
            flash('Passwords do not match!', 'danger')
            return redirect(url_for('change_password'))
        
        # Validate password strength
        if not (re.search(r'[A-Z]', new_password) and re.search(r'[a-z]', new_password) and re.search(r'\d', new_password)):
            flash('Password must contain uppercase, lowercase, and numbers!', 'danger')
            return redirect(url_for('change_password'))
        
        try:
            password_hash = generate_password_hash(new_password)
            update_user_password(current_user.id, password_hash)
            logger.info(f'Password changed for user: {current_user.username}')
            flash('Password changed successfully!', 'success')
            return redirect(url_for('admin'))
        except Exception as e:
            logger.error(f'Error changing password: {e}')
            flash('Error changing password. Please try again.', 'danger')
            return redirect(url_for('change_password'))
    
    return render_template('change_password.html')

@app.route('/logout')
@login_required
def logout():
    """Logout user"""
    username = current_user.username
    logout_user()
    session.clear()
    logger.info(f'User logged out: {username}')
    flash('You have been logged out successfully.', 'info')
    return redirect(url_for('login'))

@app.route('/admin', methods=['GET', 'POST'])
@login_required
def admin():
    if not current_user.is_admin:
        logger.warning(f'Unauthorized admin access attempt by: {current_user.username}')
        flash('You do not have permission to access the admin panel.', 'danger')
        return redirect(url_for('dashboard'))
    
    # Ensure database is initialized before any operations
    if DATABASE_URL:
        try:
            init_db()
        except Exception as e:
            logger.error(f'Database initialization failed in admin route: {e}')
            flash(f'Database error: {str(e)}. Please contact support.', 'danger')
            # Still allow viewing, but operations will fail gracefully
    
    if request.method == 'POST':
        action = request.form.get('action', '').strip()
        
        try:
            if action == 'add':
                
                # Validate and sanitize inputs
                name = request.form.get('name', '').strip()
                if not name or len(name) < 2:
                    flash('Project name must be at least 2 characters long!', 'danger')
                    return redirect(url_for('admin'))
                
                boma_id = request.form.get('boma_id', 'N/A').strip()
                status = request.form.get('status', 'planned').strip()
                if status not in ['planned', 'ongoing', 'completed', 'nearing completion', 'complete']:
                    status = 'planned'
                # Normalize 'complete' to 'completed' for consistency
                if status == 'complete':
                    status = 'completed'
                
                try:
                    units = int(request.form.get('units', 0))
                    if units < 0:
                        units = 0
                except ValueError:
                    units = 0
                
                # Validate lat/lon
                lat_str = request.form.get('lat', '0').strip()
                lon_str = request.form.get('lon', '0').strip()
                valid, lat, lon = validate_lat_lon(lat_str, lon_str)
                if not valid:
                    flash('Please provide valid latitude and longitude within Kenya.', 'danger')
                    return redirect(url_for('admin'))
                
                # Handle image: prioritize file upload over URL
                image = ''
                if 'image_file' in request.files:
                    file = request.files['image_file']
                    if file and file.filename != '':
                        try:
                            image = handle_image_upload(file)
                        except ValueError as e:
                            flash(str(e), 'danger')
                            return redirect(url_for('admin'))
                
                # If no file uploaded, use URL if provided
                if not image:
                    image = request.form.get('image', '').strip()
                    if image:
                        if not (image.startswith('http://') or image.startswith('https://')):
                            flash('Image must be a valid URL (http:// or https://).', 'danger')
                            return redirect(url_for('admin'))
                        if len(image) > 500:
                            flash('Image URL is too long.', 'danger')
                            return redirect(url_for('admin'))
                
                # Sanitize description
                description = request.form.get('description', '').strip()
                description = sanitize_html(description)
                if len(description) > 2000:
                    flash('Description is too long (max 2000 characters).', 'danger')
                    return redirect(url_for('admin'))
                
                unit_types = request.form.get('unit_types', '').strip()
                unit_types = sanitize_html(unit_types)
                
                try:
                    price_start = int(request.form.get('price_start', 0)) if request.form.get('price_start') else None
                    if price_start and price_start < 0:
                        price_start = None
                except ValueError:
                    price_start = None
                
                # Add project to database
                try:
                    project_id = add_project_to_db(boma_id, name, status, units, image, lat, lon, description, unit_types, price_start)
                    
                    # If we uploaded a file but didn't have project_id, we could rename it here
                    # But it's not necessary - the filename will work fine without project_id
                    
                    log_audit_event(current_user.id, 'CREATE', 'project', name, f'New project added (id: {project_id})')
                    logger.info(f'Project created: {name} (id: {project_id}) by user: {current_user.username}')
                    flash(f'Project "{name}" added successfully!', 'success')
                except psycopg2.Error as e:
                    logger.error(f'Database error adding project: {e}')
                    error_msg = str(e)
                    if 'does not exist' in error_msg:
                        # Try to initialize database again
                        try:
                            init_db(force=True)
                            flash('Database was not initialized. Please try again.', 'warning')
                        except Exception as init_error:
                            flash(f'Database error: The projects table does not exist. Please contact support. Error: {init_error}', 'danger')
                    else:
                        flash(f'Database error: {error_msg}', 'danger')
                except Exception as e:
                    logger.error(f'Error adding project: {e}')
                    flash(f'Error adding project: {str(e)}', 'danger')

                
                external_link = request.form.get('external_link', '').strip()
                if external_link:
                    # Validate URL format
                    if not (external_link.startswith('http://') or external_link.startswith('https://')):
                        flash('External link must be a valid URL (http:// or https://).', 'danger')
                        return redirect(url_for('admin'))
                    if len(external_link) > 500:
                        flash('External link is too long.', 'danger')
                        return redirect(url_for('admin'))

                # Add project to database with external_link
                try:
                    project_id = add_project_to_db(
                        boma_id, name, status, units, image, lat, lon, 
                        description, unit_types, price_start, external_link
                    )

                    log_audit_event(current_user.id, 'CREATE', 'project', name, f'New project added (id: {project_id})')
                    logger.info(f'Project created: {name} (id: {project_id}) by user: {current_user.username}')
                    flash(f'Project "{name}" added successfully!', 'success')
                except Exception as e:
                    logger.error(f'Error adding project: {e}')
                    flash(f'Error adding project: {str(e)}', 'danger')



            elif action == 'edit':
                try:
                    project_id = int(request.form.get('project_id'))
                except ValueError:
                    flash('Invalid project ID!', 'danger')
                    return redirect(url_for('admin'))
                
                # Get old project name for audit log
                conn = None
                old_name = None
                try:
                    conn = get_db_connection()
                    cur = conn.cursor()
                    cur.execute('SELECT name FROM projects WHERE id = %s', (project_id,))
                    result = cur.fetchone()
                    if not result:
                        flash('Project not found!', 'danger')
                        cur.close()
                        return redirect(url_for('admin'))
                    old_name = result[0]
                    cur.close()
                except Exception as e:
                    logger.error(f'Error fetching project: {e}')
                    flash('Error fetching project. Please try again.', 'danger')
                    return redirect(url_for('admin'))
                finally:
                    if conn:
                        return_db_connection(conn)
                
                # Validate and sanitize inputs (same as add)
                name = request.form.get('name', '').strip()
                if not name or len(name) < 2:
                    flash('Project name must be at least 2 characters long!', 'danger')
                    return redirect(url_for('admin'))
                
                boma_id = request.form.get('boma_id', 'N/A').strip()
                status = request.form.get('status', 'planned').strip()
                if status not in ['planned', 'ongoing', 'completed', 'nearing completion', 'complete']:
                    status = 'planned'
                # Normalize 'complete' to 'completed' for consistency
                if status == 'complete':
                    status = 'completed'
                
                try:
                    units = int(request.form.get('units', 0))
                    if units < 0:
                        units = 0
                except ValueError:
                    units = 0
                
                valid, lat, lon = validate_lat_lon(request.form.get('lat', '0'), request.form.get('lon', '0'))
                if not valid:
                    flash('Please provide valid latitude and longitude within Kenya.', 'danger')
                    return redirect(url_for('admin'))
                
                # Handle image: prioritize file upload over URL
                # Get current image to preserve if no new image provided
                conn = None
                current_image = None
                try:
                    conn = get_db_connection()
                    cur = conn.cursor()
                    cur.execute('SELECT image FROM projects WHERE id = %s', (project_id,))
                    result = cur.fetchone()
                    if result:
                        current_image = result[0]
                    cur.close()
                except Exception as e:
                    logger.error(f'Error fetching current image: {e}')
                finally:
                    if conn:
                        return_db_connection(conn)
                
                image = current_image  # Default to current image
                
                # Check for file upload first (highest priority)
                if 'image_file' in request.files:
                    file = request.files['image_file']
                    if file and file.filename != '':
                        try:
                            image = handle_image_upload(file, project_id)
                        except ValueError as e:
                            flash(str(e), 'danger')
                            return redirect(url_for('admin'))
                
                # If no file uploaded, check for URL input
                elif not image or image == current_image:
                    url_image = request.form.get('image', '').strip()
                    if url_image:
                        if not (url_image.startswith('http://') or url_image.startswith('https://')):
                            flash('Image must be a valid URL (http:// or https://).', 'danger')
                            return redirect(url_for('admin'))
                        if len(url_image) > 500:
                            flash('Image URL is too long.', 'danger')
                            return redirect(url_for('admin'))
                        image = url_image
                
                description = request.form.get('description', '').strip()
                description = sanitize_html(description)
                if len(description) > 2000:
                    flash('Description is too long (max 2000 characters).', 'danger')
                    return redirect(url_for('admin'))
                
                unit_types = request.form.get('unit_types', '').strip()
                unit_types = sanitize_html(unit_types)
                
                try:
                    price_start = int(request.form.get('price_start', 0)) if request.form.get('price_start') else None
                    if price_start and price_start < 0:
                        price_start = None
                except ValueError:
                    price_start = None
                
                # Update project in database
                try:
                    update_project_in_db(project_id, boma_id, name, status, units, image, lat, lon, description, unit_types, price_start)
                    log_audit_event(current_user.id, 'UPDATE', 'project', name, f'Updated from "{old_name}"')
                    logger.info(f'Project updated: {name} (was: {old_name}, id: {project_id}) by user: {current_user.username}')
                    flash(f'Project "{name}" updated successfully!', 'success')
                except psycopg2.Error as e:
                    logger.error(f'Database error updating project: {e}')
                    error_msg = str(e)
                    if 'does not exist' in error_msg:
                        # Try to initialize database again
                        try:
                            init_db(force=True)
                            flash('Database was not initialized. Please try again.', 'warning')
                        except Exception as init_error:
                            flash(f'Database error: The projects table does not exist. Please contact support. Error: {init_error}', 'danger')
                    else:
                        flash(f'Database error: {error_msg}', 'danger')
                except Exception as e:
                    logger.error(f'Error updating project: {e}')
                    flash(f'Error updating project: {str(e)}', 'danger')

                    external_link = request.form.get('external_link', '').strip()
                    if external_link:
                        # Validate URL format
                        if not (external_link.startswith('http://') or external_link.startswith('https://')):
                            flash('External link must be a valid URL (http:// or https://).', 'danger')
                            return redirect(url_for('admin'))
                        if len(external_link) > 500:
                            flash('External link is too long.', 'danger')
                            return redirect(url_for('admin'))
                    
                    # Update project in database with external_link
                    try:
                        update_project_in_db(
                            project_id, boma_id, name, status, units, image, lat, lon, 
                            description, unit_types, price_start, external_link
                        )
                        log_audit_event(current_user.id, 'UPDATE', 'project', name, f'Updated from "{old_name}"')
                        logger.info(f'Project updated: {name} (was: {old_name}, id: {project_id}) by user: {current_user.username}')
                        flash(f'Project "{name}" updated successfully!', 'success')
                    except Exception as e:
                        logger.error(f'Error updating project: {e}')
                        flash(f'Error updating project: {str(e)}', 'danger')
            
            elif action == 'delete':
                try:
                    project_id = int(request.form.get('project_id'))
                except ValueError:
                    flash('Invalid project ID!', 'danger')
                    return redirect(url_for('admin'))
                
                # Delete project from database
                try:
                    project_name = delete_project_from_db(project_id)
                    log_audit_event(current_user.id, 'DELETE', 'project', project_name, f'Project deleted (id: {project_id})')
                    logger.info(f'Project deleted: {project_name} (id: {project_id}) by user: {current_user.username}')
                    flash(f'Project "{project_name}" deleted successfully!', 'success')
                except ValueError as e:
                    flash(str(e), 'danger')
                except psycopg2.Error as e:
                    logger.error(f'Database error deleting project: {e}')
                    error_msg = str(e)
                    if 'does not exist' in error_msg:
                        # Try to initialize database again
                        try:
                            init_db(force=True)
                            flash('Database was not initialized. Please try again.', 'warning')
                        except Exception as init_error:
                            flash(f'Database error: The projects table does not exist. Please contact support. Error: {init_error}', 'danger')
                    else:
                        flash(f'Database error: {error_msg}', 'danger')
                except Exception as e:
                    logger.error(f'Error deleting project: {e}')
                    flash(f'Error deleting project: {str(e)}', 'danger')
            
            elif action == 'migrate':
                # Migrate projects from JSON to database
                try:
                    result = migrate_projects_from_json(force=True)
                    if result:
                        log_audit_event(current_user.id, 'MIGRATE', 'project', 'all', 'Migrated projects from JSON to database')
                        logger.info(f'Projects migrated by user: {current_user.username}')
                        flash('Projects migrated successfully from JSON file!', 'success')
                    else:
                        flash('Migration failed. Please check the logs.', 'danger')
                except Exception as e:
                    logger.error(f'Error migrating projects: {e}')
                    flash(f'Error during migration: {str(e)}', 'danger')
            
            elif action == 'activate_user':
                # Activate a user account
                try:
                    user_id = int(request.form.get('user_id'))
                    username = update_user_status(user_id, True)
                    log_audit_event(current_user.id, 'ACTIVATE', 'user', username, f'User activated (id: {user_id})')
                    flash(f'User "{username}" has been activated successfully!', 'success')
                except ValueError as e:
                    flash(str(e), 'danger')
                except Exception as e:
                    logger.error(f'Error activating user: {e}')
                    flash(f'Error activating user: {str(e)}', 'danger')
            
            elif action == 'deactivate_user':
                # Deactivate a user account
                try:
                    user_id = int(request.form.get('user_id'))
                    if user_id == current_user.id:
                        flash('You cannot deactivate your own account!', 'danger')
                        return redirect(url_for('admin'))
                    
                    username = update_user_status(user_id, False)
                    log_audit_event(current_user.id, 'DEACTIVATE', 'user', username, f'User deactivated (id: {user_id})')
                    flash(f'User "{username}" has been deactivated successfully!', 'success')
                except ValueError as e:
                    flash(str(e), 'danger')
                except Exception as e:
                    logger.error(f'Error deactivating user: {e}')
                    flash(f'Error deactivating user: {str(e)}', 'danger')
            
            elif action == 'grant_admin':
                # Grant admin privileges to a user
                try:
                    user_id = int(request.form.get('user_id'))
                    username = update_user_admin_status(user_id, True)
                    log_audit_event(current_user.id, 'GRANT_ADMIN', 'user', username, f'Admin privileges granted (id: {user_id})')
                    flash(f'Admin privileges granted to "{username}" successfully!', 'success')
                except ValueError as e:
                    flash(str(e), 'danger')
                except Exception as e:
                    logger.error(f'Error granting admin privileges: {e}')
                    flash(f'Error granting admin privileges: {str(e)}', 'danger')
            
            elif action == 'revoke_admin':
                # Revoke admin privileges from a user
                try:
                    user_id = int(request.form.get('user_id'))
                    if user_id == current_user.id:
                        flash('You cannot revoke your own admin privileges!', 'danger')
                        return redirect(url_for('admin'))
                    
                    username = update_user_admin_status(user_id, False)
                    log_audit_event(current_user.id, 'REVOKE_ADMIN', 'user', username, f'Admin privileges revoked (id: {user_id})')
                    flash(f'Admin privileges revoked from "{username}" successfully!', 'success')
                except ValueError as e:
                    flash(str(e), 'danger')
                except Exception as e:
                    logger.error(f'Error revoking admin privileges: {e}')
                    flash(f'Error revoking admin privileges: {str(e)}', 'danger')
            
            else:
                logger.warning(f'Unknown admin action attempted: {action} by user: {current_user.username}')
                flash('Invalid action!', 'danger')
        
        except Exception as e:
            logger.error(f'Error in admin action {action}: {e}', exc_info=True)
            flash(f'An error occurred. Please try again.', 'danger')
        
        return redirect(url_for('admin'))
    
    projects = load_projects_from_db()
    users = get_all_users()
    return render_template('admin.html', projects=projects, users=users)

@app.route('/api/projects')
def get_projects():
    """API endpoint to get all projects"""
    try:
        projects = load_projects_from_db()
        # Remove 'id' field from response for backward compatibility
        projects_response = []
        for project in projects:
            project_copy = project.copy()
            project_copy.pop('id', None)  # Remove id if present
            projects_response.append(project_copy)
        return jsonify(projects_response)
    except Exception as e:
        logger.error(f'Error in get_projects API: {e}')
        return jsonify({'error': 'Failed to load projects'}), 500

@app.route('/favicon.ico')
def favicon():
    """Serve favicon"""
    return redirect(url_for('static', filename='favicon/favicon.ico'))

@app.route('/manifest.json')
def manifest():
    """Serve web manifest with proper content type"""
    try:
        manifest_path = Path(__file__).parent / 'static' / 'favicon' / 'site.webmanifest'
        with open(manifest_path, 'r', encoding='utf-8') as f:
            manifest_data = json.load(f)
        response = jsonify(manifest_data)
        response.headers['Content-Type'] = 'application/manifest+json'
        return response
    except Exception as e:
        logger.error(f'Error serving manifest: {e}')
        return jsonify({'error': 'Manifest not found'}), 404

@app.route('/service-worker.js')
def service_worker():
    """Serve service worker with proper content type"""
    try:
        sw_path = Path(__file__).parent / 'static' / 'js' / 'service-worker.js'
        with open(sw_path, 'r', encoding='utf-8') as f:
            content = f.read()
        response = Response(content, mimetype='application/javascript')
        response.headers['Service-Worker-Allowed'] = '/'
        return response
    except Exception as e:
        logger.error(f'Error serving service worker: {e}')
        return 'Service worker not found', 404

@app.route('/uploads/<filename>')
def serve_image(filename):
    """Serve images from the image database"""
    if not filename:
        return 'Image not found', 404
    
    # Sanitize filename to prevent path traversal
    filename = secure_filename(filename)
    if not filename:
        return 'Invalid filename', 400
    
    conn = None
    try:
        conn = get_image_db_connection()
        cur = conn.cursor()
        
        # Retrieve image from database
        cur.execute('''
            SELECT file_data, content_type, file_size
            FROM uploaded_images
            WHERE filename = %s
        ''', (filename,))
        
        result = cur.fetchone()
        cur.close()
        
        if not result:
            return 'Image not found', 404
        
        file_data, content_type, file_size = result
        
        # Return image with appropriate headers
        return Response(
            file_data,
            mimetype=content_type,
            headers={
                'Content-Length': str(file_size),
                'Cache-Control': 'public, max-age=31536000'  # Cache for 1 year
            }
        )
        
    except Exception as e:
        logger.error(f'Error serving image {filename}: {e}')
        return 'Error serving image', 500
    finally:
        if conn:
            return_image_db_connection(conn)

@app.errorhandler(404)
def not_found(error):
    logger.warning(f'404 error: {request.path}')
    return render_template('404.html'), 404

@app.errorhandler(500)
def server_error(error):
    logger.error(f'500 error: {error}', exc_info=True)
    return render_template('500.html'), 500

@app.errorhandler(403)
def forbidden(error):
    logger.warning(f'403 error: {request.path}')
    flash('You do not have permission to access this resource.', 'danger')
    return redirect(url_for('dashboard'))

if __name__ == '__main__':
    # Validate environment on startup
    logger.info('=' * 60)
    logger.info('Flask Application Starting')
    logger.info('=' * 60)
    
    # Check for required environment variables
    required_vars = {
        'APP_SECRET_KEY': 'Secret key for Flask sessions and CSRF tokens',
        'DATABASE_URL': 'PostgreSQL database connection string',
        'MAIL_SERVER': 'SMTP mail server',
        'MAIL_USERNAME': 'Email account username',
        'MAIL_PASSWORD': 'Email account password'
    }
    
    missing_vars = []
    for var, description in required_vars.items():
        if not os.getenv(var):
            missing_vars.append(f'{var}: {description}')
    
    if missing_vars:
        logger.warning('Missing environment variables (app will still run, but features may be limited):')
        for var in missing_vars:
            logger.warning(f'  - {var}')
    
    # Initialize database connection pool
    if DATABASE_URL:
        init_db_pool()
        
        # Initialize database on startup
        try:
            init_db()
            logger.info('Database initialized successfully')
            
            # Migrate projects from JSON to database if database is empty
            try:
                if migrate_projects_from_json():
                    logger.info('Projects migration completed')
            except Exception as e:
                logger.warning(f'Projects migration failed: {e}')
        except Exception as e:
            logger.error(f'Failed to initialize database: {e}')
            if os.getenv('FLASK_ENV') == 'production':
                raise
            logger.warning('Continuing in development mode without database')
    else:
        logger.warning('DATABASE_URL not set - database features will not be available')
    
    # Initialize image database connection pool and tables
    try:
        init_image_db_pool()
        init_image_db()
        logger.info('Image database initialized successfully')
    except Exception as e:
        logger.error(f'Failed to initialize image database: {e}')
        if os.getenv('FLASK_ENV') == 'production':
            raise
        logger.warning('Continuing in development mode without image database')
    
    # Determine if debug mode should be enabled
    debug_mode = os.getenv('FLASK_ENV') != 'production'
    
    if debug_mode:
        logger.warning('DEBUG MODE ENABLED - This should NEVER be used in production!')
    
    logger.info('Application ready to accept requests')
    logger.info('=' * 60)
    
    # For production, use a WSGI server like Gunicorn, not app.run()
    # app.run() is for development only
    if os.getenv('FLASK_ENV') == 'production':
        logger.error('ERROR: app.run() should not be used in production!')
        logger.error('Use a production WSGI server like Gunicorn:')
        logger.error('  gunicorn -w 4 -b 0.0.0.0:5000 app:app')
        raise RuntimeError('Use production WSGI server')
    
    app.run(debug=debug_mode, host='127.0.0.1')

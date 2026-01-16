from flask import Flask, render_template, jsonify, request, redirect, url_for, flash, session
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

# Initialize database tables (only run once)
_db_initialized = False

def init_db():
    """Initialize database tables if they don't exist"""
    global _db_initialized
    if _db_initialized:
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
                INSERT INTO users (username, email, password_hash, is_admin, force_password_change)
                VALUES (%s, %s, %s, %s, %s)
            ''', ('admin', 'admin@kituihousing.com', admin_hash, True, True))
            logger.warning(f'DEFAULT ADMIN CREATED - TEMPORARY PASSWORD: {temp_password} - SET APP_ADMIN_PASSWORD IN .env IMMEDIATELY!')
        
        conn.commit()
        cur.close()
        _db_initialized = True
        logger.info('Database initialized successfully')
    except Exception as e:
        logger.error(f'Error initializing database: {e}')
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

def create_user(username, email, password_hash):
    """Create a new user"""
    conn = None
    try:
        conn = get_db_connection()
        cur = conn.cursor()
        cur.execute('''
            INSERT INTO users (username, email, password_hash)
            VALUES (%s, %s, %s)
            RETURNING id
        ''', (username, email, password_hash))
        user_id = cur.fetchone()[0]
        conn.commit()
        cur.close()
        logger.info(f'User created: {username}')
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

# Database functions for projects
def load_projects_from_db():
    """Load all projects from database"""
    if not DATABASE_URL:
        logger.warning('DATABASE_URL not set, falling back to JSON')
        return load_projects()
    
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

def migrate_projects_from_json():
    """Migrate projects from JSON file to database"""
    if not DATABASE_URL:
        logger.warning('DATABASE_URL not set, cannot migrate')
        return False
    
    conn = None
    try:
        # Check if projects already exist in database
        conn = get_db_connection()
        cur = conn.cursor()
        cur.execute('SELECT COUNT(*) FROM projects')
        count = cur.fetchone()[0]
        
        if count > 0:
            logger.info(f'Database already has {count} projects. Skipping migration.')
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
        
        # Create user
        try:
            password_hash = generate_password_hash(password)
            user_id = create_user(username, email, password_hash)
            flash('Account created successfully! Please log in.', 'success')
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
        username = request.form.get('username', '').strip()
        password = request.form.get('password', '')
        
        if not username or not password:
            flash('Username and password are required!', 'danger')
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
            ''', (username,))
            failed_attempts = cur.fetchone()[0]
            
            if failed_attempts >= 5:
                logger.warning(f'Brute-force attempt detected for user: {username}')
                flash('Too many failed login attempts. Please try again later.', 'danger')
                cur.close()
                return redirect(url_for('login'))
            
            cur.close()
        except Exception as e:
            logger.error(f'Error checking login attempts: {e}')
        finally:
            if conn:
                return_db_connection(conn)
        
        user_data = get_user_by_username(username)
        if user_data and check_password_hash(user_data['password_hash'], password):
            if not user_data['is_active']:
                logger.warning(f'Login attempt for inactive user: {username}')
                flash('Your account has been deactivated. Please contact support.', 'danger')
                return redirect(url_for('login'))
            
            # Log successful login
            conn = None
            try:
                conn = get_db_connection()
                cur = conn.cursor()
                cur.execute('''
                    INSERT INTO login_attempts (username, success) VALUES (%s, TRUE)
                ''', (username,))
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
            logger.info(f'User logged in: {username}')
            
            # Check if user must change password
            if user_data.get('force_password_change'):
                flash('Please change your password on your first login.', 'warning')
                return redirect(url_for('change_password'))
            
            flash('Successfully logged in!', 'success')
            next_page = request.args.get('next')
            return redirect(next_page) if next_page else redirect(url_for('admin'))
        else:
            # Log failed login attempt
            conn = None
            try:
                conn = get_db_connection()
                cur = conn.cursor()
                cur.execute('''
                    INSERT INTO login_attempts (username, success) VALUES (%s, FALSE)
                ''', (username,))
                conn.commit()
                cur.close()
            except Exception as e:
                logger.error(f'Error logging failed login: {e}')
            finally:
                if conn:
                    return_db_connection(conn)
            
            logger.warning(f'Failed login attempt: {username}')
            flash('Invalid username or password!', 'danger')
    
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
                
                # Sanitize image URL (validate it's a URL, not a file path)
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
                    log_audit_event(current_user.id, 'CREATE', 'project', name, f'New project added (id: {project_id})')
                    logger.info(f'Project created: {name} (id: {project_id}) by user: {current_user.username}')
                    flash(f'Project "{name}" added successfully!', 'success')
                except Exception as e:
                    logger.error(f'Error adding project: {e}')
                    flash('Error adding project. Please try again.', 'danger')
            
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
                
                image = request.form.get('image', '').strip()
                if image:
                    if not (image.startswith('http://') or image.startswith('https://')):
                        flash('Image must be a valid URL (http:// or https://).', 'danger')
                        return redirect(url_for('admin'))
                    if len(image) > 500:
                        flash('Image URL is too long.', 'danger')
                        return redirect(url_for('admin'))
                
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
                except Exception as e:
                    logger.error(f'Error updating project: {e}')
                    flash('Error updating project. Please try again.', 'danger')
            
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
                except Exception as e:
                    logger.error(f'Error deleting project: {e}')
                    flash('Error deleting project. Please try again.', 'danger')
            
            else:
                logger.warning(f'Unknown admin action attempted: {action} by user: {current_user.username}')
                flash('Invalid action!', 'danger')
        
        except Exception as e:
            logger.error(f'Error in admin action {action}: {e}', exc_info=True)
            flash(f'An error occurred. Please try again.', 'danger')
        
        return redirect(url_for('admin'))
    
    projects = load_projects_from_db()
    return render_template('admin.html', projects=projects)

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
    
    app.run(debug=debug_mode, host='127.0.0.1', port=5000)

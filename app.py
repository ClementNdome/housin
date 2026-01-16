from flask import Flask, render_template, jsonify, request, redirect, url_for, flash
from flask_login import LoginManager, UserMixin, login_user, logout_user, login_required, current_user
from flask_mail import Mail, Message
from werkzeug.security import check_password_hash, generate_password_hash
import json
import os
import psycopg2
from psycopg2.extras import RealDictCursor
from datetime import datetime, timedelta
import secrets
from urllib.parse import urlparse
from dotenv import load_dotenv

# Load environment variables from .env file if it exists
load_dotenv()

app = Flask(__name__)
app.secret_key = 'your-secret-key-change-in-production'  # Change this in production!

# Database connection string
DATABASE_URL = 'postgres://avnadmin:AVNS_Nw_acP_1et7TIqtP57w@pg-clement-clemo-d16a.i.aivencloud.com:11980/defaultdb?sslmode=require'

# Parse database URL
def get_db_connection():
    """Create and return a database connection"""
    try:
        conn = psycopg2.connect(DATABASE_URL)
        return conn
    except Exception as e:
        print(f"Database connection error: {e}")
        raise

# Initialize database tables
def init_db():
    """Initialize database tables if they don't exist"""
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
                is_admin BOOLEAN DEFAULT FALSE
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
        
        # Create default admin user if it doesn't exist
        cur.execute('SELECT COUNT(*) FROM users WHERE username = %s', ('admin',))
        if cur.fetchone()[0] == 0:
            admin_hash = generate_password_hash('admin123')
            cur.execute('''
                INSERT INTO users (username, email, password_hash, is_admin)
                VALUES (%s, %s, %s, %s)
            ''', ('admin', 'admin@kituihousing.com', admin_hash, True))
        
        conn.commit()
        cur.close()
        conn.close()
        print("Database initialized successfully!")
    except Exception as e:
        print(f"Error initializing database: {e}")
        raise

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
    try:
        conn = get_db_connection()
        cur = conn.cursor(cursor_factory=RealDictCursor)
        cur.execute('SELECT id, username, email, is_admin FROM users WHERE id = %s AND is_active = TRUE', (user_id,))
        user_data = cur.fetchone()
        cur.close()
        conn.close()
        
        if user_data:
            return User(
                id=user_data['id'],
                username=user_data['username'],
                email=user_data['email'],
                is_admin=user_data['is_admin']
            )
        return None
    except Exception as e:
        print(f"Error loading user: {e}")
        return None

# Database helper functions
def get_user_by_username(username):
    """Get user by username"""
    try:
        conn = get_db_connection()
        cur = conn.cursor(cursor_factory=RealDictCursor)
        cur.execute('SELECT * FROM users WHERE username = %s', (username,))
        user = cur.fetchone()
        cur.close()
        conn.close()
        return user
    except Exception as e:
        print(f"Error getting user: {e}")
        return None

def get_user_by_email(email):
    """Get user by email"""
    try:
        conn = get_db_connection()
        cur = conn.cursor(cursor_factory=RealDictCursor)
        cur.execute('SELECT * FROM users WHERE email = %s', (email,))
        user = cur.fetchone()
        cur.close()
        conn.close()
        return user
    except Exception as e:
        print(f"Error getting user by email: {e}")
        return None

def create_user(username, email, password_hash):
    """Create a new user"""
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
        conn.close()
        return user_id
    except psycopg2.IntegrityError as e:
        if 'username' in str(e):
            raise ValueError('Username already exists')
        elif 'email' in str(e):
            raise ValueError('Email already exists')
        raise
    except Exception as e:
        print(f"Error creating user: {e}")
        raise

def create_password_reset_token(user_id):
    """Create a password reset token"""
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
        conn.close()
        return token
    except Exception as e:
        print(f"Error creating reset token: {e}")
        raise

def get_user_by_reset_token(token):
    """Get user by reset token if valid"""
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
        conn.close()
        return result
    except Exception as e:
        print(f"Error getting user by token: {e}")
        return None

def mark_token_as_used(token):
    """Mark a reset token as used"""
    try:
        conn = get_db_connection()
        cur = conn.cursor()
        cur.execute('UPDATE password_reset_tokens SET used = TRUE WHERE token = %s', (token,))
        conn.commit()
        cur.close()
        conn.close()
    except Exception as e:
        print(f"Error marking token as used: {e}")

def update_user_password(user_id, password_hash):
    """Update user password"""
    try:
        conn = get_db_connection()
        cur = conn.cursor()
        cur.execute('UPDATE users SET password_hash = %s WHERE id = %s', (password_hash, user_id))
        conn.commit()
        cur.close()
        conn.close()
    except Exception as e:
        print(f"Error updating password: {e}")
        raise

# Load data
def load_projects():
    with open('projects.json', 'r', encoding='utf-8') as f:
        return json.load(f)

def save_projects(projects):
    with open('projects.json', 'w', encoding='utf-8') as f:
        json.dump(projects, f, indent=4, ensure_ascii=False)

@app.route('/')
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
        name = request.form.get('name')
        email = request.form.get('email')
        message = request.form.get('message')
        # For prototype, just flash a message
        flash(f'Thank you {name}! Your message has been received. We will get back to you at {email}.', 'success')
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
        
        if not email or '@' not in email:
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
        username = request.form.get('username')
        password = request.form.get('password')
        
        user_data = get_user_by_username(username)
        if user_data and check_password_hash(user_data['password_hash'], password):
            if not user_data['is_active']:
                flash('Your account has been deactivated. Please contact support.', 'danger')
                return redirect(url_for('login'))
            
            user = User(
                id=user_data['id'],
                username=user_data['username'],
                email=user_data['email'],
                is_admin=user_data['is_admin']
            )
            login_user(user)
            flash('Successfully logged in!', 'success')
            next_page = request.args.get('next')
            return redirect(next_page) if next_page else redirect(url_for('admin'))
        else:
            flash('Invalid username or password!', 'danger')
    
    return render_template('login.html')

@app.route('/forgot-password', methods=['GET', 'POST'])
def forgot_password():
    if request.method == 'POST':
        email = request.form.get('email', '').strip().lower()
        
        if not email:
            flash('Please enter your email address!', 'danger')
            return redirect(url_for('forgot_password'))
        
        user = get_user_by_email(email)
        if user:
            try:
                token = create_password_reset_token(user['id'])
                reset_url = url_for('reset_password', token=token, _external=True)
                
                # Send email
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
                flash('Password reset link has been sent to your email!', 'success')
            except Exception as e:
                print(f"Error sending email: {e}")
                flash('Error sending email. Please try again later or contact support.', 'danger')
        else:
            # Don't reveal if email exists for security
            flash('If that email exists, a password reset link has been sent.', 'info')
        
        return redirect(url_for('login'))
    
    return render_template('forgot_password.html')

@app.route('/reset-password/<token>', methods=['GET', 'POST'])
def reset_password(token):
    user_data = get_user_by_reset_token(token)
    
    if not user_data:
        flash('Invalid or expired reset token!', 'danger')
        return redirect(url_for('forgot_password'))
    
    if request.method == 'POST':
        password = request.form.get('password')
        confirm_password = request.form.get('confirm_password')
        
        if not password or len(password) < 6:
            flash('Password must be at least 6 characters long!', 'danger')
            return render_template('reset_password.html', token=token)
        
        if password != confirm_password:
            flash('Passwords do not match!', 'danger')
            return render_template('reset_password.html', token=token)
        
        try:
            password_hash = generate_password_hash(password)
            update_user_password(user_data['id'], password_hash)
            mark_token_as_used(token)
            flash('Password reset successfully! Please log in with your new password.', 'success')
            return redirect(url_for('login'))
        except Exception as e:
            flash('Error resetting password. Please try again.', 'danger')
            return render_template('reset_password.html', token=token)
    
    return render_template('reset_password.html', token=token)

@app.route('/logout')
@login_required
def logout():
    logout_user()
    flash('Logged out successfully!', 'info')
    return redirect(url_for('dashboard'))

@app.route('/admin', methods=['GET', 'POST'])
@login_required
def admin():
    if request.method == 'POST':
        action = request.form.get('action')
        
        # Handle add/edit/delete actions
        if action == 'add':
            try:
                projects = load_projects()
                new_project = {
                    'boma_id': request.form.get('boma_id', 'N/A'),
                    'name': request.form.get('name', '').strip(),
                    'status': request.form.get('status', 'planned'),
                    'units': int(request.form.get('units', 0)),
                    'image': request.form.get('image', '').strip(),
                    'lat': float(request.form.get('lat', 0)),
                    'lon': float(request.form.get('lon', 0)),
                    'description': request.form.get('description', '').strip(),
                    'unit_types': request.form.get('unit_types', '').strip(),
                    'price_start': int(request.form.get('price_start', 0)) if request.form.get('price_start') else None
                }
                
                # Validation
                if not new_project['name']:
                    flash('Project name is required!', 'danger')
                    return redirect(url_for('admin'))
                
                projects.append(new_project)
                save_projects(projects)
                flash('Project added successfully!', 'success')
            except ValueError as e:
                flash(f'Invalid input: {str(e)}', 'danger')
            except Exception as e:
                flash(f'Error adding project: {str(e)}', 'danger')
        
        elif action == 'edit':
            try:
                projects = load_projects()
                project_id = int(request.form.get('project_id'))
                
                if project_id < 0 or project_id >= len(projects):
                    flash('Invalid project ID!', 'danger')
                    return redirect(url_for('admin'))
                
                projects[project_id].update({
                    'boma_id': request.form.get('boma_id', 'N/A'),
                    'name': request.form.get('name', '').strip(),
                    'status': request.form.get('status', 'planned'),
                    'units': int(request.form.get('units', 0)),
                    'image': request.form.get('image', '').strip(),
                    'lat': float(request.form.get('lat', 0)),
                    'lon': float(request.form.get('lon', 0)),
                    'description': request.form.get('description', '').strip(),
                    'unit_types': request.form.get('unit_types', '').strip(),
                    'price_start': int(request.form.get('price_start', 0)) if request.form.get('price_start') else None
                })
                
                # Validation
                if not projects[project_id]['name']:
                    flash('Project name is required!', 'danger')
                    return redirect(url_for('admin'))
                
                save_projects(projects)
                flash('Project updated successfully!', 'success')
            except (ValueError, IndexError) as e:
                flash(f'Invalid input: {str(e)}', 'danger')
            except Exception as e:
                flash(f'Error updating project: {str(e)}', 'danger')
        
        elif action == 'delete':
            try:
                projects = load_projects()
                project_id = int(request.form.get('project_id'))
                
                if project_id < 0 or project_id >= len(projects):
                    flash('Invalid project ID!', 'danger')
                    return redirect(url_for('admin'))
                
                project_name = projects[project_id]['name']
                projects.pop(project_id)
                save_projects(projects)
                flash(f'Project "{project_name}" deleted successfully!', 'success')
            except (ValueError, IndexError) as e:
                flash(f'Invalid project ID: {str(e)}', 'danger')
            except Exception as e:
                flash(f'Error deleting project: {str(e)}', 'danger')
        
        return redirect(url_for('admin'))
    
    projects = load_projects()
    return render_template('admin.html', projects=projects)

@app.route('/api/projects')
def get_projects():
    return jsonify(load_projects())

@app.errorhandler(404)
def not_found(error):
    return render_template('404.html'), 404

if __name__ == '__main__':
    # Initialize database on startup
    try:
        init_db()
    except Exception as e:
        print(f"Warning: Could not initialize database: {e}")
        print("The app will continue but database features may not work.")
    
    app.run(debug=True)

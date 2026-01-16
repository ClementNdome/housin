from flask import Flask, render_template, jsonify, request, redirect, url_for, flash, session
import json
import os

app = Flask(__name__)
app.secret_key = 'your-secret-key-change-in-production'  # For flash messages

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

@app.route('/admin', methods=['GET', 'POST'])
def admin():
    if request.method == 'POST':
        action = request.form.get('action')
        
        # Handle login
        if action == 'login':
            password = request.form.get('password')
            if password == 'admin123':  # Change this in production!
                session['admin_logged_in'] = True
                flash('Successfully logged in!', 'success')
            else:
                flash('Invalid password!', 'danger')
            return redirect(url_for('admin'))
        
        # Check if logged in for other actions
        if not session.get('admin_logged_in'):
            flash('Please log in first!', 'danger')
            return redirect(url_for('admin'))
        
        # Handle add/edit/delete actions
        if action == 'add':
            projects = load_projects()
            new_project = {
                'boma_id': request.form.get('boma_id', 'N/A'),
                'name': request.form.get('name'),
                'status': request.form.get('status'),
                'units': int(request.form.get('units', 0)),
                'image': request.form.get('image', ''),
                'lat': float(request.form.get('lat', 0)),
                'lon': float(request.form.get('lon', 0)),
                'description': request.form.get('description', ''),
                'unit_types': request.form.get('unit_types', ''),
                'price_start': int(request.form.get('price_start', 0)) if request.form.get('price_start') else None
            }
            projects.append(new_project)
            save_projects(projects)
            flash('Project added successfully!', 'success')
        
        elif action == 'edit':
            projects = load_projects()
            project_id = int(request.form.get('project_id'))
            projects[project_id].update({
                'boma_id': request.form.get('boma_id', 'N/A'),
                'name': request.form.get('name'),
                'status': request.form.get('status'),
                'units': int(request.form.get('units', 0)),
                'image': request.form.get('image', ''),
                'lat': float(request.form.get('lat', 0)),
                'lon': float(request.form.get('lon', 0)),
                'description': request.form.get('description', ''),
                'unit_types': request.form.get('unit_types', ''),
                'price_start': int(request.form.get('price_start', 0)) if request.form.get('price_start') else None
            })
            save_projects(projects)
            flash('Project updated successfully!', 'success')
        
        elif action == 'delete':
            projects = load_projects()
            project_id = int(request.form.get('project_id'))
            projects.pop(project_id)
            save_projects(projects)
            flash('Project deleted successfully!', 'success')
        
        elif action == 'logout':
            session.pop('admin_logged_in', None)
            flash('Logged out successfully!', 'info')
        
        return redirect(url_for('admin'))
    
    projects = load_projects()
    is_logged_in = session.get('admin_logged_in', False)
    return render_template('admin.html', projects=projects, is_logged_in=is_logged_in)

@app.route('/api/projects')
def get_projects():
    return jsonify(load_projects())

@app.errorhandler(404)
def not_found(error):
    return render_template('404.html'), 404

if __name__ == '__main__':
    app.run(debug=True)

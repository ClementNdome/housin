#!/usr/bin/env python3
"""
Pre-Deployment Verification Script
Tests all critical components before going to production
"""

import os
import sys
import subprocess
from pathlib import Path

# Color codes for terminal output
GREEN = '\033[92m'
RED = '\033[91m'
YELLOW = '\033[93m'
BLUE = '\033[94m'
RESET = '\033[0m'
CHECK = '✅'
CROSS = '❌'
WARN = '⚠️'

class PreDeploymentTest:
    def __init__(self):
        self.passed = 0
        self.failed = 0
        self.warnings = 0
        
    def print_header(self, text):
        print(f"\n{BLUE}{'='*60}{RESET}")
        print(f"{BLUE}{text}{RESET}")
        print(f"{BLUE}{'='*60}{RESET}\n")
    
    def print_test(self, name, passed, message=""):
        if passed:
            self.passed += 1
            status = f"{GREEN}{CHECK} PASS{RESET}"
        else:
            self.failed += 1
            status = f"{RED}{CROSS} FAIL{RESET}"
        print(f"{status} | {name}")
        if message:
            print(f"      → {message}")
    
    def print_warning(self, name, message=""):
        self.warnings += 1
        status = f"{YELLOW}{WARN} WARN{RESET}"
        print(f"{status} | {name}")
        if message:
            print(f"      → {message}")
    
    def print_summary(self):
        print(f"\n{BLUE}{'='*60}{RESET}")
        print(f"{BLUE}TEST SUMMARY{RESET}")
        print(f"{BLUE}{'='*60}{RESET}")
        print(f"{GREEN}Passed: {self.passed}{RESET}")
        print(f"{RED}Failed: {self.failed}{RESET}")
        print(f"{YELLOW}Warnings: {self.warnings}{RESET}")
        
        if self.failed == 0:
            print(f"\n{GREEN}✅ ALL CRITICAL TESTS PASSED - READY FOR DEPLOYMENT!{RESET}\n")
            return 0
        else:
            print(f"\n{RED}❌ SOME TESTS FAILED - FIX ISSUES BEFORE DEPLOYING!{RESET}\n")
            return 1
    
    def test_python_version(self):
        """Test Python version >= 3.8"""
        self.print_header("1. PYTHON VERSION")
        version = sys.version_info
        passed = version.major == 3 and version.minor >= 8
        self.print_test(
            "Python 3.8+",
            passed,
            f"Found: Python {version.major}.{version.minor}.{version.micro}"
        )
    
    def test_syntax(self):
        """Test app.py syntax"""
        self.print_header("2. CODE SYNTAX")
        try:
            result = subprocess.run(
                [sys.executable, '-m', 'py_compile', 'app.py'],
                capture_output=True,
                text=True
            )
            passed = result.returncode == 0
            self.print_test("app.py syntax", passed, result.stderr if result.stderr else "✓ No errors")
        except Exception as e:
            self.print_test("app.py syntax", False, str(e))
    
    def test_requirements(self):
        """Test that requirements.txt exists and is valid"""
        self.print_header("3. DEPENDENCIES")
        
        # Check requirements.txt exists
        req_file = Path('requirements.txt')
        req_exists = req_file.exists()
        self.print_test("requirements.txt exists", req_exists)
        
        if req_exists:
            with open(req_file) as f:
                lines = f.readlines()
                packages = [line.strip() for line in lines if line.strip() and not line.startswith('#')]
            
            required = ['Flask', 'Flask-Login', 'Flask-WTF', 'psycopg2', 'Flask-Mail', 'python-dotenv']
            for pkg in required:
                found = any(pkg.lower() in line.lower() for line in packages)
                self.print_test(f"  → {pkg} in requirements.txt", found)
    
    def test_environment_template(self):
        """Test .env.example exists"""
        self.print_header("4. ENVIRONMENT CONFIGURATION")
        
        env_example = Path('.env.example')
        env_exists = env_example.exists()
        self.print_test(".env.example exists", env_exists)
        
        # Check for required variables in .env.example
        if env_exists:
            with open(env_example) as f:
                content = f.read()
            required_vars = ['APP_SECRET_KEY', 'FLASK_ENV', 'LOG_TO_FILE']
            for var in required_vars:
                found = var in content
                self.print_test(f"  → {var} in .env.example", found)
    
    def test_templates(self):
        """Test that all templates exist"""
        self.print_header("5. TEMPLATES")
        
        templates_dir = Path('templates')
        critical_templates = [
            'base.html',
            'index.html',
            'login.html',
            'signup.html',
            'admin.html',
            '404.html',
            '500.html'
        ]
        
        for template in critical_templates:
            template_path = templates_dir / template
            exists = template_path.exists()
            self.print_test(f"  → {template}", exists)
            
            # Check for CSRF token in form templates
            if template in ['login.html', 'signup.html', 'admin.html']:
                with open(template_path) as f:
                    content = f.read()
                    has_csrf = 'csrf_token' in content
                    self.print_test(f"    → CSRF token in {template}", has_csrf)
    
    def test_static_files(self):
        """Test that static files exist"""
        self.print_header("6. STATIC FILES")
        
        static_dir = Path('static')
        static_exists = static_dir.exists()
        self.print_test("static/ directory exists", static_exists)
        
        if static_exists:
            required_files = [
                'css/style.css',
                'js/map.js',
                'js/search.js',
                'js/stats.js'
            ]
            for file in required_files:
                file_path = static_dir / file
                exists = file_path.exists()
                self.print_test(f"  → {file}", exists)
    
    def test_database_config(self):
        """Test database configuration"""
        self.print_header("7. DATABASE CONFIGURATION")
        
        has_db_url = 'DATABASE_URL' in os.environ
        if has_db_url:
            self.print_test("DATABASE_URL environment variable", True, "✓ Set")
        else:
            self.print_warning(
                "DATABASE_URL environment variable",
                "Not set - will use JSON fallback (OK for development)"
            )
    
    def test_logging_config(self):
        """Test logging configuration"""
        self.print_header("8. LOGGING CONFIGURATION")
        
        log_to_file = os.getenv('LOG_TO_FILE', 'false').lower() in ['true', '1', 'yes']
        flask_env = os.getenv('FLASK_ENV', 'development')
        
        self.print_test(
            "Logging configuration",
            True,
            f"LOG_TO_FILE={log_to_file}, FLASK_ENV={flask_env}"
        )
        
        if flask_env == 'production' and log_to_file:
            self.print_warning(
                "File logging in production",
                "Ensure filesystem is writable (or set LOG_TO_FILE=false)"
            )
    
    def test_security_keys(self):
        """Test security configuration"""
        self.print_header("9. SECURITY CONFIGURATION")
        
        secret_key = os.getenv('APP_SECRET_KEY')
        if secret_key:
            self.print_test("APP_SECRET_KEY environment variable", True, "✓ Set")
            if len(secret_key) < 32:
                self.print_warning(
                    "APP_SECRET_KEY length",
                    f"Only {len(secret_key)} chars (recommend 32+)"
                )
        else:
            self.print_warning(
                "APP_SECRET_KEY environment variable",
                "Not set - will generate temporary key (OK for dev, NOT for production)"
            )
        
        # Check that app.py uses environment variables for secrets (not hardcoded values)
        with open('app.py') as f:
            content = f.read()
            # Check for proper environment variable usage
            has_env_variable = "os.getenv('APP_SECRET_KEY')" in content
            has_env_check = "if not SECRET_KEY" in content
            secure_implementation = has_env_variable and has_env_check
            self.print_test(
                "APP_SECRET_KEY uses environment variables",
                secure_implementation,
                "✓ Properly configured" if secure_implementation else "Issue detected"
            )
    
    def test_imports(self):
        """Test critical imports can be loaded"""
        self.print_header("10. IMPORTS AVAILABILITY")
        
        critical_imports = [
            ('flask', 'Flask'),
            ('flask_login', 'Flask-Login'),
            ('flask_mail', 'Flask-Mail'),
            ('flask_wtf', 'Flask-WTF'),
            ('psycopg2', 'psycopg2'),
        ]
        
        for module, name in critical_imports:
            try:
                __import__(module)
                self.print_test(f"  → {name}", True)
            except ImportError:
                self.print_test(f"  → {name}", False, "Not installed")
    
    def run_all_tests(self):
        """Run all verification tests"""
        print(f"\n{BLUE}PRE-DEPLOYMENT VERIFICATION{RESET}")
        print(f"{BLUE}Flask Housing Application{RESET}\n")
        
        self.test_python_version()
        self.test_syntax()
        self.test_requirements()
        self.test_environment_template()
        self.test_templates()
        self.test_static_files()
        self.test_database_config()
        self.test_logging_config()
        self.test_security_keys()
        self.test_imports()
        
        return self.print_summary()

if __name__ == '__main__':
    tester = PreDeploymentTest()
    exit_code = tester.run_all_tests()
    sys.exit(exit_code)

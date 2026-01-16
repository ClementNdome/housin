#!/usr/bin/env python3
"""
Simple script to migrate projects from projects.json to the database.
Run this from the project directory: python migrate_data.py
"""

import os
import sys
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

# Import app and migration function
try:
    from app import migrate_projects_from_json, init_db, DATABASE_URL
    
    if __name__ == '__main__':
        if not DATABASE_URL:
            print("ERROR: DATABASE_URL environment variable is not set!")
            print("Please set DATABASE_URL in your .env file or environment variables.")
            sys.exit(1)
        
        print("=" * 60)
        print("Migrating projects from projects.json to database...")
        print("=" * 60)
        
        try:
            # Ensure database is initialized
            print("Initializing database...")
            init_db(force=True)
            print("[OK] Database initialized")
            
            # Run migration
            print("\nRunning migration...")
            result = migrate_projects_from_json(force=True)
            
            if result:
                print("=" * 60)
                print("[SUCCESS] Migration completed successfully!")
                print("=" * 60)
            else:
                print("=" * 60)
                print("[FAILED] Migration failed. Check the error messages above.")
                print("=" * 60)
                sys.exit(1)
                
        except Exception as e:
            print(f"\n[ERROR] Migration failed with error: {e}")
            import traceback
            traceback.print_exc()
            sys.exit(1)
            
except ImportError as e:
    print(f"ERROR: Could not import required modules: {e}")
    print("Make sure you're running this from the project directory and all dependencies are installed.")
    sys.exit(1)

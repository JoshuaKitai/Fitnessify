from flask import Flask, request, jsonify
from flask_sqlalchemy import SQLAlchemy
from flask_cors import CORS
from flask_bcrypt import Bcrypt
from flask_jwt_extended import JWTManager, jwt_required, create_access_token, get_jwt_identity
import datetime
import requests
import unicodedata
import os
from dotenv import load_dotenv
import logging
load_dotenv()

app = Flask(__name__)
CORS(app)

# Nutritionix credentials
NUTRITIONIX_APP_ID = os.getenv("NUTRITIONIX_APP_ID")
NUTRITIONIX_API_KEY = os.getenv("NUTRITIONIX_API_KEY")

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Configuration
app.config['JWT_SECRET_KEY'] = os.getenv('JWT_SECRET_KEY')
app.config['JWT_ACCESS_TOKEN_EXPIRES'] = datetime.timedelta(days=7)
app.config['SQLALCHEMY_DATABASE_URI'] = 'sqlite:///fitness.db'
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False
app.config['JWT_TOKEN_LOCATION'] = ['headers']
app.config['JWT_HEADER_NAME'] = 'Authorization'
app.config['JWT_HEADER_TYPE'] = 'Bearer'

print(f"DEBUG: JWT Secret Key: {app.config.get('JWT_SECRET_KEY', 'NOT FOUND')}")
print(f"DEBUG: Working directory: {os.getcwd()}")
print(f"DEBUG: .env file exists: {os.path.exists('.env')}")
print(f"DEBUG: NUTRITIONIX_APP_ID: {os.getenv('NUTRITIONIX_APP_ID', 'NOT FOUND')}")

db = SQLAlchemy(app)
bcrypt = Bcrypt(app)
jwt_manager = JWTManager(app)
'''
@jwt_manager.expired_token_loader
def expired_token_callback(jwt_header, jwt_payload):
    return jsonify({'error': 'Token has expired'}), 401

@jwt_manager.invalid_token_loader
def invalid_token_callback(error):
    return jsonify({'error': 'Invalid token'}), 401

@jwt_manager.unauthorized_loader
def missing_token_callback(error):
    return jsonify({'error': 'Token is required'}), 401
# Initialize extensions
'''

# Models
class User(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    username = db.Column(db.String(50), unique=True, nullable=False)
    email = db.Column(db.String(100), unique=True, nullable=False)
    password_hash = db.Column(db.String(128), nullable=False)
    created_at = db.Column(db.DateTime, default=datetime.datetime.utcnow)
    is_active = db.Column(db.Boolean, default=True)

    # Relationships
    calorie_entries = db.relationship('CalorieEntry', backref='user', lazy=True, cascade='all, delete-orphan')
    progress_entries = db.relationship('ProgressEntry', backref='user', lazy=True, cascade='all, delete-orphan')
    goals = db.relationship('UserGoals', backref='user', lazy=True, cascade='all, delete-orphan')

    def to_dict(self):
        return {
            'id': self.id,
            'username': self.username,
            'email': self.email,
            'created_at': self.created_at.isoformat(),
            'is_active': self.is_active
        }

    def set_password(self, password):
        self.password_hash = bcrypt.generate_password_hash(password).decode('utf-8')

    def check_password(self, password):
        return bcrypt.check_password_hash(self.password_hash, password)


class CalorieEntry(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('user.id'), nullable=False)
    name = db.Column(db.String(255), nullable=False)
    calories = db.Column(db.Float, nullable=False)
    protein = db.Column(db.Float, nullable=False)
    carbs = db.Column(db.Float, nullable=False)
    fat = db.Column(db.Float, nullable=False)
    date = db.Column(db.Date, default=datetime.date.today, index=True)
    created_at = db.Column(db.DateTime, default=datetime.datetime.utcnow)

    def to_dict(self):
        return {
            'id': self.id,
            'name': self.name,
            'calories': self.calories,
            'protein': self.protein,
            'carbs': self.carbs,
            'fat': self.fat,
            'date': self.date.isoformat()
        }


class ProgressEntry(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('user.id'), nullable=False)
    person_weight = db.Column(db.Float, nullable=False)
    bench = db.Column(db.Float, nullable=False)
    squat = db.Column(db.Float, nullable=False)
    dead_lift = db.Column(db.Float, nullable=False)
    date = db.Column(db.Date, default=datetime.date.today, index=True)
    created_at = db.Column(db.DateTime, default=datetime.datetime.utcnow)

    def to_dict(self):
        return {
            'id': self.id,
            'person_weight': self.person_weight,
            'bench': self.bench,
            'squat': self.squat,
            'dead_lift': self.dead_lift,
            'date': self.date.strftime('%Y-%m-%d')
        }


class UserGoals(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('user.id'), nullable=False)
    daily_calories = db.Column(db.Float, default=2000)
    daily_protein = db.Column(db.Float, default=150)
    daily_carbs = db.Column(db.Float, default=250)
    daily_fat = db.Column(db.Float, default=65)
    target_weight = db.Column(db.Float)
    created_at = db.Column(db.DateTime, default=datetime.datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.datetime.utcnow, onupdate=datetime.datetime.utcnow)


class NutritionCache(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    query = db.Column(db.String(500), nullable=False, unique=True)
    food_name = db.Column(db.String(255), nullable=False)
    calories = db.Column(db.Float, nullable=False)
    protein = db.Column(db.Float, nullable=False)
    carbs = db.Column(db.Float, nullable=False)
    fat = db.Column(db.Float, nullable=False)
    serving_qty = db.Column(db.Float)
    serving_unit = db.Column(db.String(50))
    created_at = db.Column(db.DateTime, default=datetime.datetime.utcnow)


# Helper function to get current user
def get_current_user():
    try:
        print("DEBUG: get_current_user() called")

        # Check if we're in a request context
        from flask import has_request_context
        if not has_request_context():
            print("DEBUG: No request context")
            return None

        # Check the Authorization header
        from flask import request
        auth_header = request.headers.get('Authorization')
        print(f"DEBUG: Authorization header: {auth_header[:50] if auth_header else 'None'}...")

        user_id = get_jwt_identity()
        print(f"DEBUG: JWT Identity: {user_id}")

        if user_id is None:
            print("DEBUG: user_id is None")
            return None

        user = User.query.get(user_id)
        print(f"DEBUG: Found user: {user.username if user else 'None'}")
        return user
    except Exception as e:
        print(f"DEBUG: Error getting current user: {e}")
        logger.error(f"Error getting current user: {e}")
        return None


with app.app_context():
    db.create_all()


# Basic Routes
@app.route('/')
def index():
    return jsonify(message="Tracking Your Goals to Stay Fit")


@app.route('/test')
def test():
    return jsonify({"status": "Backend is working!", "timestamp": datetime.datetime.now().isoformat()})


# Authentication Routes
@app.route('/auth/register', methods=['POST'])
def register():
    try:
        data = request.get_json()
        if not data:
            return jsonify({"error": "No data provided"}), 400

        required_fields = ['username', 'email', 'password']
        for field in required_fields:
            if field not in data or not data[field].strip():
                return jsonify({"error": f"Missing or empty field: {field}"}), 400

        username = data['username'].strip()
        email = data['email'].strip().lower()
        password = data['password']

        # Validation
        if len(username) < 2 or len(username) > 50:
            return jsonify({"error": "Username must be between 2 and 50 characters"}), 400

        if len(password) < 6:
            return jsonify({"error": "Password must be at least 6 characters long"}), 400

        # Check if user already exists
        if User.query.filter_by(username=username).first():
            return jsonify({"error": "Username already exists"}), 409

        if User.query.filter_by(email=email).first():
            return jsonify({"error": "Email already registered"}), 409

        # Create new user
        new_user = User(username=username, email=email)
        new_user.set_password(password)

        db.session.add(new_user)
        db.session.commit()

        # Create default goals for new user
        default_goals = UserGoals(user_id=new_user.id)
        db.session.add(default_goals)
        db.session.commit()

        # Create access token
        access_token = create_access_token(identity=str(new_user.id))

        logger.info(f"New user registered: {username} ({email})")
        return jsonify({
            "message": "User registered successfully",
            "token": access_token,
            "user": new_user.to_dict()
        }), 201

    except Exception as e:
        db.session.rollback()
        logger.error(f"Registration error: {e}")
        return jsonify({"error": "Registration failed"}), 500


@app.route('/auth/login', methods=['POST'])
def login():
    try:
        data = request.get_json()
        if not data:
            return jsonify({"error": "No data provided"}), 400

        email = data.get('email', '').strip().lower()
        password = data.get('password', '')

        if not email or not password:
            return jsonify({"error": "Email and password are required"}), 400

        # Find user by email
        user = User.query.filter_by(email=email).first()

        if not user or not user.check_password(password):
            return jsonify({"error": "Invalid email or password"}), 401

        if not user.is_active:
            return jsonify({"error": "Account is deactivated"}), 401

        # Create access token
        access_token = create_access_token(identity=str(user.id))

        logger.info(f"User logged in: {user.username}")
        return jsonify({
            "message": "Login successful",
            "token": access_token,
            "user": user.to_dict()
        }), 200

    except Exception as e:
        logger.error(f"Login error: {e}")
        return jsonify({"error": "Login failed"}), 500


@app.route('/auth/verify', methods=['GET'])
@jwt_required()
def verify_token():
    try:
        current_user = get_current_user()
        if not current_user or not current_user.is_active:
            return jsonify({"error": "Invalid token"}), 401

        return jsonify({
            "message": "Token is valid",
            "user": current_user.to_dict()
        }), 200

    except Exception as e:
        logger.error(f"Token verification error: {e}")
        return jsonify({"error": "Token verification failed"}), 401


@app.route('/auth/profile', methods=['GET'])
@jwt_required()
def get_profile():
    try:
        current_user = get_current_user()
        if not current_user:
            return jsonify({"error": "User not found"}), 404

        return jsonify({"user": current_user.to_dict()}), 200

    except Exception as e:
        logger.error(f"Profile fetch error: {e}")
        return jsonify({"error": "Failed to fetch profile"}), 500


# Nutritionix API (now with authentication)
@app.route('/api/nutritionix', methods=['POST'])
@jwt_required()
def get_nutritionix_data():
    try:
        data = request.get_json()
        if not data or 'query' not in data:
            return jsonify({"error": "No query provided"}), 400

        raw_query = data.get('query', '').strip()
        food_query = unicodedata.normalize("NFKD", raw_query).encode("ascii", "ignore").decode().strip()

        if not food_query:
            return jsonify({"error": "No query provided"}), 400

        # Check cache first
        try:
            cached = NutritionCache.query.filter(NutritionCache.query == food_query.lower()).first()
            if cached:
                logger.info(f"Cache hit for query: {food_query}")
                return jsonify({
                    "food_name": cached.food_name,
                    "calories": cached.calories,
                    "protein": cached.protein,
                    "carbs": cached.carbs,
                    "fat": cached.fat,
                    "serving_qty": cached.serving_qty,
                    "serving_unit": cached.serving_unit
                })
        except Exception as cache_error:
            logger.warning(f"Cache check failed: {cache_error}")

        # For testing purposes, return mock data if API keys not set
        if NUTRITIONIX_APP_ID == "your_app_id_here":
            logger.info(f"Using mock data for: {food_query}")
            mock_result = {
                "food_name": f"Mock {food_query}",
                "calories": 150.0,
                "protein": 5.0,
                "carbs": 30.0,
                "fat": 2.0,
                "serving_qty": 1.0,
                "serving_unit": "serving"
            }

            # Try to cache the mock result
            try:
                cache_entry = NutritionCache(
                    query=food_query.lower(),
                    food_name=mock_result["food_name"],
                    calories=mock_result["calories"],
                    protein=mock_result["protein"],
                    carbs=mock_result["carbs"],
                    fat=mock_result["fat"],
                    serving_qty=mock_result["serving_qty"],
                    serving_unit=mock_result["serving_unit"]
                )
                db.session.add(cache_entry)
                db.session.commit()
            except Exception as cache_save_error:
                logger.warning(f"Failed to cache mock data: {cache_save_error}")
                db.session.rollback()

            return jsonify(mock_result)

        # Call real Nutritionix API
        headers = {
            "x-app-id": NUTRITIONIX_APP_ID,
            "x-app-key": NUTRITIONIX_API_KEY,
            "Content-Type": "application/json"
        }

        body = {"query": food_query}

        response = requests.post(
            "https://trackapi.nutritionix.com/v2/natural/nutrients",
            headers=headers,
            json=body,
            timeout=10
        )

        if response.status_code == 200:
            food = response.json()['foods'][0]
            result = {
                "food_name": food['food_name'],
                "calories": food['nf_calories'],
                "protein": food['nf_protein'],
                "carbs": food['nf_total_carbohydrate'],
                "fat": food['nf_total_fat'],
                "serving_qty": food['serving_qty'],
                "serving_unit": food['serving_unit']
            }

            # Cache the real result
            try:
                cache_entry = NutritionCache(
                    query=food_query.lower(),
                    food_name=result["food_name"],
                    calories=result["calories"],
                    protein=result["protein"],
                    carbs=result["carbs"],
                    fat=result["fat"],
                    serving_qty=result["serving_qty"],
                    serving_unit=result["serving_unit"]
                )
                db.session.add(cache_entry)
                db.session.commit()
                logger.info(f"Cached nutrition data for: {food_query}")
            except Exception as cache_save_error:
                logger.warning(f"Failed to cache nutrition data: {cache_save_error}")
                db.session.rollback()

            return jsonify(result)

        else:
            logger.error(f"Nutritionix API failed with status {response.status_code}: {response.text}")
            return jsonify({"error": f"Nutritionix API failed (Status: {response.status_code})"}), response.status_code

    except requests.exceptions.Timeout:
        logger.error("Nutritionix API timeout")
        return jsonify({"error": "Request timeout - please try again"}), 504
    except requests.exceptions.RequestException as e:
        logger.error(f"Nutritionix API request error: {e}")
        return jsonify({"error": "Unable to connect to nutrition database"}), 502
    except Exception as e:
        logger.error(f"Unexpected error in nutritionix: {e}")
        return jsonify({"error": "Internal server error"}), 500


# Calorie entries (now user-specific)
@app.route('/entries', methods=['GET'])
@jwt_required()
def get_entries():
    try:
        current_user = get_current_user()
        entries = CalorieEntry.query.filter_by(user_id=current_user.id).order_by(
            CalorieEntry.date.desc(), CalorieEntry.created_at.desc()
        ).all()
        return jsonify([entry.to_dict() for entry in entries])
    except Exception as e:
        logger.error(f"Error fetching entries: {e}")
        return jsonify({"error": "Failed to fetch entries"}), 500


@app.route('/entries', methods=['POST'])
@jwt_required()
def add_entry():
    try:
        current_user = get_current_user()
        data = request.get_json()
        if not data:
            return jsonify({"error": "No data provided"}), 400

        # Validate required fields
        required_fields = ['name', 'calories', 'protein', 'carbs', 'fat']
        for field in required_fields:
            if field not in data:
                return jsonify({"error": f"Missing field: {field}"}), 400

        new_entry = CalorieEntry(
            user_id=current_user.id,
            name=data['name'][:255],  # Truncate if too long
            calories=float(data['calories']),
            protein=float(data['protein']),
            carbs=float(data['carbs']),
            fat=float(data['fat'])
        )
        db.session.add(new_entry)
        db.session.commit()

        logger.info(f"Added calorie entry for user {current_user.username}: {data['name']}")
        return jsonify({
            "message": "Entry added successfully!",
            "entry": new_entry.to_dict()
        }), 201
    except ValueError as e:
        return jsonify({"error": "Invalid numeric values"}), 400
    except Exception as e:
        db.session.rollback()
        logger.error(f"Error adding entry: {e}")
        return jsonify({"error": "Failed to add entry"}), 500


@app.route('/entries/today', methods=['GET'])
@jwt_required()
def get_today_entries():
    try:
        current_user = get_current_user()
        today = datetime.date.today()
        entries = CalorieEntry.query.filter_by(
            user_id=current_user.id,
            date=today
        ).order_by(CalorieEntry.created_at.desc()).all()
        return jsonify([entry.to_dict() for entry in entries])
    except Exception as e:
        logger.error(f"Error fetching today's entries: {e}")
        return jsonify({"error": "Failed to fetch entries"}), 500


@app.route('/entries/<int:id>', methods=['DELETE'])
@jwt_required()
def delete_entry(id):
    try:
        current_user = get_current_user()
        entry = CalorieEntry.query.filter_by(id=id, user_id=current_user.id).first()

        if not entry:
            return jsonify({"error": "Entry not found or access denied"}), 404

        db.session.delete(entry)
        db.session.commit()
        logger.info(f"Deleted calorie entry {id} for user {current_user.username}")
        return jsonify({"message": "Entry deleted successfully!"}), 200
    except Exception as e:
        db.session.rollback()
        logger.error(f"Error deleting entry: {e}")
        return jsonify({"error": "Failed to delete entry"}), 500


# Date range endpoints (now user-specific)
@app.route('/entries/date-range', methods=['GET'])
@jwt_required()
def get_entries_by_date_range():
    try:
        current_user = get_current_user()
        start_date = request.args.get('start_date')
        end_date = request.args.get('end_date')

        if not start_date or not end_date:
            return jsonify({"error": "start_date and end_date required"}), 400

        try:
            start = datetime.datetime.strptime(start_date, '%Y-%m-%d').date()
            end = datetime.datetime.strptime(end_date, '%Y-%m-%d').date()
        except ValueError:
            return jsonify({"error": "Invalid date format. Use YYYY-MM-DD"}), 400

        entries = CalorieEntry.query.filter(
            CalorieEntry.user_id == current_user.id,
            CalorieEntry.date.between(start, end)
        ).order_by(CalorieEntry.date.desc()).all()

        # Group by date
        entries_by_date = {}
        for entry in entries:
            date_str = entry.date.isoformat()
            if date_str not in entries_by_date:
                entries_by_date[date_str] = []
            entries_by_date[date_str].append(entry.to_dict())

        return jsonify(entries_by_date)
    except Exception as e:
        logger.error(f"Error fetching entries by date range: {e}")
        return jsonify({"error": "Failed to fetch entries"}), 500


@app.route('/entries/<date>', methods=['GET'])
@jwt_required()
def get_entries_by_date(date):
    try:
        current_user = get_current_user()
        target_date = datetime.datetime.strptime(date, '%Y-%m-%d').date()
        entries = CalorieEntry.query.filter_by(
            user_id=current_user.id,
            date=target_date
        ).order_by(CalorieEntry.created_at.desc()).all()
        return jsonify([entry.to_dict() for entry in entries])
    except ValueError:
        return jsonify({"error": "Invalid date format. Use YYYY-MM-DD"}), 400
    except Exception as e:
        logger.error(f"Error fetching entries by date: {e}")
        return jsonify({"error": "Failed to fetch entries"}), 500


# Progress entries (now user-specific)
@app.route('/progress', methods=['POST'])
@jwt_required()
def add_progress():
    try:
        current_user = get_current_user()
        data = request.get_json()
        if not data:
            return jsonify({"error": "No data provided"}), 400

        required_fields = ['person_weight', 'bench', 'squat', 'dead_lift']
        for field in required_fields:
            if field not in data:
                return jsonify({"error": f"Missing field: {field}"}), 400

        new_progress_entry = ProgressEntry(
            user_id=current_user.id,
            person_weight=float(data['person_weight']),
            bench=float(data['bench']),
            squat=float(data['squat']),
            dead_lift=float(data['dead_lift']),
        )
        db.session.add(new_progress_entry)
        db.session.commit()

        logger.info(f"Added progress entry for user {current_user.username}: Weight {data['person_weight']}, Bench {data['bench']}")
        return jsonify({
            "message": "Progress entry added successfully!",
            "entry": new_progress_entry.to_dict()
        }), 201
    except ValueError as e:
        return jsonify({"error": "Invalid numeric values"}), 400
    except Exception as e:
        db.session.rollback()
        logger.error(f"Error adding progress: {e}")
        return jsonify({"error": "Failed to add progress entry"}), 500


@app.route('/progress', methods=['GET'])
@jwt_required()
def get_progress_entries():
    try:
        current_user = get_current_user()
        entries = ProgressEntry.query.filter_by(user_id=current_user.id).order_by(ProgressEntry.date.asc()).all()
        return jsonify([entry.to_dict() for entry in entries])
    except Exception as e:
        logger.error(f"Error fetching progress entries: {e}")
        return jsonify({"error": "Failed to fetch progress entries"}), 500


@app.route('/progress/<int:id>', methods=['DELETE'])
@jwt_required()
def delete_progress_entry(id):
    try:
        current_user = get_current_user()
        entry = ProgressEntry.query.filter_by(id=id, user_id=current_user.id).first()

        if not entry:
            return jsonify({"error": "Progress entry not found or access denied"}), 404

        db.session.delete(entry)
        db.session.commit()
        logger.info(f"Deleted progress entry {id} for user {current_user.username}")
        return jsonify({"message": "Progress entry deleted successfully!"}), 200
    except Exception as e:
        db.session.rollback()
        logger.error(f"Error deleting progress entry: {e}")
        return jsonify({"error": "Failed to delete progress entry"}), 500


@app.route('/progress/date-range', methods=['GET'])
@jwt_required()
def get_progress_by_date_range():
    try:
        current_user = get_current_user()
        start_date = request.args.get('start_date')
        end_date = request.args.get('end_date')

        if not start_date or not end_date:
            return jsonify({"error": "start_date and end_date required"}), 400

        try:
            start = datetime.datetime.strptime(start_date, '%Y-%m-%d').date()
            end = datetime.datetime.strptime(end_date, '%Y-%m-%d').date()
        except ValueError:
            return jsonify({"error": "Invalid date format. Use YYYY-MM-DD"}), 400

        entries = ProgressEntry.query.filter(
            ProgressEntry.user_id == current_user.id,
            ProgressEntry.date.between(start, end)
        ).order_by(ProgressEntry.date.desc()).all()

        # Group by date
        entries_by_date = {}
        for entry in entries:
            date_str = entry.date.isoformat()
            if date_str not in entries_by_date:
                entries_by_date[date_str] = []
            entries_by_date[date_str].append(entry.to_dict())

        return jsonify(entries_by_date)
    except Exception as e:
        logger.error(f"Error fetching progress by date range: {e}")
        return jsonify({"error": "Failed to fetch progress entries"}), 500


@app.route('/progress/<date>', methods=['GET'])
@jwt_required()
def get_progress_by_date(date):
    try:
        current_user = get_current_user()
        target_date = datetime.datetime.strptime(date, '%Y-%m-%d').date()
        entries = ProgressEntry.query.filter_by(
            user_id=current_user.id,
            date=target_date
        ).order_by(ProgressEntry.created_at.desc()).all()
        return jsonify([entry.to_dict() for entry in entries])
    except ValueError:
        return jsonify({"error": "Invalid date format. Use YYYY-MM-DD"}), 400
    except Exception as e:
        logger.error(f"Error fetching progress by date: {e}")
        return jsonify({"error": "Failed to fetch progress entries"}), 500


# Goals management (now user-specific)
@app.route('/goals', methods=['GET'])
@jwt_required()
def get_goals():
    try:
        current_user = get_current_user()
        goals = UserGoals.query.filter_by(user_id=current_user.id).first()
        if not goals:
            return jsonify({
                "daily_calories": 2000,
                "daily_protein": 150,
                "daily_carbs": 250,
                "daily_fat": 65,
                "target_weight": None
            })

        return jsonify({
            "daily_calories": goals.daily_calories,
            "daily_protein": goals.daily_protein,
            "daily_carbs": goals.daily_carbs,
            "daily_fat": goals.daily_fat,
            "target_weight": goals.target_weight
        })
    except Exception as e:
        logger.error(f"Error fetching goals: {e}")
        return jsonify({"error": "Failed to fetch goals"}), 500


@app.route('/goals', methods=['POST'])
@jwt_required()
def update_goals():
    try:
        current_user = get_current_user()
        data = request.get_json()
        if not data:
            return jsonify({"error": "No data provided"}), 400

        goals = UserGoals.query.filter_by(user_id=current_user.id).first()
        if not goals:
            goals = UserGoals(user_id=current_user.id)
            db.session.add(goals)

        if 'daily_calories' in data:
            goals.daily_calories = float(data['daily_calories'])
        if 'daily_protein' in data:
            goals.daily_protein = float(data['daily_protein'])
        if 'daily_carbs' in data:
            goals.daily_carbs = float(data['daily_carbs'])
        if 'daily_fat' in data:
            goals.daily_fat = float(data['daily_fat'])
        if 'target_weight' in data:
            goals.target_weight = float(data['target_weight']) if data['target_weight'] else None

        goals.updated_at = datetime.datetime.utcnow()
        db.session.commit()

        logger.info(f"Updated goals for user {current_user.username}: {data}")
        return jsonify({"message": "Goals updated successfully!"}), 200
    except ValueError as e:
        return jsonify({"error": "Invalid numeric values"}), 400
    except Exception as e:
        db.session.rollback()
        logger.error(f"Error updating goals: {e}")
        return jsonify({"error": "Failed to update goals"}), 500


# Summary statistics (now user-specific)
@app.route('/stats/summary', methods=['GET'])
@jwt_required()
def get_summary_stats():
    try:
        print("DEBUG: Inside stats endpoint")
        current_user = get_current_user()
        print(f"DEBUG: Current user in stats: {current_user}")
        if not current_user:
            print("DEBUG: No current user found in stats")
            return jsonify({"error": "User not found"}), 401
        days = request.args.get('days', 7, type=int)
        end_date = datetime.date.today()
        start_date = end_date - datetime.timedelta(days=days - 1)

        calorie_entries = CalorieEntry.query.filter(
            CalorieEntry.user_id == current_user.id,
            CalorieEntry.date.between(start_date, end_date)
        ).all()

        progress_entries = ProgressEntry.query.filter(
            ProgressEntry.user_id == current_user.id,
            ProgressEntry.date.between(start_date, end_date)
        ).order_by(ProgressEntry.date.desc()).all()

        total_calories = sum(e.calories for e in calorie_entries)
        total_protein = sum(e.protein for e in calorie_entries)
        total_carbs = sum(e.carbs for e in calorie_entries)
        total_fat = sum(e.fat for e in calorie_entries)

        latest_progress = progress_entries[0] if progress_entries else None

        return jsonify({
            "period": f"Last {days} days",
            "nutrition": {
                "total_calories": total_calories,
                "avg_daily_calories": total_calories / days,
                "total_protein": total_protein,
                "total_carbs": total_carbs,
                "total_fat": total_fat
            },
            "latest_progress": latest_progress.to_dict() if latest_progress else None,
            "entries_count": len(calorie_entries),
            "progress_entries_count": len(progress_entries)
        })
    except Exception as e:
        logger.error(f"Error fetching summary stats: {e}")
        return jsonify({"error": "Failed to fetch summary statistics"}), 500


# Error handlers
@app.errorhandler(401)
def unauthorized(error):
    return jsonify({"error": "Authentication required"}), 401


@app.errorhandler(403)
def forbidden(error):
    return jsonify({"error": "Access forbidden"}), 403


@app.errorhandler(404)
def not_found(error):
    return jsonify({"error": "Resource not found"}), 404


@app.errorhandler(500)
def internal_error(error):
    db.session.rollback()
    return jsonify({"error": "Internal server error"}), 500


if __name__ == "__main__":
    print("Starting Flask app with Authentication...")
    print("Backend will be available at: http://localhost:5000")
    print("Test endpoint: http://localhost:5000/test")
    print(f"Using Nutritionix API: {'Real API' if NUTRITIONIX_APP_ID != 'your_app_id_here' else 'Mock Data'}")
    print("Authentication endpoints available:")
    print("  POST /auth/register - Register new user")
    print("  POST /auth/login - User login")
    print("  GET /auth/verify - Verify token")
    print("  GET /auth/profile - Get user profile")
    app.run(debug=True, host='0.0.0.0', port=5000)
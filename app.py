from flask import Flask, request, jsonify, send_file
from flask_sqlalchemy import SQLAlchemy
from flask_cors import CORS
import datetime
import requests
import unicodedata
from dotenv import load_dotenv
import os
import io
app = Flask(__name__)
CORS(app)
load_dotenv()

# Nutritionix credentials
NUTRITIONIX_APP_ID = os.getenv("NUTRITIONIX_APP_ID")
NUTRITIONIX_API_KEY = os.getenv("NUTRITIONIX_API_KEY")

app.config['SQLALCHEMY_DATABASE_URI'] = 'sqlite:///fitness.db'
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False
db = SQLAlchemy(app)

# Models
class CalorieEntry(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(255), nullable=False)
    calories = db.Column(db.Float, nullable=False)
    protein = db.Column(db.Float, nullable=False)
    carbs = db.Column(db.Float, nullable=False)
    fat = db.Column(db.Float, nullable=False)
    date = db.Column(db.Date, default=datetime.date.today)

class ProgressEntry(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    person_weight = db.Column(db.Float, nullable=False)
    bench = db.Column(db.Float, nullable=False)
    squat = db.Column(db.Float, nullable=False)
    dead_lift = db.Column(db.Float, nullable=False)
    date = db.Column(db.Date, default=datetime.date.today)

class WallEntry(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    

with app.app_context():
    db.create_all()

# Routes
@app.route('/')
def index():
    return jsonify(message="Tracking Your Goals to Stay Fit")

# Nutritionix API
@app.route('/api/nutritionix', methods=['POST'])
def get_nutritionix_data():
    try:
        data = request.get_json(force=True)
        raw_query = data.get('query', '')
        food_query = unicodedata.normalize("NFKD", raw_query).encode("ascii", "ignore").decode().strip()

        if not food_query:
            return jsonify({"error": "No query provided"}), 400

        headers = {
            "x-app-id": NUTRITIONIX_APP_ID,
            "x-app-key": NUTRITIONIX_API_KEY,
            "Content-Type": "application/json"
        }

        body = {"query": food_query}

        response = requests.post("https://trackapi.nutritionix.com/v2/natural/nutrients", headers=headers, json=body)

        if response.status_code == 200:
            food = response.json()['foods'][0]
            return jsonify({
                "food_name": food['food_name'].encode("ascii", "ignore").decode().strip(),
                "calories": food['nf_calories'],
                "protein": food['nf_protein'],
                "carbs": food['nf_total_carbohydrate'],
                "fat": food['nf_total_fat'],
                "serving_qty": food['serving_qty'],
                "serving_unit": food['serving_unit']
            })

        return jsonify({"error": "Nutritionix API failed"}), response.status_code

    except Exception as e:
        return jsonify({"error": str(e)}), 500

# Calorie entries
@app.route('/entries', methods=['GET'])
def get_entries():
    entries = CalorieEntry.query.order_by(CalorieEntry.date.desc()).all()
    return jsonify([{
        'id': e.id,
        'name': e.name,
        'calories': e.calories,
        'protein': e.protein,
        'carbs': e.carbs,
        'fat': e.fat,
        'date': e.date.isoformat()
    } for e in entries])

@app.route('/entries', methods=['POST'])
def add_entry():
    data = request.get_json()
    new_entry = CalorieEntry(
        name=data['name'],
        calories=data['calories'],
        protein=data['protein'],
        carbs=data['carbs'],
        fat=data['fat']
    )
    db.session.add(new_entry)
    db.session.commit()
    return jsonify({"message": "Entry added successfully!"}), 201

@app.route('/entries/<date>', methods=['GET'])
def get_entries_by_date(date):
    try:
        target_date = datetime.datetime.strptime(date, '%Y-%m-%d').date()
        entries = CalorieEntry.query.filter_by(date=target_date).all()
        return jsonify([{
            'id': e.id,
            'name': e.name,
            'calories': e.calories,
            'protein': e.protein,
            'carbs': e.carbs,
            'fat': e.fat,
            'date': e.date.isoformat()
        } for e in entries])
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route('/entries/today', methods=['GET'])
def get_today_entries():
    today = datetime.date.today()
    entries = CalorieEntry.query.filter_by(date=today).order_by(CalorieEntry.id.desc()).all()
    return jsonify([{
        'id': e.id,
        'name': e.name,
        'calories': e.calories,
        'protein': e.protein,
        'carbs': e.carbs,
        'fat': e.fat,
        'date': e.date.isoformat()
    } for e in entries])


@app.route('/entries/<int:id>', methods=['DELETE'])
def delete_entry(id):
    entry_delete = CalorieEntry.query.get_or_404(id)
    db.session.delete(entry_delete)
    db.session.commit()
    return jsonify({"message": "Entry deleted successfully!"}), 201

# Progress entries
@app.route('/progress', methods=['POST'])
def add_progress():
    data = request.get_json()
    new_progress_entry = ProgressEntry(
        person_weight=data['person_weight'],
        bench=data['bench'],
        squat=data['squat'],
        dead_lift=data['dead_lift'],
    )
    db.session.add(new_progress_entry)
    db.session.commit()
    return jsonify({"message": "Progress Entry added successfully!"}), 201

@app.route('/progress/<date>', methods=['GET'])
def get_progress_by_date(date):
    try:
        target_date = datetime.datetime.strptime(date, '%Y-%m-%d').date()
        entries = ProgressEntry.query.filter_by(date=target_date).all()
        return jsonify([{
            'id': e.id,
            'person_weight': e.person_weight,
            'bench': e.bench,
            'squat': e.squat,
            'dead_lift': e.dead_lift,
            'date': e.date.isoformat()
        } for e in entries])
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route('/progress/<int:id>', methods=['DELETE'])
def delete_progress_entry(id):
    entry_delete = ProgressEntry.query.get_or_404(id)
    db.session.delete(entry_delete)
    db.session.commit()
    return jsonify({"message": "Entry deleted successfully!"}), 201

@app.route('/progress', methods=['GET'])
def get_progress_entries():
    entries = ProgressEntry.query.order_by(ProgressEntry.date.asc()).all()
    return jsonify([{
        'id': e.id,
        'person_weight': e.person_weight,
        'bench': e.bench,
        'squat': e.squat,
        'dead_lift': e.dead_lift,
        'date': e.date.strftime('%Y-%m-%d')
    } for e in entries])

if __name__ == "__main__":
    app.run(debug=True)

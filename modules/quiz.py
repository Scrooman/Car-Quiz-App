from flask import Blueprint, Flask, app, render_template, jsonify, make_response, session
import os
import json
import requests
from flask import request
from dotenv import load_dotenv
from google.cloud import firestore

from database import add_points_to_team, team_exists, update_correct_answers_counter, get_team_stats, db, update_incorrect_answers_counter, update_questions_generated_counter
from modules import auth

TRIVIA_API_URL = os.getenv('TRIVIA_API_URL', 'https://opentdb.com/api.php')


load_dotenv()

bp = Blueprint('quiz', __name__)


@bp.route('/get-questions', methods=['GET'])
@auth.login_required
def get_questions():
    quiz_api = request.cookies.get('selectedQuizApi', 'default_quiz_api')
    if quiz_api == "Trivia API":
        amount = request.args.get('amount', 1)
        category = request.args.get('category', '')
        difficulty = request.args.get('difficulty', '')
        question_type = request.args.get('type', '')

        base_url = TRIVIA_API_URL
        params = {'amount': amount}
        if category:
            params['category'] = category
        if difficulty:
            params['difficulty'] = difficulty
        if question_type:
            params['type'] = question_type

        try:
            response = requests.get(base_url, params=params)
            response.raise_for_status()

            return jsonify(response.json())
        except Exception as e:
            return jsonify({'error': str(e)}), 500
    else:
        return jsonify({'error': 'Unsupported quiz API selected'}), 400
    

@bp.route('/get-categories', methods=['GET'])
@auth.login_required
def get_categories():
    try:
        response = requests.get('https://opentdb.com/api_category.php')
        response.raise_for_status()
        return jsonify(response.json())
    except Exception as e:
        return jsonify({'error': str(e)}), 500
    

@bp.route('/team/stats/question', methods=['POST'])
@auth.login_required
def team_question_stats_update():
    """
    Endpoint aktualizacji statystyk zespołu dla pytań
    
    Expected JSON:
    {
        "categoryId": "int",
        "categoryName": "string"
    }
    """
    try:
        data = request.json
        category_id = str(data.get('categoryId', 'general'))  # ✅ Zamień na string
        category_name = data.get('categoryName', 'general')  # ✅ Pobierz nazwę kategorii

        print(f"request data: {data}, category: {category_id}  ")
        team_name = session.get('team_name', 'default_team')
        if team_exists(team_name) is False:
            return jsonify({'success': False, 'error': 'Team not found'}), 404
        
        update_questions_generated_counter(team_name, category_id, category_name)
        team_stats = get_team_stats(team_name)
        
        return jsonify({'success': True, 'message': 'Team stats updated successfully', 'result': team_stats}), 200
        
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500

    

@bp.route('/team/stats/answer', methods=['POST'])
@auth.login_required
def team_answer_stats_update():
    """
    Endpoint aktualizacji statystyk zespołu
    
    Expected JSON:
    {
        "is_correct_answer": true/false,
        "category_id": "int"
    }
    """
    try:
        data = request.json
        is_correct_answer = data.get('is_correct_answer', False)
        category_id = str(data.get('category_id', 'general'))  # ✅ Zamień na string
        team_name = session.get('team_name', 'default_team')
        if team_exists(team_name) is False:
            return jsonify({'success': False, 'error': 'Team not found'}), 404
        
        if is_correct_answer:
            add_points_to_team(team_name, category_id, 10)
            update_correct_answers_counter(team_name, category_id)
        else:
            update_incorrect_answers_counter(team_name, category_id)
            print(f"No points added. Incorrect answer for team: {team_name}")
        
        team_stats = get_team_stats(team_name)
        
        return jsonify({'status': True, 'message': 'Team stats updated successfully', 'result': team_stats}), 200
        
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500

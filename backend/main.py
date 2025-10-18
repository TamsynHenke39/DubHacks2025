from flask import Flask, jsonify, request
from flask_cors import CORS
from datetime import datetime

app = Flask(__name__)

bets = [] # Empty bets list

@app.route('/')
def index():
    return 'Test'

@app.route('/api/bets', methods=['GET'])
def get_bets():
    return jsonify({'bets': bets})

@app.route('/api/bets/create', methods=['POST'])
def create_bet():
    data = request.get_json()
    
    bet = {
        'id': len(bets) + 1,
        'sender': data.get('sender'),
        'receiver': data.get('receiver'),
        'amount': data.get('amount'),
        'description': data.get('description'),
        'status': 'pending'
    }
    
    bets.append(bet)  # Add to the list
    
    return jsonify({'status': 'success', 'bet': bet}), 201


# @app.route('/users')
# def users():
#     return {'users': ['user1', 'user2']}

if __name__ == '__main__':
    app.run(debug=True, port=5000)
    

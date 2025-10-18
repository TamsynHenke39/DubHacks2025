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

@app.route('/api/bets/<int:bet_id>/accept', methods=['POST'])
def accept_bet(bet_id):
    # Finds the bet in the "bets" list 
    bet = next((b for b in bets if b.get('id') == bet_id), None)
    if not bet: # If the bet doesn't exist, then we return an error
        return jsonify({'error': 'Bet not found'}), 404

    if bet.get('status') == 'accepted':
        return jsonify({'status': 'already_accepted', 'bet': bet}), 200
    if bet.get('status') == 'settled':
        return jsonify({'error': 'Bet already settled'}), 400

    # Changes the status of the bet from "pending" to "accepted"
    data = request.get_json(silent=True) or {}
    bet['status'] = 'accepted'
    bet['accepted_at'] = datetime.utcnow().isoformat()
    if 'user' in data:
        bet['accepted_by'] = data['user']

    # TODO: authorize funds (VISA) here and store auth/hold id
    bet['payment'] = {'status': 'authorization_pending', 'auth_id': None}

    return jsonify({'status': 'success', 'bet': bet}), 200

# @app.route('/users')
# def users():
#     return {'users': ['user1', 'user2']}

if __name__ == '__main__':
    app.run(debug=True, port=5000)
    

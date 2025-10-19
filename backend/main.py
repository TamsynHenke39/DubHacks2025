from flask import Flask, jsonify, request
from flask_cors import CORS
from datetime import datetime

app = Flask(__name__)
CORS(app)

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

@app.route('/api/bets/<int:bet_id>/settle', methods=['POST'])
def settle_bet(bet_id):
    # Find the bet
    bet = next((b for b in bets if b.get('id') == bet_id), None)
    
    if not bet:
        return jsonify({'error': 'Bet not found'}), 404
    
    # Check if bet is in correct status
    if bet.get('status') != 'accepted':
        return jsonify({'error': 'Bet must be accepted before settling'}), 400
    
    if bet.get('status') == 'settled':
        return jsonify({'error': 'Bet already settled'}), 400
    
    # Get winner from request
    data = request.get_json()
    winner = data.get('winner')  # Should be 'sender' or 'receiver'
    
    # Validate winner
    if winner not in ['sender', 'receiver']:
        return jsonify({'error': 'Winner must be "sender" or "receiver"'}), 400
    
    # Update bet status
    bet['status'] = 'settled'
    bet['winner'] = winner
    bet['settled_at'] = datetime.utcnow().isoformat()
    
    # Determine who won and who lost
    if winner == 'sender':
        winner_email = bet['sender']
        loser_email = bet['receiver']
    else:
        winner_email = bet['receiver']
        loser_email = bet['sender']
    
    # TODO: VISA Payment Integration Goes Here
    # This is where you'll:
    # 1. Charge the loser's account (bet['amount'])
    # 2. Transfer money to winner's account
    # 3. Store transaction IDs
    
    bet['payment'] = {
        'status': 'completed',
        'winner': winner_email,
        'loser': loser_email,
        'amount': bet['amount'],
        'transaction_id': None  # Will be filled when VISA API is integrated
    }
    
    return jsonify({
        'status': 'success',
        'bet': bet,
        'message': f'Bet settled. ${bet["amount"]} transferred to {winner_email}'
    }), 200

if __name__ == '__main__':
    app.run(debug=True, port=5000)
    

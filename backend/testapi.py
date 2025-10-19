import requests

BASE_URL = 'http://localhost:5000/api'

# Test 1: Create a bet
print("Creating bet...")
response = requests.post(f'{BASE_URL}/bets/create', json={
    'sender': 'alice@email.com',
    'receiver': 'bob@email.com',
    'amount': 25.00,
    'description': 'I bet Seahawks win'
})
print(response.json())
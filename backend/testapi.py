import requests
import random

BASE_URL = 'http://localhost:5000/api'

users = ['alice@email.com', 'bob@email.com', 'charlie@email.com', 'diana@email.com']

sample_descriptions = [
    'I bet the Seahawks win this Sunday',
    'You can\'t finish this project in 2 hours',
    'It will rain tomorrow',
    'Lakers will beat the Warriors',
    'You won\'t get an A on the exam',
    'I can eat a large pizza in 20 minutes',
    'Bitcoin will hit $100k by year end',
    'Coffee shop runs out of bagels by noon',
    'I bet you can\'t go a week without coffee',
    'Our team wins first place at DubHacks',
    'Stock market goes up 5% this month',
    'Library will be full by 2pm',
    'I can solve this coding problem in 10 minutes',
    'New iPhone released before November',
    'Next bus arrives late',
    'Tesla stock hits $300 this quarter',
    'Gym has no treadmills at 6pm',
    'I can hold a plank for 5 minutes',
    'Professor extends the deadline',
    'New restaurant gets 4-star review',
    'I can beat you at chess',
    'It snows this weekend',
    'Crypto market crashes tomorrow',
    'I can run a 5k in under 25 minutes',
    'The lecture gets cancelled',
    'Parking lot is completely full',
    'I can name all 50 states in 2 minutes',
    'The game goes into overtime',
    'Stock split announced this week',
    'I can learn Python in 24 hours'
]

for i in range(30):
    sender = random.choice(users)
    receiver = random.choice([u for u in users if u != sender])
    amount = round(random.uniform(5, 100), 2) # Generates random amounts
    description = random.choice(sample_descriptions)
    
    response = requests.post(f'{BASE_URL}/bets/create', json={
        'sender': sender,
        'receiver': receiver,
        'amount': amount,
        'description': description
    })
    
    if response.ok:
        print(f"✓ Created bet #{i+1}: ${amount} - {description[:40]}...")
    else:
        print(f"✗ Failed to create bet #{i+1}")

print(f"\n✅ Generated 30 sample bets!")
print(f"View them at: {BASE_URL}/bets")
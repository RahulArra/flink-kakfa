import json
import time
import random
from datetime import datetime
from kafka import KafkaProducer

# 1. Initialize the Kafka Producer
print("Connecting to Kafka Broker...")
producer = KafkaProducer(
    bootstrap_servers=['localhost:9092'],
    # Automatically convert dictionaries to JSON bytes
    value_serializer=lambda v: json.dumps(v).encode('utf-8')
)
print("Connected! Starting data stream...\n")

# 2. Synthetic Data Banks
subjects = ["The app", "My delivery", "The price", "Customer service", "The new update"]
verbs_good = ["is amazing", "arrived early", "is totally worth it", "fixed the bug", "is super fast"]
verbs_bad = ["crashed again", "is so late", "is way too high", "ignored my email", "is the worst"]
keywords = ["bug", "crash", "late", "cost", "price", "fast", "great", "delivery"]

def generate_tweet():
    # 50/50 chance of a good or bad tweet
    is_positive = random.choice([True, False])

    if is_positive:
        text = f"{random.choice(subjects)} {random.choice(verbs_good)}!"
    else:
        text = f"{random.choice(subjects)} {random.choice(verbs_bad)}! {random.choice(keywords)}"

    return {
        "text": text,
        "timestamp": datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    }

# 3. The Infinite Streaming Loop
try:
    while True:
        tweet = generate_tweet()

        # Send to the 'tweets' topic
        producer.send('tweets', tweet)

        # Force the message to send immediately
        producer.flush()

        print(f"Sent -> {tweet['text']}")

        # Wait 2 seconds before sending the next one
        time.sleep(2)

except KeyboardInterrupt:
    print("\nStopping stream...")
finally:
    producer.close()

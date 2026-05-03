from textblob import TextBlob
import os
import sys
import json
import requests
import urllib.request
from pyflink.common import SimpleStringSchema, Types
from pyflink.datastream import StreamExecutionEnvironment
from pyflink.datastream.connectors.kafka import KafkaSource, KafkaOffsetsInitializer
from pyflink.common.watermark_strategy import WatermarkStrategy

# --- 1. BULLETPROOF JAR LOADING ---
JAR_NAME = "flink-sql-connector-kafka-3.0.1-1.18.jar"
JAR_PATH = os.path.abspath(JAR_NAME)

# If the JAR is missing or corrupted, auto-download it
if not os.path.exists(JAR_PATH) or os.path.getsize(JAR_PATH) < 1000000:
    print(f"Downloading {JAR_NAME}...")
    url = f"https://repo.maven.apache.org/maven2/org/apache/flink/flink-sql-connector-kafka/3.0.1-1.18/{JAR_NAME}"
    urllib.request.urlretrieve(url, JAR_PATH)
    print("Download complete!")

# --- 2. STREAMING LOGIC ---
def process_tweet(data_str):
    try:
        tweet = json.loads(data_str)
        text = tweet.get("text", "")

        # --- REAL NLP INFERENCE ---
        # TextBlob uses a pre-trained lexicon to calculate mathematical polarity (-1.0 to 1.0)
        analysis = TextBlob(text)
        polarity_score = analysis.sentiment.polarity

        if polarity_score > 0:
            sentiment = "Positive"
        elif polarity_score < 0:
            sentiment = "Negative"
        else:
            sentiment = "Neutral"

        # We can keep categories hardcoded for routing, as that's standard for tagging
        category = "General"
        text_lower = text.lower()
        if "delivery" in text_lower or "late" in text_lower: category = "Logistics"
        elif "crash" in text_lower or "bug" in text_lower: category = "Technical"
        elif "price" in text_lower or "cost" in text_lower: category = "Pricing"

        # Fire instantly to Node.js
        payload = [{"text": text, "sentiment": sentiment, "category": category}]
        requests.post("http://172.17.112.1:5000/live-tweets", json=payload, timeout=2)

        return f"Processed: {category} | {sentiment} ({polarity_score})"
    except Exception as e:
        return f"Error: {e}"

def main():
    # 3. Initialize Environment
    env = StreamExecutionEnvironment.get_execution_environment()

    # 4. Inject the JAR using an absolute URI
    jar_uri = f"file://{JAR_PATH}"
    env.add_jars(jar_uri)
    print(f"Successfully loaded Java dependencies from: {jar_uri}")

    # 5. Build Kafka Source
    source = KafkaSource.builder() \
        .set_bootstrap_servers("localhost:9092") \
        .set_topics("tweets") \
        .set_group_id("flink_streaming_group") \
        .set_starting_offsets(KafkaOffsetsInitializer.latest()) \
        .set_value_only_deserializer(SimpleStringSchema()) \
        .build()

    # 6. Execute Pipeline
    stream = env.from_source(source, WatermarkStrategy.no_watermarks(), "Kafka Source")
    stream.map(process_tweet, output_type=Types.STRING()).print()

    print("Starting Flink True-Streaming Engine...")
    env.execute("FlinkKafkaDashboard")

if __name__ == '__main__':
    main()

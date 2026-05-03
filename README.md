
# 🚀 Real-Time Big Data Streaming & Sentiment Analytics Pipeline

## 📌 Overview
This project implements a **true real-time big data streaming pipeline** using Apache Kafka, Apache Flink, and a React dashboard.

It processes streaming data, performs **NLP-based sentiment analysis**, and visualizes results instantly with sub-second latency.

---

## ⚙️ Tech Stack
- Python (Data Producer)
- Apache Kafka + Zookeeper (Message Broker)
- Apache Flink (Stream Processing - PyFlink)
- TextBlob (NLP Sentiment Analysis)
- Node.js + Express (Backend)
- Socket.io (Real-time communication)
- React.js (Frontend Dashboard)

---

## 📂 Project Structure

```

DASHBOARD/
│
├── backend/
│   ├── node_modules/
│   ├── package-lock.json
│   ├── package.json
│   └── server.js
│
├── flink/
│   └── flink_stream.py
│
├── producer/
│   └── python_producer.py
│
├── public/
│
├── src/
│   ├── assets/
│   ├── pages/
│   │   ├── Alert.jsx
│   │   └── Analytics.jsx
│   ├── App.css
│   ├── App.jsx
│   ├── index.css
│   └── main.jsx
│
├── .gitignore
├── eslint.config.js
├── index.html
├── package-lock.json
├── package.json
├── README.md
└── vite.config.js

```

---

## ⚠️ Important Setup (WSL Required)

Before running the project:

Copy the following files into WSL (Ubuntu):

- `flink/flink_stream.py`
- `producer/python_producer.py`

### Example:
```

cp -r /mnt/c/Users/rahul/Desktop/dashboard/flink ~/kafka/
cp -r /mnt/c/Users/rahul/Desktop/dashboard/producer ~/kafka/

```

---

## ▶️ Execution Steps (Startup Sequence)

You need **6 terminals**.

---

### 🔹 Step 1: Start Zookeeper
**Terminal 1 (WSL)**
```

cd ~/kafka_2.13-3.4.1
bin/zookeeper-server-start.sh config/zookeeper.properties

```

---

### 🔹 Step 2: Start Kafka
**Terminal 2 (WSL)**
```

cd ~/kafka_2.13-3.4.1
bin/kafka-server-start.sh config/server.properties

```

---

### 🔹 Step 3: Create Kafka Topic
```

cd ~/kafka_2.13-3.4.1
bin/kafka-topics.sh --create --topic tweets --bootstrap-server localhost:9092 --partitions 1 --replication-factor 1

```

---

### 🔹 Step 4: Start Backend (Node.js)
**Terminal 3 (Windows PowerShell)**
```

cd C:\Users\rahul\Desktop\dashboard\backend
node server.js

```

---

### 🔹 Step 5: Start Frontend (React)
**Terminal 4 (Windows PowerShell)**
```

cd C:\Users\rahul\Desktop\dashboard
npm run dev

```

Open in browser:
```

[http://localhost:5173](http://localhost:5173)

```

---

### 🔹 Step 6: Start Apache Flink
**Terminal 5 (WSL)**
```

source ~/.bashrc
conda activate flink_env
cd ~/kafka
python flink_stream.py

```

---

### 🔹 Step 7: Start Python Producer
**Terminal 6 (WSL)**
```

source ~/.bashrc
conda activate flink_env
cd ~/kafka
python python_producer.py

```

---

## 🔄 Data Flow

```

Python Producer → Kafka → Flink (NLP) → Node.js → React Dashboard

```

---

## 📊 Features
- Real-time streaming pipeline
- Event-by-event processing (True Streaming)
- NLP-based sentiment analysis (TextBlob)
- WebSocket live updates
- Interactive React dashboard

---

## 📈 Output
- Live streaming tweets/data
- Sentiment classification:
  - Positive
  - Negative
  - Neutral
- Real-time charts and analytics

---

## 🧠 Key Highlights
- End-to-end latency < 1 second
- Fully event-driven architecture
- Scalable pipeline design

---

## 🚀 Future Scope
- Cloud deployment (AWS / GCP)
- Advanced NLP models (BERT)
- Real-time alerting system

---


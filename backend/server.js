const express = require('express')
const http = require('http')
const { Server } = require('socket.io')
const cors = require('cors')

const PORT = 5000
const FRONTEND_ORIGIN = 'http://localhost:5173'
const MAX_LIVE_TWEETS = 50
const MAX_ANALYTICS_POINTS = 200
const MAX_ALERTS = 20
const BUCKET_SIZE_MS = 5000
const MAX_VELOCITY_BUCKETS = 12
const NEGATIVE_ALERT_WINDOW_MS = 10000
const NEGATIVE_ALERT_THRESHOLD = 5
const ALERT_COOLDOWN_MS = 10000

const app = express()
app.use(cors())
app.use(express.json())

const server = http.createServer(app)
const io = new Server(server, {
    cors: {
        origin: FRONTEND_ORIGIN,
        methods: ['GET', 'POST']
    }
})

let analyticsData = []
let alertsData = []
let liveTweets = []
let velocityData = []
let negativeTweetTimestamps = []
let lastCriticalAlertAt = 0

function formatBucketLabel(bucketStart) {
    return new Date(bucketStart).toLocaleTimeString('en-US', {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: false
    })
}

function pushVelocityBucket(bucketStart) {
    velocityData.push({
        bucketStart,
        time: formatBucketLabel(bucketStart),
        positive: 0,
        negative: 0
    })

    if (velocityData.length > MAX_VELOCITY_BUCKETS) {
        velocityData = velocityData.slice(-MAX_VELOCITY_BUCKETS)
    }
}

function incrementVelocityBucket(timestamp, sentiment) {
    const bucketStart = timestamp - (timestamp % BUCKET_SIZE_MS)
    const lastBucket = velocityData[velocityData.length - 1]

    if (!lastBucket) {
        pushVelocityBucket(bucketStart)
    } else if (bucketStart > lastBucket.bucketStart) {
        for (
            let nextBucketStart = lastBucket.bucketStart + BUCKET_SIZE_MS;
            nextBucketStart <= bucketStart;
            nextBucketStart += BUCKET_SIZE_MS
        ) {
            pushVelocityBucket(nextBucketStart)
        }
    }

    const currentBucket = velocityData[velocityData.length - 1]
    if (!currentBucket || currentBucket.bucketStart !== bucketStart) {
        pushVelocityBucket(bucketStart)
    }

    const bucket = velocityData[velocityData.length - 1]

    if (sentiment === 'Positive') {
        bucket.positive += 1
    }

    if (sentiment === 'Negative') {
        bucket.negative += 1
    }
}

function evaluateCriticalAlert(timestamp) {
    negativeTweetTimestamps = negativeTweetTimestamps.filter(
        (entryTimestamp) => timestamp - entryTimestamp <= NEGATIVE_ALERT_WINDOW_MS
    )

    const negativeCount = negativeTweetTimestamps.length
    const movingAverage = Number(
        (negativeCount / (NEGATIVE_ALERT_WINDOW_MS / 1000)).toFixed(2)
    )

    if (
        negativeCount > NEGATIVE_ALERT_THRESHOLD &&
        timestamp - lastCriticalAlertAt >= ALERT_COOLDOWN_MS
    ) {
        const alertPayload = {
            id: `${timestamp}`,
            category: 'Negative Sentiment',
            count: negativeCount,
            movingAverage,
            threshold: NEGATIVE_ALERT_THRESHOLD,
            windowSeconds: NEGATIVE_ALERT_WINDOW_MS / 1000,
            triggeredAt: new Date(timestamp).toLocaleTimeString()
        }

        alertsData = [alertPayload, ...alertsData].slice(0, MAX_ALERTS)
        lastCriticalAlertAt = timestamp

        io.emit('critical_alert', alertPayload)
        io.emit('new_alerts', alertsData)
    }
}

io.on('connection', (socket) => {
    console.log(`User connected: ${socket.id}`)
    socket.emit('initial_data', {
        analyticsData,
        alertsData,
        liveTweets,
        velocityData
    })
})

app.post('/live-tweets', (req, res) => {
    const incomingTweets = Array.isArray(req.body) ? req.body : []

    if (incomingTweets.length === 0) {
        return res.status(400).send('Expected an array of tweet objects')
    }

    const receivedAt = Date.now()

    liveTweets = [...incomingTweets, ...liveTweets].slice(0, MAX_LIVE_TWEETS)

    incomingTweets.forEach((tweet) => {
        analyticsData.push({
            sentiment: tweet.sentiment,
            category: tweet.category,
            count: 1
        })

        incrementVelocityBucket(receivedAt, tweet.sentiment)

        if (tweet.sentiment === 'Negative') {
            negativeTweetTimestamps.push(receivedAt)
        }
    })

    if (analyticsData.length > MAX_ANALYTICS_POINTS) {
        analyticsData = analyticsData.slice(-MAX_ANALYTICS_POINTS)
    }

    evaluateCriticalAlert(receivedAt)

    console.log(
        `Sending to React -> Tweets: ${liveTweets.length} | Analytics: ${analyticsData.length} | Velocity buckets: ${velocityData.length}`
    )

    io.emit('new_tweets', liveTweets)
    io.emit('new_analytics', analyticsData)
    io.emit('velocity_update', velocityData)

    return res.send('Data successfully processed and pushed to React')
})

server.listen(PORT, '0.0.0.0', () => {
    console.log(`WebSocket Server running on port ${PORT}`)
})

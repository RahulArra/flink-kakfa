import { useEffect, useRef, useState } from "react"
import io from "socket.io-client"
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  Legend,
  LineChart,
  Line,
  CartesianGrid,
} from "recharts"
import {
  MessageSquare,
  ThumbsUp,
  AlertTriangle,
  Activity,
  TrendingUp,
  TrendingDown,
  Minus,
} from "lucide-react"

const socket = io("http://localhost:5000")

const COLORS = {
  Positive: "#2ecc71",
  Negative: "#ef233c",
  Neutral: "#f1c40f",
}

function createTweetSignature(tweet) {
  return `${tweet.sentiment || "Unknown"}__${tweet.category || "Uncategorized"}__${tweet.text || ""}`
}

function hydrateTweets(incomingTweets, previousFeed = []) {
  const previousBySignature = new Map()

  previousFeed.forEach((tweet) => {
    const signature = createTweetSignature(tweet)
    const queue = previousBySignature.get(signature) || []
    queue.push(tweet)
    previousBySignature.set(signature, queue)
  })

  return incomingTweets.map((tweet, index) => {
    const signature = createTweetSignature(tweet)
    const queue = previousBySignature.get(signature) || []
    const existingTweet = queue.shift()

    if (existingTweet) {
      previousBySignature.set(signature, queue)
      return {
        ...existingTweet,
        ...tweet,
      }
    }

    return {
      ...tweet,
      feedId: `${signature}-${Date.now()}-${index}`,
      receivedAt: Date.now(),
    }
  })
}

function formatRelativeTime(timestamp, now) {
  const diffSeconds = Math.max(0, Math.floor((now - timestamp) / 1000))

  if (diffSeconds < 5) return "Just now"
  if (diffSeconds < 60) return `${diffSeconds}s ago`

  const diffMinutes = Math.floor(diffSeconds / 60)
  if (diffMinutes < 60) return `${diffMinutes}m ago`

  const diffHours = Math.floor(diffMinutes / 60)
  return `${diffHours}h ago`
}

function getSentimentPresentation(sentiment) {
  if (sentiment === "Positive") {
    return {
      color: "var(--success)",
      softBackground: "rgba(46, 204, 113, 0.12)",
      rail: "var(--success)",
    }
  }

  if (sentiment === "Negative") {
    return {
      color: "var(--danger)",
      softBackground: "rgba(239, 35, 60, 0.12)",
      rail: "var(--danger)",
    }
  }

  return {
    color: "#ad8b00",
    softBackground: "rgba(241, 196, 15, 0.16)",
    rail: "var(--warning)",
  }
}

function getTrendMeta(currentValue, baselineValue, treatIncreaseAsGood = true) {
  if (baselineValue === null || baselineValue === undefined) {
    return {
      color: "var(--text-muted)",
      label: "Tracking 30s baseline...",
      Icon: Minus,
    }
  }

  const delta = currentValue - baselineValue

  if (delta === 0) {
    return {
      color: "var(--text-muted)",
      label: "No change from 30s ago",
      Icon: Minus,
    }
  }

  const percentChange =
    baselineValue === 0
      ? 100
      : Math.round((Math.abs(delta) / Math.abs(baselineValue)) * 100)

  const isIncrease = delta > 0
  const isPositiveTrend = treatIncreaseAsGood ? isIncrease : !isIncrease

  return {
    color: isPositiveTrend ? "var(--success)" : "var(--danger)",
    label: `${isIncrease ? "+" : "-"}${percentChange}% from 30s ago`,
    Icon: isIncrease ? TrendingUp : TrendingDown,
  }
}

function MetricCard({ icon: Icon, iconColor, label, value, trend }) {
  const TrendIcon = trend.Icon

  return (
    <div className="card" style={{ display: "flex", alignItems: "center", gap: "15px" }}>
      <Icon size={40} color={iconColor} />
      <div>
        <h3 style={{ margin: 0, color: "var(--text-muted)", fontSize: "14px" }}>{label}</h3>
        <h2 style={{ margin: "4px 0 0 0", fontSize: "28px" }}>{value}</h2>
        <p
          style={{
            margin: "6px 0 0 0",
            display: "flex",
            alignItems: "center",
            gap: "6px",
            fontSize: "13px",
            color: trend.color,
          }}
        >
          <TrendIcon size={14} />
          {trend.label}
        </p>
      </div>
    </div>
  )
}

export default function Analytics() {
  const [data, setData] = useState([])
  const [liveTweets, setLiveTweets] = useState([])
  const [velocityData, setVelocityData] = useState([])
  const [feedFilter, setFeedFilter] = useState(null)
  const [toasts, setToasts] = useState([])
  const [metricsSnapshot, setMetricsSnapshot] = useState(null)
  const [now, setNow] = useState(Date.now())

  const latestMetricsRef = useRef({ total: 0, positive: 0, negative: 0 })
  const toastTimersRef = useRef([])

  useEffect(() => {
    const handleInitialData = (payload) => {
      setData(payload.analyticsData || [])
      setLiveTweets(hydrateTweets(payload.liveTweets || []))
      setVelocityData(payload.velocityData || [])
    }

    const handleAnalytics = (newData) => {
      setData(newData)
    }

    const handleTweets = (newTweets) => {
      setLiveTweets((current) => hydrateTweets(newTweets, current))
    }

    const handleVelocity = (newVelocityData) => {
      setVelocityData(newVelocityData)
    }

    const handleCriticalAlert = (alert) => {
      const toastId = `${Date.now()}-${Math.random()}`
      const nextToast = { ...alert, id: toastId }

      setToasts((current) => [nextToast, ...current].slice(0, 3))

      const timerId = window.setTimeout(() => {
        setToasts((current) => current.filter((toast) => toast.id !== toastId))
      }, 5000)

      toastTimersRef.current.push(timerId)
    }

    socket.on("initial_data", handleInitialData)
    socket.on("new_analytics", handleAnalytics)
    socket.on("new_tweets", handleTweets)
    socket.on("velocity_update", handleVelocity)
    socket.on("critical_alert", handleCriticalAlert)

    return () => {
      socket.off("initial_data", handleInitialData)
      socket.off("new_analytics", handleAnalytics)
      socket.off("new_tweets", handleTweets)
      socket.off("velocity_update", handleVelocity)
      socket.off("critical_alert", handleCriticalAlert)
      toastTimersRef.current.forEach((timerId) => window.clearTimeout(timerId))
      toastTimersRef.current = []
    }
  }, [])

  let totalMentions = 0
  const sentimentCounts = { Positive: 0, Negative: 0, Neutral: 0 }
  const categoryMap = {}

  data.forEach((item) => {
    totalMentions += item.count
    if (sentimentCounts[item.sentiment] !== undefined) {
      sentimentCounts[item.sentiment] += item.count
    }
    categoryMap[item.category] = (categoryMap[item.category] || 0) + item.count
  })

  const currentMetrics = {
    total: totalMentions,
    positive: sentimentCounts.Positive,
    negative: sentimentCounts.Negative,
  }

  useEffect(() => {
    latestMetricsRef.current = currentMetrics
  }, [currentMetrics.total, currentMetrics.positive, currentMetrics.negative])

  useEffect(() => {
    const intervalId = window.setInterval(() => {
      setMetricsSnapshot({
        ...latestMetricsRef.current,
        capturedAt: Date.now(),
      })
    }, 30000)

    return () => window.clearInterval(intervalId)
  }, [])

  useEffect(() => {
    const intervalId = window.setInterval(() => {
      setNow(Date.now())
    }, 1000)

    return () => window.clearInterval(intervalId)
  }, [])

  const pieData = Object.keys(sentimentCounts)
    .map((key) => ({
      name: key,
      value: sentimentCounts[key],
    }))
    .filter((entry) => entry.value > 0)

  const barData = Object.keys(categoryMap).map((key) => ({
    name: key,
    count: categoryMap[key],
  }))

  const filteredTweets = feedFilter
    ? liveTweets.filter((tweet) =>
        feedFilter.type === "sentiment"
          ? tweet.sentiment === feedFilter.value
          : tweet.category === feedFilter.value
      )
    : liveTweets

  const visibleSentimentSummary = filteredTweets.reduce(
    (summary, tweet) => {
      if (tweet.sentiment === "Positive") summary.Positive += 1
      else if (tweet.sentiment === "Negative") summary.Negative += 1
      else summary.Neutral += 1
      return summary
    },
    { Positive: 0, Negative: 0, Neutral: 0 }
  )

  const totalTrend = getTrendMeta(currentMetrics.total, metricsSnapshot?.total, true)
  const positiveTrend = getTrendMeta(currentMetrics.positive, metricsSnapshot?.positive, true)
  const negativeTrend = getTrendMeta(currentMetrics.negative, metricsSnapshot?.negative, false)

  const handleSentimentDrillDown = (entry) => {
    const value = entry?.name || entry?.payload?.name
    if (value) {
      setFeedFilter({ type: "sentiment", value })
    }
  }

  const handleCategoryDrillDown = (entry) => {
    const value = entry?.name || entry?.payload?.name || entry?.activeLabel
    if (value) {
      setFeedFilter({ type: "category", value })
    }
  }

  return (
    <div style={{ position: "relative" }}>
      <div
        style={{
          position: "fixed",
          top: "24px",
          right: "24px",
          zIndex: 1000,
          display: "flex",
          flexDirection: "column",
          gap: "12px",
        }}
      >
        {toasts.map((toast) => (
          <div
            key={toast.id}
            style={{
              minWidth: "280px",
              maxWidth: "340px",
              background: "var(--card-bg)",
              borderLeft: "5px solid var(--danger)",
              borderRadius: "12px",
              boxShadow: "0 12px 24px rgba(0, 0, 0, 0.12)",
              padding: "14px 16px",
            }}
          >
            <p style={{ margin: 0, color: "var(--danger)", fontWeight: 700 }}>Critical Alert</p>
            <p style={{ margin: "6px 0 0 0", fontSize: "14px" }}>
              {toast.count} negative mentions in the last {toast.windowSeconds}s
            </p>
            <p style={{ margin: "6px 0 0 0", fontSize: "12px", color: "var(--text-muted)" }}>
              Moving average: {toast.movingAverage}/sec at {toast.triggeredAt}
            </p>
          </div>
        ))}
      </div>

      <div className="card" style={{ marginBottom: "24px" }}>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            gap: "12px",
            marginBottom: "12px",
          }}
        >
          <div>
            <h3 style={{ margin: 0 }}>Sentiment Velocity</h3>
            <p style={{ margin: "6px 0 0 0", color: "var(--text-muted)", fontSize: "14px" }}>
              Rolling 5-second buckets for positive vs. negative tweet volume
            </p>
          </div>
        </div>

        <ResponsiveContainer width="100%" height={280}>
          <LineChart data={velocityData} margin={{ top: 10, right: 20, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.08)" />
            <XAxis dataKey="time" />
            <YAxis allowDecimals={false} />
            <Tooltip />
            <Legend />
            <Line
              type="monotone"
              dataKey="positive"
              name="Positive"
              stroke={COLORS.Positive}
              strokeWidth={3}
              dot={false}
              activeDot={{ r: 5 }}
              isAnimationActive={false}
            />
            <Line
              type="monotone"
              dataKey="negative"
              name="Negative"
              stroke={COLORS.Negative}
              strokeWidth={3}
              dot={false}
              activeDot={{ r: 5 }}
              isAnimationActive={false}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
          gap: "20px",
          marginBottom: "30px",
        }}
      >
        <MetricCard
          icon={MessageSquare}
          iconColor="var(--accent)"
          label="Total Tweets Processed"
          value={totalMentions}
          trend={totalTrend}
        />
        <MetricCard
          icon={ThumbsUp}
          iconColor="var(--success)"
          label="Positive Vibes"
          value={sentimentCounts.Positive}
          trend={positiveTrend}
        />
        <MetricCard
          icon={AlertTriangle}
          iconColor="var(--danger)"
          label="Negative Mentions"
          value={sentimentCounts.Negative}
          trend={negativeTrend}
        />
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))",
          gap: "20px",
          marginBottom: "30px",
        }}
      >
        <div className="card">
          <h3 style={{ marginTop: 0 }}>Sentiment Breakdown</h3>
          <p style={{ marginTop: "-6px", color: "var(--text-muted)", fontSize: "13px" }}>
            Click a slice to filter the live feed.
          </p>
          <ResponsiveContainer width="100%" height={300}>
            <PieChart>
              <Pie
                data={pieData}
                cx="50%"
                cy="50%"
                innerRadius={60}
                outerRadius={100}
                dataKey="value"
                label
                onClick={handleSentimentDrillDown}
                style={{ cursor: "pointer" }}
              >
                {pieData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={COLORS[entry.name]} />
                ))}
              </Pie>
              <Tooltip />
              <Legend />
            </PieChart>
          </ResponsiveContainer>
        </div>

        <div className="card">
          <h3 style={{ marginTop: 0 }}>Issue Categories</h3>
          <p style={{ marginTop: "-6px", color: "var(--text-muted)", fontSize: "13px" }}>
            Click a bar to drill into matching tweets.
          </p>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={barData}>
              <XAxis dataKey="name" />
              <YAxis allowDecimals={false} />
              <Tooltip cursor={{ fill: "rgba(0,0,0,0.05)" }} />
              <Bar
                dataKey="count"
                fill="var(--accent)"
                radius={[4, 4, 0, 0]}
                onClick={handleCategoryDrillDown}
                style={{ cursor: "pointer" }}
              />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="card">
        <div
          style={{
            position: "sticky",
            top: 0,
            zIndex: 2,
            display: "flex",
            justifyContent: "space-between",
            alignItems: "flex-start",
            gap: "16px",
            marginBottom: "18px",
            flexWrap: "wrap",
            paddingBottom: "14px",
            borderBottom: "1px solid rgba(0, 0, 0, 0.08)",
            background: "var(--card-bg)",
          }}
        >
          <div>
            <h3 style={{ marginTop: 0, marginBottom: "6px", display: "flex", alignItems: "center", gap: "8px" }}>
              <Activity size={20} color="var(--accent)" /> Live Tweet Feed
            </h3>
            <p style={{ margin: 0, color: "var(--text-muted)", fontSize: "13px" }}>
              {feedFilter
                ? `Filtered by ${feedFilter.type}: ${feedFilter.value}`
                : "Showing the latest tweet stream from the backend."}
            </p>
          </div>

          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "10px",
              flexWrap: "wrap",
              justifyContent: "flex-end",
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: "8px",
                padding: "8px 12px",
                borderRadius: "999px",
                background: "rgba(67, 97, 238, 0.08)",
                color: "var(--accent)",
                fontSize: "12px",
                fontWeight: 700,
              }}
            >
              <span
                style={{
                  width: "8px",
                  height: "8px",
                  borderRadius: "999px",
                  background: "var(--accent)",
                  boxShadow: "0 0 0 4px rgba(67, 97, 238, 0.14)",
                }}
              />
              Live stream
            </div>

            {feedFilter && (
              <div
                style={{
                  padding: "8px 12px",
                  borderRadius: "999px",
                  background: "rgba(0, 0, 0, 0.05)",
                  fontSize: "12px",
                  fontWeight: 600,
                }}
              >
                {feedFilter.type}: {feedFilter.value}
              </div>
            )}

            {feedFilter && (
              <button
                type="button"
                onClick={() => setFeedFilter(null)}
                style={{
                  border: "none",
                  background: "var(--accent)",
                  color: "#fff",
                  borderRadius: "8px",
                  padding: "10px 14px",
                  fontWeight: 600,
                  cursor: "pointer",
                }}
              >
                Clear Filter
              </button>
            )}
          </div>
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))",
            gap: "12px",
            marginBottom: "18px",
          }}
        >
          <div
            style={{
              padding: "14px 16px",
              borderRadius: "12px",
              background: "linear-gradient(135deg, rgba(67, 97, 238, 0.08), rgba(67, 97, 238, 0.02))",
              border: "1px solid rgba(67, 97, 238, 0.08)",
            }}
          >
            <p style={{ margin: 0, color: "var(--text-muted)", fontSize: "12px", textTransform: "uppercase", letterSpacing: "0.06em" }}>
              Visible Tweets
            </p>
            <p style={{ margin: "8px 0 0 0", fontSize: "28px", fontWeight: 700 }}>{filteredTweets.length}</p>
          </div>
          <div
            style={{
              padding: "14px 16px",
              borderRadius: "12px",
              background: "rgba(46, 204, 113, 0.08)",
              border: "1px solid rgba(46, 204, 113, 0.12)",
            }}
          >
            <p style={{ margin: 0, color: "var(--text-muted)", fontSize: "12px", textTransform: "uppercase", letterSpacing: "0.06em" }}>
              Positive
            </p>
            <p style={{ margin: "8px 0 0 0", fontSize: "28px", fontWeight: 700, color: "var(--success)" }}>
              {visibleSentimentSummary.Positive}
            </p>
          </div>
          <div
            style={{
              padding: "14px 16px",
              borderRadius: "12px",
              background: "rgba(239, 35, 60, 0.08)",
              border: "1px solid rgba(239, 35, 60, 0.12)",
            }}
          >
            <p style={{ margin: 0, color: "var(--text-muted)", fontSize: "12px", textTransform: "uppercase", letterSpacing: "0.06em" }}>
              Negative
            </p>
            <p style={{ margin: "8px 0 0 0", fontSize: "28px", fontWeight: 700, color: "var(--danger)" }}>
              {visibleSentimentSummary.Negative}
            </p>
          </div>
          <div
            style={{
              padding: "14px 16px",
              borderRadius: "12px",
              background: "rgba(241, 196, 15, 0.10)",
              border: "1px solid rgba(241, 196, 15, 0.16)",
            }}
          >
            <p style={{ margin: 0, color: "var(--text-muted)", fontSize: "12px", textTransform: "uppercase", letterSpacing: "0.06em" }}>
              Neutral
            </p>
            <p style={{ margin: "8px 0 0 0", fontSize: "28px", fontWeight: 700, color: "#ad8b00" }}>
              {visibleSentimentSummary.Neutral}
            </p>
          </div>
        </div>

        <div className="live-feed-scroll">
          {filteredTweets.length === 0 ? (
            <p style={{ color: "var(--text-muted)" }}>
              {feedFilter ? "No tweets match the current filter." : "Waiting for tweets..."}
            </p>
          ) : (
            filteredTweets.map((tweet, index) => (
              (() => {
                const sentimentUi = getSentimentPresentation(tweet.sentiment)
                const isFresh = now - (tweet.receivedAt || now) < 12000

                return (
                  <div
                    key={tweet.feedId || `${tweet.text}-${index}`}
                    className={`feed-tweet-card${isFresh ? " is-fresh" : ""}`}
                    style={{
                      gridTemplateColumns: "6px 1fr",
                    }}
                  >
                    <div style={{ background: sentimentUi.rail }} />
                    <div
                      className="feed-tweet-body"
                      style={{
                        padding: "14px 16px",
                        background: isFresh
                          ? "linear-gradient(180deg, rgba(67, 97, 238, 0.04), rgba(255, 255, 255, 1))"
                          : "#fff",
                      }}
                    >
                      <div
                        style={{
                          display: "flex",
                          justifyContent: "space-between",
                          alignItems: "flex-start",
                          gap: "10px",
                          marginBottom: "10px",
                          flexWrap: "wrap",
                        }}
                      >
                        <div style={{ display: "flex", gap: "8px", flexWrap: "wrap", alignItems: "center" }}>
                          <span
                            style={{
                              padding: "6px 10px",
                              borderRadius: "999px",
                              background: sentimentUi.softBackground,
                              color: sentimentUi.color,
                              fontSize: "12px",
                              fontWeight: 700,
                            }}
                          >
                            {tweet.sentiment}
                          </span>
                          <span
                            style={{
                              padding: "6px 10px",
                              borderRadius: "999px",
                              background: "rgba(0, 0, 0, 0.05)",
                              color: "var(--text-main)",
                              fontSize: "12px",
                              fontWeight: 600,
                            }}
                          >
                            {tweet.category}
                          </span>
                          {isFresh && (
                            <span
                              style={{
                                padding: "6px 10px",
                                borderRadius: "999px",
                                background: "rgba(67, 97, 238, 0.08)",
                                color: "var(--accent)",
                                fontSize: "11px",
                                fontWeight: 700,
                                letterSpacing: "0.03em",
                              }}
                            >
                              NEW
                            </span>
                          )}
                        </div>

                        <span
                          style={{
                            fontSize: "12px",
                            color: "var(--text-muted)",
                            whiteSpace: "nowrap",
                            fontVariantNumeric: "tabular-nums",
                          }}
                        >
                          {formatRelativeTime(tweet.receivedAt || now, now)}
                        </span>
                      </div>

                      <p
                        style={{
                          margin: 0,
                          fontSize: "15px",
                          lineHeight: 1.55,
                          color: "var(--text-main)",
                          wordBreak: "break-word",
                        }}
                      >
                        {tweet.text}
                      </p>
                    </div>
                  </div>
                )
              })()
            ))
          )}
        </div>
      </div>
    </div>
  )
}

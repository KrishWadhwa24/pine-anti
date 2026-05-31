package config

import (
	"os"
	"strconv"
	"time"

	"github.com/joho/godotenv"
)

type Config struct {
	// Server
	ServerPort string
	LogLevel   string

	// Auth
	AuthUsername string
	AuthPassword string

	// MongoDB
	MongoURI      string
	MongoDatabase string

	// Redis
	RedisAddr     string
	RedisPassword string
	RedisDB       int

	// Angel One SmartAPI
	AngelAPIKey     string
	AngelClientID   string
	AngelPassword   string
	AngelTOTPSecret string

	// Telegram defaults
	TelegramBotToken string
	TelegramChatID   string

	// Encryption
	EncryptionKey string

	// TTL Policies
	TTLDedupCache   time.Duration
	TTLActiveCandle time.Duration
	TTLRecoveryBuf  time.Duration
	TTLWSSession    time.Duration
	TTLReplayState  time.Duration

	// Strategy Parameters
	BreakoutLookback int
	VolumeMultiplier float64
	CooldownBars     int

	// Warmup Sizes
	Warmup1H int
	Warmup4H int
	Warmup1D int
	Warmup1W int
	Warmup1M int
}

func Load() (*Config, error) {
	_ = godotenv.Load()

	cfg := &Config{
		ServerPort:    getEnv("SERVER_PORT", "8080"),
		LogLevel:      getEnv("LOG_LEVEL", "info"),
		AuthUsername:  getEnv("AUTH_USERNAME", "admin"),
		AuthPassword:  getEnv("AUTH_PASSWORD", "tradenexus2026"),
		MongoURI:      getEnv("MONGO_URI", "mongodb://127.0.0.1:27017"),
		MongoDatabase: getEnv("MONGO_DATABASE", "tradenexus"),
		RedisAddr:     getEnv("REDIS_ADDR", "127.0.0.1:6380"),
		RedisPassword: getEnv("REDIS_PASSWORD", ""),
		RedisDB:       getEnvInt("REDIS_DB", 0),

		AngelAPIKey:     getEnv("ANGEL_API_KEY", ""),
		AngelClientID:   getEnv("ANGEL_CLIENT_ID", ""),
		AngelPassword:   getEnv("ANGEL_PASSWORD", ""),
		AngelTOTPSecret: getEnv("ANGEL_TOTP_SECRET", ""),

		TelegramBotToken: getEnv("TELEGRAM_BOT_TOKEN", "8699224532:AAGFJNSOXzV7Re_jb0PQIJnCCkLRj3eqYv4"),
		TelegramChatID:   getEnv("TELEGRAM_CHAT_ID", "-1004021403860"),

		EncryptionKey: getEnv("ENCRYPTION_KEY", ""),

		TTLDedupCache:   time.Duration(getEnvInt("TTL_DEDUP_CACHE", 172800)) * time.Second,
		TTLActiveCandle: time.Duration(getEnvInt("TTL_ACTIVE_CANDLE", 7200)) * time.Second,
		TTLRecoveryBuf:  time.Duration(getEnvInt("TTL_RECOVERY_BUFFER", 86400)) * time.Second,
		TTLWSSession:    time.Duration(getEnvInt("TTL_WS_SESSION", 1800)) * time.Second,
		TTLReplayState:  time.Duration(getEnvInt("TTL_REPLAY_STATE", 3600)) * time.Second,

		BreakoutLookback: getEnvInt("STRATEGY_BREAKOUT_LOOKBACK", 20),
		VolumeMultiplier: getEnvFloat("STRATEGY_VOLUME_MULTIPLIER", 1.8),
		CooldownBars:     getEnvInt("STRATEGY_COOLDOWN_BARS", 12),

		Warmup1H: getEnvInt("WARMUP_1H", 500),
		Warmup4H: getEnvInt("WARMUP_4H", 300),
		Warmup1D: getEnvInt("WARMUP_1D", 250),
		Warmup1W: getEnvInt("WARMUP_1W", 120),
		Warmup1M: getEnvInt("WARMUP_1M", 60),
	}

	return cfg, nil
}

func getEnv(key, fallback string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return fallback
}

func getEnvInt(key string, fallback int) int {
	if v := os.Getenv(key); v != "" {
		if i, err := strconv.Atoi(v); err == nil {
			return i
		}
	}
	return fallback
}

func getEnvFloat(key string, fallback float64) float64 {
	if v := os.Getenv(key); v != "" {
		if f, err := strconv.ParseFloat(v, 64); err == nil {
			return f
		}
	}
	return fallback
}

package main

import (
	"context"
	"flag"
	"log/slog"
	"net/http"
	"os"
	"os/signal"
	"strconv"
	"syscall"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/go-chi/chi/v5/middleware"
)

func loadConfig() *Config {
	c := &Config{}

	// Server
	c.Server.Addr = getenv("SERVER_ADDR", ":8080")
	c.Server.ReadTimeout = getDurationEnv("SERVER_READ_TIMEOUT", 60*time.Second)
	c.Server.IdleTimeout = getDurationEnv("SERVER_IDLE_TIMEOUT", 120*time.Second)

	// Database
	c.Database.URL = getenv("DATABASE_URL", "postgres://stylemirror:stylemirror@localhost:5432/stylemirror?sslmode=disable")

	// DashScope
	c.DashScope.APIKey = os.Getenv("DASHSCOPE_API_KEY") // Must be set
	c.DashScope.BaseURL = getenv("DASHSCOPE_BASE_URL", "https://dashscope.aliyuncs.com")
	c.DashScope.Model = getenv("DASHSCOPE_MODEL", "qwen-image-edit-plus-2025-12-15")
	c.DashScope.Timeout = getDurationEnv("DASHSCOPE_TIMEOUT", 90*time.Second)

	// CORS (comma-separated list)
	c.CORS.AllowedOrigins = getSliceEnv("CORS_ALLOWED_ORIGINS", []string{"http://localhost:5173", "http://localhost:4173"})

	// Limits
	c.Limits.MaxUploadBytes = getInt64Env("MAX_UPLOAD_BYTES", 10485760) // 10MB

	// Admin
	c.AdminAPIKey = getenv("ADMIN_API_KEY", "dev_admin_key")

	return c
}

func getenv(key, fallback string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return fallback
}

func getDurationEnv(key string, fallback time.Duration) time.Duration {
	if v := os.Getenv(key); v != "" {
		if d, err := time.ParseDuration(v); err == nil {
			return d
		}
	}
	return fallback
}

func getInt64Env(key string, fallback int64) int64 {
	if v := os.Getenv(key); v != "" {
		if i, err := strconv.ParseInt(v, 10, 64); err == nil {
			return i
		}
	}
	return fallback
}

func getSliceEnv(key string, fallback []string) []string {
	v := os.Getenv(key)
	if v == "" {
		return fallback
	}
	// Simple comma-separated parser
	var out []string
	for _, s := range splitComma(v) {
		if s != "" {
			out = append(out, s)
		}
	}
	if len(out) == 0 {
		return fallback
	}
	return out
}

func splitComma(s string) []string {
	// Basic split, can use strings.Split but keeping it simple here
	var out []string
	var current string
	for _, r := range s {
		if r == ',' {
			out = append(out, current)
			current = ""
		} else {
			current += string(r)
		}
	}
	if current != "" {
		out = append(out, current)
	}
	return out
}

func main() {
	// Keep the flag just so `-config` doesn't break old run scripts, but ignore it
	_ = flag.String("config", "", "ignored, config is loaded from env")
	flag.Parse()

	cfg := loadConfig()

	slog.SetDefault(slog.New(slog.NewTextHandler(os.Stdout, &slog.HandlerOptions{Level: slog.LevelInfo})))

	store, err := NewPostgresStore(context.Background(), cfg.Database.URL)
	if err != nil {
		slog.Error("postgres connect failed", "err", err)
		os.Exit(1)
	}
	defer store.Close()

	var preprocessor Preprocessor = &NoOpPreprocessor{}

	svc := &Service{
		Cfg:          cfg,
		Store:        store,
		DashScope:    NewDashScopeClient(cfg),
		Preprocessor: preprocessor,
	}

	r := chi.NewRouter()
	r.Use(middleware.RequestID)
	r.Use(middleware.RealIP)
	r.Use(svc.DynamicCORSMiddleware)
	r.Use(middleware.Recoverer)
	r.Use(middleware.Timeout(120 * time.Second))

	r.Get("/healthz", func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
		_, _ = w.Write([]byte("ok"))
	})

	// Admin Routes
	r.Route("/api/admin", func(r chi.Router) {
		r.Use(svc.AdminAuthMiddleware)
		r.Post("/partners", svc.handleAdminCreatePartner)
		r.Get("/partners", svc.handleAdminGetPartners)
		r.Delete("/partners/{id}", svc.handleAdminDeletePartner)
		r.Get("/logs", svc.handleAdminGetUsageLogs)
	})

	// Partner / Public Routes
	r.Route("/api", func(r chi.Router) {
		r.Use(svc.PartnerAuthMiddleware)
		r.Post("/tryon", svc.handleSubmit)
		r.Get("/tryon/{id}", svc.handleStatus)
		r.Get("/usage", svc.handleUsage)
		r.Get("/logs", svc.handlePartnerLogs)
	})

	srv := &http.Server{
		Addr:        cfg.Server.Addr,
		Handler:     r,
		ReadTimeout: cfg.Server.ReadTimeout,
		IdleTimeout: cfg.Server.IdleTimeout,
	}

	go func() {
		slog.Info("StyleMirror API listening", "addr", cfg.Server.Addr)
		if err := srv.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			slog.Error("server died", "err", err)
			os.Exit(1)
		}
	}()

	stop := make(chan os.Signal, 1)
	signal.Notify(stop, os.Interrupt, syscall.SIGTERM)
	<-stop
	slog.Info("shutting down")
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()
	_ = srv.Shutdown(ctx)
}

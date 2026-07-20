package main

import (
	"context"
	"flag"
	"log/slog"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/go-chi/chi/v5/middleware"
	"github.com/go-chi/cors"
	"gopkg.in/yaml.v3"
)

type Config struct {
	Server struct {
		Addr        string        `yaml:"addr"`
		ReadTimeout time.Duration `yaml:"read_timeout"`
		IdleTimeout time.Duration `yaml:"idle_timeout"`
	} `yaml:"server"`
	Redis struct {
		Addr     string `yaml:"addr"`
		Password string `yaml:"password"`
		DB       int    `yaml:"db"`
	} `yaml:"redis"`
	DashScope struct {
		APIKey  string        `yaml:"api_key"`
		BaseURL string        `yaml:"base_url"`
		Model   string        `yaml:"model"`
		Timeout time.Duration `yaml:"timeout"`
	} `yaml:"dashscope"`
	CORS struct {
		AllowedOrigins []string `yaml:"allowed_origins"`
	} `yaml:"cors"`
	Limits struct {
		RequestsPerHour int   `yaml:"requests_per_hour"`
		EstimatedSec    int   `yaml:"estimated_seconds"`
		MaxUploadBytes  int64 `yaml:"max_upload_bytes"`
	} `yaml:"limits"`
}

func loadConfig(path string) (*Config, error) {
	b, err := os.ReadFile(path)
	if err != nil {
		return nil, err
	}
	var c Config
	if err := yaml.Unmarshal(b, &c); err != nil {
		return nil, err
	}
	if k := os.Getenv("DASHSCOPE_API_KEY"); k != "" {
		c.DashScope.APIKey = k
	}
	if a := os.Getenv("REDIS_ADDR"); a != "" {
		c.Redis.Addr = a
	}
	if c.DashScope.BaseURL == "" {
		c.DashScope.BaseURL = "https://dashscope.aliyuncs.com"
	}
	if c.DashScope.Model == "" {
		c.DashScope.Model = "qwen-image-edit"
	}
	if c.DashScope.Timeout == 0 {
		c.DashScope.Timeout = 90 * time.Second
	}
	if c.Server.Addr == "" {
		c.Server.Addr = ":8080"
	}
	if c.Limits.RequestsPerHour == 0 {
		c.Limits.RequestsPerHour = 20
	}
	if c.Limits.EstimatedSec == 0 {
		c.Limits.EstimatedSec = 15
	}
	if c.Limits.MaxUploadBytes == 0 {
		c.Limits.MaxUploadBytes = 5 << 20
	}
	return &c, nil
}

func main() {
	cfgPath := flag.String("config", "config.yaml", "path to config")
	flag.Parse()

	cfg, err := loadConfig(*cfgPath)
	if err != nil {
		slog.Error("config load failed", "err", err)
		os.Exit(1)
	}

	slog.SetDefault(slog.New(slog.NewTextHandler(os.Stdout, &slog.HandlerOptions{Level: slog.LevelInfo})))

	store, err := NewRedisStore(cfg)
	if err != nil {
		slog.Error("redis connect failed", "err", err)
		os.Exit(1)
	}
	defer store.Close()

	// Extension point — no-op for v1. See preprocessor.go.
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
	r.Use(middleware.Recoverer)
	r.Use(middleware.Timeout(120 * time.Second))
	r.Use(cors.Handler(cors.Options{
		AllowedOrigins:   cfg.CORS.AllowedOrigins,
		AllowedMethods:   []string{"GET", "POST", "OPTIONS"},
		AllowedHeaders:   []string{"Accept", "Authorization", "Content-Type", "X-Client-Id"},
		ExposedHeaders:   []string{"X-Task-Id"},
		AllowCredentials: false,
		MaxAge:           300,
	}))

	r.Get("/healthz", func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
		_, _ = w.Write([]byte("ok"))
	})

	r.Route("/api", func(r chi.Router) {
		r.Use(ClientIDMiddleware)
		r.Post("/tryon", svc.handleSubmit)
		r.Get("/tryon/{id}", svc.handleStatus)
		r.Get("/usage", svc.handleUsage)
		r.Post("/upload", svc.handleUpload)
		r.Get("/uploads/{id}", svc.serveUpload)
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

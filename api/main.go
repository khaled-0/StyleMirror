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
	"gopkg.in/yaml.v3"
)

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
	if c.DashScope.BaseURL == "" {
		c.DashScope.BaseURL = "https://dashscope-intl.aliyuncs.com"
	}
	if c.DashScope.Model == "" {
		c.DashScope.Model = "qwen-image-edit-plus"
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

	if k := os.Getenv("ADMIN_API_KEY"); k != "" {
		c.AdminAPIKey = k
	}
	if c.AdminAPIKey == "" {
		c.AdminAPIKey = "dev_admin_key"
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

	loadedConfig, _ := yaml.Marshal(cfg)
	print(string(loadedConfig))

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
	r.Use(middleware.Recoverer)
	r.Use(middleware.Timeout(120 * time.Second))
	r.Use(svc.DynamicCORSMiddleware)

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
		// Custom middleware handles CORS and Auth
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

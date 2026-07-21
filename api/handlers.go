package main

import (
	"context"
	"encoding/json"
	"errors"
	"log/slog"
	"net/http"
	"net/url"
	"strings"
	"time"

	"github.com/go-chi/chi/v5"
)

type Service struct {
	Cfg          *Config
	Store        *RedisStore
	DashScope    *DashScopeClient
	Preprocessor Preprocessor
}

func (s *Service) handleSubmit(w http.ResponseWriter, r *http.Request) {
	cid := clientIDFromCtx(r.Context())

	count, _, err := s.Store.Usage(r.Context(), cid)
	if err != nil {
		slog.Warn("usage lookup failed", "err", err)
	}
	if count >= s.Cfg.Limits.RequestsPerHour {
		writeJSON(w, http.StatusTooManyRequests, map[string]any{
			"error":           "rate limit exceeded",
			"retry_after_sec": 3600,
		})
		return
	}

	var req SubmitRequest
	if err := json.NewDecoder(http.MaxBytesReader(w, r.Body, s.Cfg.Limits.MaxUploadBytes)).Decode(&req); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]any{"error": "invalid json: " + err.Error()})
		return
	}
	if err := validateImageRef(req.GarmentURL); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]any{"error": "garment_url: " + err.Error()})
		return
	}
	if err := validateImageRef(req.BodyURL); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]any{"error": "body_url: " + err.Error()})
		return
	}

	id := newTaskID()
	task := &Task{
		ID:           id,
		Status:       StatusQueued,
		GarmentURL:   req.GarmentURL,
		BodyURL:      req.BodyURL,
		CreatedAt:    time.Now(),
		EstimatedSec: s.Cfg.Limits.EstimatedSec,
	}
	if err := s.Store.SaveTask(r.Context(), task); err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]any{"error": "store failed"})
		return
	}

	if _, err := s.Store.IncrementUsage(r.Context(), cid, time.Hour); err != nil {
		slog.Warn("usage increment failed", "err", err)
	}

	go s.runTask(id, req)

	writeJSON(w, http.StatusAccepted, SubmitResponse{
		TaskID:       id,
		Status:       string(StatusQueued),
		EstimatedSec: s.Cfg.Limits.EstimatedSec,
	})
}

func (s *Service) runTask(id string, req SubmitRequest) {
	ctx, cancel := context.WithTimeout(context.Background(), s.Cfg.DashScope.Timeout+15*time.Second)
	defer cancel()

	running := &Task{
		ID: id, Status: StatusRunning, EstimatedSec: s.Cfg.Limits.EstimatedSec,
		GarmentURL: req.GarmentURL, BodyURL: req.BodyURL, CreatedAt: time.Now(),
	}
	if err := s.Store.SaveTask(ctx, running); err != nil {
		slog.Error("save running task failed", "id", id, "err", err)
		return
	}

	// --- Extension point ---
	garmentURL, bodyURL, _, err := s.Preprocessor.Preprocess(ctx, req.GarmentURL, req.BodyURL)
	if err != nil {
		s.failTask(ctx, id, "preprocessor: "+err.Error())
		return
	}

	resultURL, err := s.DashScope.Edit(ctx, garmentURL, bodyURL, req.GarmentPrompt)
	if err != nil {
		s.failTask(ctx, id, "dashscope: "+err.Error())
		return
	}

	done := &Task{
		ID: id, Status: StatusSucceeded, ResultURL: resultURL,
		GarmentURL: req.GarmentURL, BodyURL: req.BodyURL,
		EstimatedSec: s.Cfg.Limits.EstimatedSec, CreatedAt: time.Now(),
	}
	if err := s.Store.SaveTask(ctx, done); err != nil {
		slog.Error("save done task failed", "id", id, "err", err)
	}
}

func (s *Service) failTask(ctx context.Context, id, msg string) {
	slog.Warn("task failed", "id", id, "err", msg)
	t := &Task{ID: id, Status: StatusFailed, Error: msg, CreatedAt: time.Now()}
	_ = s.Store.SaveTask(ctx, t)
}

func (s *Service) handleStatus(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")
	if id == "" {
		writeJSON(w, http.StatusBadRequest, map[string]any{"error": "missing id"})
		return
	}
	t, err := s.Store.GetTask(r.Context(), id)
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]any{"error": "store error"})
		return
	}
	if t == nil {
		writeJSON(w, http.StatusNotFound, map[string]any{"error": "task not found"})
		return
	}
	pollAfter := 1500
	if t.Status == StatusSucceeded || t.Status == StatusFailed {
		pollAfter = 0
	}
	writeJSON(w, http.StatusOK, StatusResponse{Task: *t, PollAfterMs: pollAfter})
}

func (s *Service) handleUsage(w http.ResponseWriter, r *http.Request) {
	cid := clientIDFromCtx(r.Context())
	count, ttl, err := s.Store.Usage(r.Context(), cid)
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]any{"error": "store error"})
		return
	}
	if ttl < 0 {
		ttl = 0
	}
	writeJSON(w, http.StatusOK, UsageResponse{
		ClientID: cid, Used: count, Limit: s.Cfg.Limits.RequestsPerHour,
		WindowSec: 3600, ResetAtUnix: time.Now().Add(ttl).Unix(),
	})
}

func writeJSON(w http.ResponseWriter, code int, v any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(code)
	_ = json.NewEncoder(w).Encode(v)
}

func validateImageRef(s string) error {
	if s == "" {
		return errors.New("required")
	}
	if strings.HasPrefix(s, "data:image/") {
		return nil // data URI — accepted as-is
	}
	u, err := url.Parse(s)
	if err != nil {
		return err
	}
	if u.Scheme != "http" && u.Scheme != "https" {
		return errors.New("scheme must be http/https")
	}
	if u.Host == "" {
		return errors.New("missing host")
	}
	return nil
}

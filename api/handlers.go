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
	"github.com/google/uuid"
)

type Service struct {
	Cfg          *Config
	Store        *PostgresStore
	DashScope    *DashScopeClient
	Preprocessor Preprocessor
}

func (s *Service) handleAdminCreatePartner(w http.ResponseWriter, r *http.Request) {
	var req CreatePartnerRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid json"})
		return
	}
	if req.DailyLimit == 0 {
		req.DailyLimit = 20
	}
	p, err := s.Store.CreatePartner(r.Context(), req.Name, req.AllowedOrigin, req.DailyLimit)
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "failed to create partner"})
		return
	}
	writeJSON(w, http.StatusCreated, p)
}

func (s *Service) handleAdminGetPartners(w http.ResponseWriter, r *http.Request) {
	partners, err := s.Store.GetAllPartners(r.Context())
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "db error"})
		return
	}
	writeJSON(w, http.StatusOK, partners)
}

func (s *Service) handleSubmit(w http.ResponseWriter, r *http.Request) {
	partner := partnerFromCtx(r.Context())
	if partner == nil {
		http.Error(w, `{"error": "unauthorized"}`, http.StatusUnauthorized)
		return
	}

	used, limit, err := s.Store.GetPartnerUsage(r.Context(), partner.ID)
	if err == nil && used >= limit {
		writeJSON(w, http.StatusTooManyRequests, map[string]string{"error": "daily limit exceeded"})
		return
	}

	var req SubmitRequest
	if err := json.NewDecoder(http.MaxBytesReader(w, r.Body, s.Cfg.Limits.MaxUploadBytes)).Decode(&req); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid json or payload too large"})
		return
	}
	if err := validateImageRef(req.GarmentURL); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "garment_url: " + err.Error()})
		return
	}
	if err := validateImageRef(req.BodyURL); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "body_url: " + err.Error()})
		return
	}

	id := uuid.New().String()
	task := &Task{
		ID:        id,
		PartnerID: partner.ID,
		Status:    StatusQueued,
		CreatedAt: time.Now(),
	}
	if err := s.Store.SaveTask(r.Context(), task); err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "store failed"})
		return
	}

	_ = s.Store.LogUsage(r.Context(), partner.ID, id)
	go s.runTask(partner.ID, id, req)

	writeJSON(w, http.StatusAccepted, SubmitResponse{TaskID: id, Status: string(StatusQueued)})
}

func (s *Service) runTask(partnerID, id string, req SubmitRequest) {
	ctx, cancel := context.WithTimeout(context.Background(), s.Cfg.DashScope.Timeout+15*time.Second)
	defer cancel()

	running := &Task{ID: id, PartnerID: partnerID, Status: StatusRunning}
	_ = s.Store.SaveTask(ctx, running)

	garmentURL, bodyURL, _, err := s.Preprocessor.Preprocess(ctx, req.GarmentURL, req.BodyURL)
	if err != nil {
		s.failTask(ctx, partnerID, id, "preprocessor: "+err.Error())
		return
	}

	resultURL, err := s.DashScope.Edit(ctx, garmentURL, bodyURL, req.GarmentPrompt)
	if err != nil {
		s.failTask(ctx, partnerID, id, "dashscope: "+err.Error())
		return
	}

	done := &Task{ID: id, PartnerID: partnerID, Status: StatusSucceeded, ResultURL: resultURL}
	_ = s.Store.SaveTask(ctx, done)
}

func (s *Service) failTask(ctx context.Context, partnerID, id, msg string) {
	slog.Warn("task failed", "id", id, "err", msg)
	t := &Task{ID: id, PartnerID: partnerID, Status: StatusFailed, Error: msg}
	_ = s.Store.SaveTask(ctx, t)
}

func (s *Service) handleStatus(w http.ResponseWriter, r *http.Request) {
	partner := partnerFromCtx(r.Context())
	id := chi.URLParam(r, "id")

	t, err := s.Store.GetTask(r.Context(), id)
	if err != nil || t.PartnerID != partner.ID {
		writeJSON(w, http.StatusNotFound, map[string]string{"error": "task not found"})
		return
	}
	writeJSON(w, http.StatusOK, t)
}

func (s *Service) handleUsage(w http.ResponseWriter, r *http.Request) {
	partner := partnerFromCtx(r.Context())
	used, limit, err := s.Store.GetPartnerUsage(r.Context(), partner.ID)
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "db error"})
		return
	}
	writeJSON(w, http.StatusOK, UsageResponse{UsedToday: used, Limit: limit})
}

func writeJSON(w http.ResponseWriter, code int, v any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(code)
	enc := json.NewEncoder(w)
	enc.SetEscapeHTML(false)
	_ = enc.Encode(v)
}

func validateImageRef(s string) error {
	if s == "" {
		return errors.New("required")
	}
	if strings.HasPrefix(s, "data:image/") {
		return nil
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

func (s *Service) handleAdminDeletePartner(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")
	if id == "" {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "missing id"})
		return
	}

	if err := s.Store.DeletePartner(r.Context(), id); err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "failed to delete partner"})
		return
	}

	writeJSON(w, http.StatusOK, map[string]string{"status": "deleted"})
}

func (s *Service) handleAdminGetUsageLogs(w http.ResponseWriter, r *http.Request) {
	logs, err := s.Store.GetUsageLogs(r.Context(), 50) // Get last 50 logs
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "failed to fetch logs"})
		return
	}
	writeJSON(w, http.StatusOK, logs)
}

func (s *Service) handlePartnerLogs(w http.ResponseWriter, r *http.Request) {
	partner := partnerFromCtx(r.Context())
	if partner == nil {
		http.Error(w, `{"error": "unauthorized"}`, http.StatusUnauthorized)
		return
	}

	logs, err := s.Store.GetPartnerUsageLogs(r.Context(), partner.ID, 20) // Get last 20 logs
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "failed to fetch logs"})
		return
	}
	writeJSON(w, http.StatusOK, logs)
}

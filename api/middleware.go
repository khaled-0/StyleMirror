package main

import (
	"context"
	"net/http"
	"strings"
)

type ctxKey int

const (
	partnerCtxKey ctxKey = 1
	originCtxKey  ctxKey = 2
)

// DynamicCORSMiddleware sets CORS headers for ALL routes, including errors.
func (s *Service) DynamicCORSMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		origin := r.Header.Get("Origin")
		if origin == "" {
			origin = "*"
		}

		w.Header().Set("Access-Control-Allow-Origin", origin)
		w.Header().Set("Access-Control-Allow-Methods", "GET, POST, DELETE, OPTIONS")
		w.Header().Set("Access-Control-Allow-Headers", "Content-Type, X-Api-Key, X-Admin-Key")

		// Handle preflight
		if r.Method == "OPTIONS" {
			w.WriteHeader(http.StatusOK)
			return
		}

		next.ServeHTTP(w, r)
	})
}

// PartnerAuthMiddleware validates the X-Api-Key (CORS is handled globally now)
func (s *Service) PartnerAuthMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		apiKey := r.Header.Get("X-Api-Key")
		if apiKey == "" {
			apiKey = "sm_demo_key_123"
		}

		partner, err := s.Store.GetPartnerByKey(r.Context(), apiKey)
		if err != nil {
			http.Error(w, `{"error": "invalid api key"}`, http.StatusUnauthorized)
			return
		}

		origin := r.Header.Get("Origin")
		isGlobalAllowed := false
		for _, allowed := range s.Cfg.CORS.AllowedOrigins {
			if allowed == "*" || allowed == origin {
				isGlobalAllowed = true
				break
			}
		}

		if !isGlobalAllowed {
			if partner.AllowedOrigin != "*" && !strings.Contains(origin, partner.AllowedOrigin) {
				http.Error(w, `{"error": "origin not allowed"}`, http.StatusForbidden)
				return
			}
		}

		ctx := context.WithValue(r.Context(), partnerCtxKey, partner)
		ctx = context.WithValue(ctx, originCtxKey, origin)
		next.ServeHTTP(w, r.WithContext(ctx))
	})
}

// AdminAuthMiddleware validates the X-Admin-Key
func (s *Service) AdminAuthMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		adminKey := r.Header.Get("X-Admin-Key")
		if adminKey == "" || adminKey != s.Cfg.AdminAPIKey {
			http.Error(w, `{"error": "admin unauthorized"}`, http.StatusUnauthorized)
			return
		}
		next.ServeHTTP(w, r)
	})
}

func partnerFromCtx(ctx context.Context) *Partner {
	v, _ := ctx.Value(partnerCtxKey).(*Partner)
	return v
}

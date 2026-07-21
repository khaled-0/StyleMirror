package main

import (
	"context"
	"net/http"
)

type ctxKey int

const (
	partnerCtxKey ctxKey = 1
	originCtxKey  ctxKey = 2
)

// PartnerAuthMiddleware validates the X-Api-Key and sets dynamic CORS
// PartnerAuthMiddleware validates the X-Api-Key and sets dynamic CORS
func (s *Service) PartnerAuthMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		// 1. Set CORS headers IMMEDIATELY before any validation
		origin := r.Header.Get("Origin")
		if origin == "" {
			origin = "*"
		}

		w.Header().Set("Access-Control-Allow-Origin", origin)
		w.Header().Set("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
		w.Header().Set("Access-Control-Allow-Headers", "Content-Type, X-Api-Key")

		// Handle preflight
		if r.Method == "OPTIONS" {
			w.WriteHeader(http.StatusOK)
			return
		}

		// 2. Validate the API Key
		apiKey := r.Header.Get("X-Api-Key")

		partner, err := s.Store.GetPartnerByKey(r.Context(), apiKey)
		if err != nil {
			http.Error(w, `{"error": "invalid api key"}`, http.StatusUnauthorized)
			return
		}

		// 3. Validate Origin (Check Global Config first, then Partner config)
		isGlobalAllowed := false
		for _, allowed := range s.Cfg.CORS.AllowedOrigins {
			if allowed == "*" || allowed == origin {
				isGlobalAllowed = true
				break
			}
		}

		// If it's not globally allowed, enforce the partner's specific origin
		if !isGlobalAllowed {
			if partner.AllowedOrigin != "*" && origin != partner.AllowedOrigin {
				http.Error(w, `{"error": "origin not allowed"}`, http.StatusForbidden)
				return
			}
		}

		ctx := context.WithValue(r.Context(), partnerCtxKey, partner)
		ctx = context.WithValue(ctx, originCtxKey, origin)
		next.ServeHTTP(w, r.WithContext(ctx))
	})
}

func (s *Service) AdminAuthMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		// Allow CORS for Admin panel
		origin := r.Header.Get("Origin")
		if origin == "" {
			origin = "*"
		}
		w.Header().Set("Access-Control-Allow-Origin", origin)
		// FIX: Added DELETE to allowed methods
		w.Header().Set("Access-Control-Allow-Methods", "GET, POST, DELETE, OPTIONS")
		w.Header().Set("Access-Control-Allow-Headers", "Content-Type, X-Admin-Key")

		// Handle preflight
		if r.Method == "OPTIONS" {
			w.WriteHeader(http.StatusOK)
			return
		}

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

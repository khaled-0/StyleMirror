package main

import (
	"context"
	"crypto/rand"
	"encoding/hex"
	"net/http"
)

type ctxKey int

const clientIDKey ctxKey = 1

func ClientIDMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		cid := r.Header.Get("X-Client-Id")
		if cid == "" {
			cid = "anon:" + r.RemoteAddr
		}
		ctx := context.WithValue(r.Context(), clientIDKey, cid)
		next.ServeHTTP(w, r.WithContext(ctx))
	})
}

func clientIDFromCtx(ctx context.Context) string {
	v, _ := ctx.Value(clientIDKey).(string)
	return v
}

func newTaskID() string {
	b := make([]byte, 12)
	_, _ = rand.Read(b)
	return "sm_" + hex.EncodeToString(b)
}

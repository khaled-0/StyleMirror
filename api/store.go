package main

import (
	"context"
	"crypto/rand"
	"encoding/hex"
	"errors"
	"fmt"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"
)

type Partner struct {
	ID            string    `json:"id"`
	Name          string    `json:"name"`
	APIKey        string    `json:"api_key,omitempty"`
	AllowedOrigin string    `json:"allowed_origin"`
	DailyLimit    int       `json:"daily_limit"`
	CreatedAt     time.Time `json:"created_at"`
}

type PartnerUsage struct {
	Partner   Partner `json:"partner"`
	UsedToday int     `json:"used_today"`
}

type PostgresStore struct {
	pool *pgxpool.Pool
}

type UsageLog struct {
	PartnerName string    `json:"partner_name"`
	TaskID      string    `json:"task_id"`
	TaskStatus  string    `json:"task_status"`
	CreatedAt   time.Time `json:"created_at"`
}

func NewPostgresStore(ctx context.Context, databaseURL string) (*PostgresStore, error) {
	pool, err := pgxpool.New(ctx, databaseURL)
	if err != nil {
		return nil, fmt.Errorf("unable to connect to database: %w", err)
	}
	if err := pool.Ping(ctx); err != nil {
		return nil, fmt.Errorf("unable to ping database: %w", err)
	}
	return &PostgresStore{pool: pool}, nil
}

func (s *PostgresStore) Close() {
	s.pool.Close()
}

func generateAPIKey() string {
	b := make([]byte, 24)
	_, _ = rand.Read(b)
	return "sm_live_" + hex.EncodeToString(b)
}

// --- Partner Management ---
func (s *PostgresStore) CreatePartner(ctx context.Context, name, origin string, dailyLimit int) (*Partner, error) {
	p := &Partner{
		APIKey:        generateAPIKey(),
		Name:          name,
		AllowedOrigin: origin,
		DailyLimit:    dailyLimit,
	}
	err := s.pool.QueryRow(ctx,
		`INSERT INTO partners (name, api_key, allowed_origin, daily_limit) VALUES ($1, $2, $3, $4) RETURNING id, created_at`,
		p.Name, p.APIKey, p.AllowedOrigin, p.DailyLimit,
	).Scan(&p.ID, &p.CreatedAt)
	if err != nil {
		return nil, err
	}
	return p, nil
}

func (s *PostgresStore) GetPartnerByKey(ctx context.Context, apiKey string) (*Partner, error) {
	p := &Partner{}
	err := s.pool.QueryRow(ctx,
		`SELECT id, name, api_key, allowed_origin, daily_limit, created_at FROM partners WHERE api_key = $1`,
		apiKey,
	).Scan(&p.ID, &p.Name, &p.APIKey, &p.AllowedOrigin, &p.DailyLimit, &p.CreatedAt)
	if err != nil {
		return nil, errors.New("partner not found")
	}
	return p, nil
}

func (s *PostgresStore) GetAllPartners(ctx context.Context) ([]PartnerUsage, error) {
	rows, err := s.pool.Query(ctx, `
        SELECT p.id, p.name, p.allowed_origin, p.daily_limit, p.created_at,
               COUNT(u.id) as usage_count
        FROM partners p
        LEFT JOIN usage_logs u ON p.id = u.partner_id AND u.created_at > NOW() - INTERVAL '24 hours'
        GROUP BY p.id
        ORDER BY p.created_at DESC
    `)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var stats []PartnerUsage
	for rows.Next() {
		var p Partner
		var u int
		if err := rows.Scan(&p.ID, &p.Name, &p.AllowedOrigin, &p.DailyLimit, &p.CreatedAt, &u); err != nil {
			continue
		}
		stats = append(stats, PartnerUsage{Partner: p, UsedToday: u})
	}
	return stats, nil
}

// --- Usage & Tasks ---
func (s *PostgresStore) GetPartnerUsage(ctx context.Context, partnerID string) (int, int, error) {
	var usedToday int
	var limit int
	err := s.pool.QueryRow(ctx, `
        SELECT COUNT(u.id), p.daily_limit
        FROM partners p
        LEFT JOIN usage_logs u ON p.id = u.partner_id AND u.created_at > NOW() - INTERVAL '24 hours'
        WHERE p.id = $1
        GROUP BY p.daily_limit
    `, partnerID).Scan(&usedToday, &limit)
	if err != nil {
		return 0, 0, err
	}
	return usedToday, limit, nil
}

func (s *PostgresStore) LogUsage(ctx context.Context, partnerID, taskID string) error {
	_, err := s.pool.Exec(ctx, `INSERT INTO usage_logs (partner_id, task_id) VALUES ($1, $2)`, partnerID, taskID)
	return err
}

func (s *PostgresStore) SaveTask(ctx context.Context, t *Task) error {
	t.UpdatedAt = time.Now()
	_, err := s.pool.Exec(ctx, `
        INSERT INTO tasks (id, partner_id, status, result_url, error, created_at)
        VALUES ($1, $2, $3, $4, $5, $6)
        ON CONFLICT (id) DO UPDATE SET status = $3, result_url = $4, error = $5
    `, t.ID, t.PartnerID, t.Status, t.ResultURL, t.Error, t.CreatedAt)
	return err
}

func (s *PostgresStore) GetTask(ctx context.Context, id string) (*Task, error) {
	t := &Task{}
	err := s.pool.QueryRow(ctx, `SELECT id, partner_id, status, result_url, error, created_at FROM tasks WHERE id = $1`, id).
		Scan(&t.ID, &t.PartnerID, &t.Status, &t.ResultURL, &t.Error, &t.CreatedAt)
	if err != nil {
		return nil, errors.New("task not found")
	}
	return t, nil
}

func (s *PostgresStore) DeletePartner(ctx context.Context, id string) error {
	_, err := s.pool.Exec(ctx, `DELETE FROM partners WHERE id = $1`, id)
	return err
}

func (s *PostgresStore) GetUsageLogs(ctx context.Context, limit int) ([]UsageLog, error) {
	rows, err := s.pool.Query(ctx, `
        SELECT p.name, u.task_id, COALESCE(t.status, 'unknown'), u.created_at
        FROM usage_logs u
        JOIN partners p ON u.partner_id = p.id
        LEFT JOIN tasks t ON u.task_id = t.id
        ORDER BY u.created_at DESC
        LIMIT $1
    `, limit)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	logs := []UsageLog{}
	for rows.Next() {
		var l UsageLog
		if err := rows.Scan(&l.PartnerName, &l.TaskID, &l.TaskStatus, &l.CreatedAt); err != nil {
			continue
		}
		logs = append(logs, l)
	}
	return logs, nil
}

func (s *PostgresStore) GetPartnerUsageLogs(ctx context.Context, partnerID string, limit int) ([]UsageLog, error) {
	rows, err := s.pool.Query(ctx, `
        SELECT p.name, u.task_id, COALESCE(t.status, 'unknown'), u.created_at
        FROM usage_logs u
        JOIN partners p ON u.partner_id = p.id
        LEFT JOIN tasks t ON u.task_id = t.id
        WHERE u.partner_id = $1
        ORDER BY u.created_at DESC
        LIMIT $2
    `, partnerID, limit)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	logs := []UsageLog{}
	for rows.Next() {
		var l UsageLog
		if err := rows.Scan(&l.PartnerName, &l.TaskID, &l.TaskStatus, &l.CreatedAt); err != nil {
			continue
		}
		logs = append(logs, l)
	}
	return logs, nil
}

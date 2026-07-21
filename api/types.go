package main

import "time"

type TaskStatus string

const (
	StatusQueued    TaskStatus = "queued"
	StatusRunning   TaskStatus = "running"
	StatusSucceeded TaskStatus = "succeeded"
	StatusFailed    TaskStatus = "failed"
)

type Task struct {
	ID        string     `json:"id"`
	PartnerID string     `json:"partner_id,omitempty"`
	Status    TaskStatus `json:"status"`
	ResultURL string     `json:"result_url,omitempty"`
	Error     string     `json:"error,omitempty"`
	CreatedAt time.Time  `json:"created_at"`
	UpdatedAt time.Time  `json:"updated_at"`
}

type SubmitRequest struct {
	GarmentURL    string `json:"garment_url"`
	BodyURL       string `json:"body_url"`
	GarmentPrompt string `json:"garment_prompt,omitempty"`
}

type SubmitResponse struct {
	TaskID string `json:"task_id"`
	Status string `json:"status"`
}

type UsageResponse struct {
	UsedToday int `json:"used_today"`
	Limit     int `json:"limit"`
}

type CreatePartnerRequest struct {
	Name          string `json:"name"`
	AllowedOrigin string `json:"allowed_origin"`
	DailyLimit    int    `json:"daily_limit"`
}

type Config struct {
	Server struct {
		Addr        string        `yaml:"addr"`
		ReadTimeout time.Duration `yaml:"read_timeout"`
		IdleTimeout time.Duration `yaml:"idle_timeout"`
	} `yaml:"server"`
	Database struct {
		URL string `yaml:"url"`
	} `yaml:"database"`
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
	AdminAPIKey string `yaml:"admin_api_key"`
}

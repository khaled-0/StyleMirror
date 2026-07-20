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
	ID           string     `json:"id"`
	Status       TaskStatus `json:"status"`
	GarmentURL   string     `json:"garment_url,omitempty"`
	BodyURL      string     `json:"body_url,omitempty"`
	ResultURL    string     `json:"result_url,omitempty"`
	Error        string     `json:"error,omitempty"`
	CreatedAt    time.Time  `json:"created_at"`
	UpdatedAt    time.Time  `json:"updated_at"`
	EstimatedSec int        `json:"estimated_sec,omitempty"`
}

type SubmitRequest struct {
	GarmentURL    string `json:"garment_url"`
	BodyURL       string `json:"body_url"`
	GarmentPrompt string `json:"garment_prompt,omitempty"`
}

type SubmitResponse struct {
	TaskID       string `json:"task_id"`
	Status       string `json:"status"`
	EstimatedSec int    `json:"estimated_sec"`
}

type StatusResponse struct {
	Task        `json:",inline"`
	PollAfterMs int `json:"poll_after_ms"`
}

type UsageResponse struct {
	ClientID    string `json:"client_id"`
	Used        int    `json:"used"`
	Limit       int    `json:"limit"`
	WindowSec   int    `json:"window_sec"`
	ResetAtUnix int64  `json:"reset_at_unix"`
}

type UploadResponse struct {
	URL       string `json:"url"`
	SizeBytes int64  `json:"size_bytes"`
	ExpiresIn int    `json:"expires_in_sec"`
}

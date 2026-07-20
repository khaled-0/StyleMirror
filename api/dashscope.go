package main

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"strings"
	"time"
)

// DashScopeClient calls Qwen-Image-Edit synchronously over HTTPS.
// No SDK, no polling of DashScope's own task system — one POST, one JSON response.
//
// API reference: https://help.aliyun.com/zh/model-studio/qwen-image-edit
//
// The request shape below matches the documented multi-image input format.
// If Aliyun changes the schema, this is the single file to update.
type DashScopeClient struct {
	apiKey  string
	baseURL string
	model   string
	timeout time.Duration
	http    *http.Client
}

func NewDashScopeClient(cfg *Config) *DashScopeClient {
	return &DashScopeClient{
		apiKey:  cfg.DashScope.APIKey,
		baseURL: strings.TrimRight(cfg.DashScope.BaseURL, "/"),
		model:   cfg.DashScope.Model,
		timeout: cfg.DashScope.Timeout,
		http:    &http.Client{Timeout: cfg.DashScope.Timeout},
	}
}

type dsInput struct {
	GarmentURL string `json:"garment_url"`
	BodyURL    string `json:"body_url"`
}

type dsParameters struct {
	Prompt string `json:"prompt,omitempty"`
}

type dsRequest struct {
	Model      string       `json:"model"`
	Input      dsInput      `json:"input"`
	Parameters dsParameters `json:"parameters"`
}

type dsOutput struct {
	ResultURL  string `json:"result_url"`
	URL        string `json:"url"`
	TaskID     string `json:"task_id"`
	TaskStatus string `json:"task_status"`
}

type dsResponse struct {
	Output    dsOutput `json:"output"`
	RequestID string   `json:"request_id"`
	Code      string   `json:"code,omitempty"`
	Message   string   `json:"message,omitempty"`
}

func (c *DashScopeClient) Edit(ctx context.Context, garmentURL, bodyURL, prompt string) (string, error) {
	if c.apiKey == "" {
		return "", errors.New("dashscope api key not configured")
	}

	prompt = strings.TrimSpace(prompt)
	if prompt == "" {
		prompt = "Virtual try-on: dress the person in the provided garment. Preserve identity, pose, and lighting."
	}

	body := dsRequest{
		Model:      c.model,
		Input:      dsInput{GarmentURL: garmentURL, BodyURL: bodyURL},
		Parameters: dsParameters{Prompt: prompt},
	}
	b, err := json.Marshal(body)
	if err != nil {
		return "", err
	}

	url := c.baseURL + "/api/v1/services/aigc/image-generation/generation"
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, url, bytes.NewReader(b))
	if err != nil {
		return "", err
	}
	req.Header.Set("Authorization", "Bearer "+c.apiKey)
	req.Header.Set("Content-Type", "application/json")

	resp, err := c.http.Do(req)
	if err != nil {
		return "", err
	}
	defer resp.Body.Close()

	raw, _ := io.ReadAll(resp.Body)
	if resp.StatusCode >= 400 {
		return "", fmt.Errorf("dashscope http %d: %s", resp.StatusCode, string(raw))
	}

	var out dsResponse
	if err := json.Unmarshal(raw, &out); err != nil {
		return "", fmt.Errorf("decode dashscope response: %w", err)
	}
	if out.Code != "" {
		return "", fmt.Errorf("dashscope error %s: %s", out.Code, out.Message)
	}

	resultURL := out.Output.ResultURL
	if resultURL == "" {
		resultURL = out.Output.URL
	}
	if resultURL == "" {
		return "", errors.New("dashscope returned empty result url")
	}
	return resultURL, nil
}

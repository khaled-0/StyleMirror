package main

import (
	"bytes"
	"context"
	"encoding/base64"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"strings"
	"time"
)

// DashScopeClient calls Qwen-Image-Edit synchronously over HTTPS.
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

type dsContent struct {
	Image string `json:"image,omitempty"`
	Text  string `json:"text,omitempty"`
}

type dsMessage struct {
	Role    string      `json:"role"`
	Content []dsContent `json:"content"`
}

type dsInput struct {
	Messages []dsMessage `json:"messages"`
}

type dsParameters struct {
	NegativePrompt string `json:"negative_prompt,omitempty"`
	Watermark      bool   `json:"watermark"`
}

type dsRequest struct {
	Model      string       `json:"model"`
	Input      dsInput      `json:"input"`
	Parameters dsParameters `json:"parameters"`
}

type dsResponseChoice struct {
	Message struct {
		Content []struct {
			Image string `json:"image"`
		} `json:"content"`
	} `json:"message"`
	FinishReason string `json:"finish_reason"`
}

type dsResponse struct {
	Output struct {
		Choices   []dsResponseChoice `json:"choices"`
		ResultURL string             `json:"result_url"`
		URL       string             `json:"url"`
	} `json:"output"`
	RequestID string `json:"request_id"`
	Code      string `json:"code,omitempty"`
	Message   string `json:"message,omitempty"`
}

// prepareImage ensures the image is a fully qualified Data URI (data:image/...;base64,...)
func (c *DashScopeClient) prepareImage(imageRef string) (string, error) {
	// If it's already a data URI, return it as-is
	if strings.HasPrefix(imageRef, "data:image/") {
		return imageRef, nil
	}

	// If it's a URL, download it and convert to Data URI
	if strings.HasPrefix(imageRef, "http://") || strings.HasPrefix(imageRef, "https://") {
		req, err := http.NewRequest(http.MethodGet, imageRef, nil)
		if err != nil {
			return "", err
		}
		req.Header.Set("User-Agent", "StyleMirrorBot/1.0")

		resp, err := c.http.Do(req)
		if err != nil {
			return "", fmt.Errorf("failed to download image: %w", err)
		}
		defer resp.Body.Close()

		if resp.StatusCode != http.StatusOK {
			return "", fmt.Errorf("failed to download image: status %d", resp.StatusCode)
		}

		imgData, err := io.ReadAll(io.LimitReader(resp.Body, 10<<20))
		if err != nil {
			return "", fmt.Errorf("failed to read image data: %w", err)
		}

		// Detect content type from headers, fallback to jpeg
		contentType := resp.Header.Get("Content-Type")
		if contentType == "" || !strings.HasPrefix(contentType, "image/") {
			contentType = "image/jpeg"
		}

		encoded := base64.StdEncoding.EncodeToString(imgData)
		return fmt.Sprintf("data:%s;base64,%s", contentType, encoded), nil
	}

	// Fallback: if it's raw base64, wrap it in a data URI
	return "data:image/jpeg;base64," + imageRef, nil
}

func (c *DashScopeClient) Edit(ctx context.Context, garmentURL, bodyURL, prompt string) (string, error) {
	if c.apiKey == "" {
		return "", errors.New("dashscope api key not configured")
	}

	garmentDataURI, err := c.prepareImage(garmentURL)
	if err != nil {
		return "", fmt.Errorf("garment image processing failed: %w", err)
	}

	bodyDataURI, err := c.prepareImage(bodyURL)
	if err != nil {
		return "", fmt.Errorf("body image processing failed: %w", err)
	}

	prompt = strings.TrimSpace(prompt)
	// if prompt == "" {
	prompt = "Transfer the garment from image 1 onto the person in image 2. Keep the person's original pose, face, hair, body shape, and background exactly the same. Only change the dress."
	// }

	body := dsRequest{
		Model: c.model,
		Input: dsInput{
			Messages: []dsMessage{
				{
					Role: "user",
					Content: []dsContent{
						{Image: garmentDataURI}, // Image 1
						{Image: bodyDataURI},    // Image 2
						{Text: prompt},
					},
				},
			},
		},
		Parameters: dsParameters{
			Watermark: false,
		},
	}

	b, err := json.Marshal(body)
	if err != nil {
		return "", err
	}

	url := c.baseURL + "/api/v1/services/aigc/multimodal-generation/generation"
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

	if len(out.Output.Choices) > 0 && len(out.Output.Choices[0].Message.Content) > 0 {
		for _, content := range out.Output.Choices[0].Message.Content {
			if content.Image != "" {
				return content.Image, nil
			}
		}
	}

	if out.Output.ResultURL != "" {
		return out.Output.ResultURL, nil
	}
	if out.Output.URL != "" {
		return out.Output.URL, nil
	}

	return "", errors.New("dashscope returned empty result url")
}

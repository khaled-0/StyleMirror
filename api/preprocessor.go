package main

import "context"

// Preprocessor is the explicit extension point for a future CV tier.
//
// In v1 it is a no-op: Qwen-Image-Edit handles garment compositing,
// background removal, and pose preservation in a single model call.
//
// To add a CV tier post-thesis:
//
//	type CVPreprocessor struct { Endpoint string } // gRPC or HTTP
//	func (p *CVPreprocessor) Preprocess(ctx context.Context, garment, body string) (...) {
//	    // 1. Call a Python microservice (U2Net bg-removal, SAM segmentation,
//	    //    OpenPose skeleton, etc.)
//	    // 2. Return processed URLs (uploaded to object storage) + metadata
//	    //    (pose keypoints, mask bounds) that could be forwarded to a
//	    //    diffusion model for finer control.
//	}
//
// Then in main.go:
//
//	var preprocessor Preprocessor = NewCVPreprocessor(cfg.CV.Endpoint)
//
// The handler already calls Preprocess() before DashScope.Edit() — no other
// code needs to change.
type Preprocessor interface {
	Preprocess(ctx context.Context, garmentURL, bodyURL string) (
		newGarment string, newBody string, meta map[string]string, err error,
	)
}

type NoOpPreprocessor struct{}

func (n *NoOpPreprocessor) Preprocess(_ context.Context, garmentURL, bodyURL string) (string, string, map[string]string, error) {
	return garmentURL, bodyURL, nil, nil
}

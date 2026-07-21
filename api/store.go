package main

import (
	"context"
	"encoding/json"
	"errors"
	"time"

	"github.com/redis/go-redis/v9"
)

type RedisStore struct {
	rdb *redis.Client
}

const (
	tasksPrefix  = "sm:task:"
	usagePrefix  = "sm:usage:"
	uploadPrefix = "sm:upload:"
	taskTTL      = 30 * time.Minute
	uploadTTL    = 10 * time.Minute
)

func NewRedisStore(cfg *Config) (*RedisStore, error) {
	rdb := redis.NewClient(&redis.Options{
		Addr:     cfg.Redis.Addr,
		Password: cfg.Redis.Password,
		DB:       cfg.Redis.DB,
	})
	ctx, cancel := context.WithTimeout(context.Background(), 3*time.Second)
	defer cancel()
	if err := rdb.Ping(ctx).Err(); err != nil {
		return nil, err
	}
	return &RedisStore{rdb: rdb}, nil
}

func (s *RedisStore) Close() error { return s.rdb.Close() }

func (s *RedisStore) SaveTask(ctx context.Context, t *Task) error {
	t.UpdatedAt = time.Now()
	b, err := json.Marshal(t)
	if err != nil {
		return err
	}
	return s.rdb.Set(ctx, tasksPrefix+t.ID, b, taskTTL).Err()
}

func (s *RedisStore) GetTask(ctx context.Context, id string) (*Task, error) {
	b, err := s.rdb.Get(ctx, tasksPrefix+id).Bytes()
	if errors.Is(err, redis.Nil) {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}
	var t Task
	if err := json.Unmarshal(b, &t); err != nil {
		return nil, err
	}
	return &t, nil
}

func (s *RedisStore) IncrementUsage(ctx context.Context, clientID string, window time.Duration) (int, error) {
	key := usagePrefix + clientID
	n, err := s.rdb.Incr(ctx, key).Result()
	if err != nil {
		return 0, err
	}
	if n == 1 {
		_ = s.rdb.Expire(ctx, key, window).Err()
	}
	return int(n), nil
}

func (s *RedisStore) Usage(ctx context.Context, clientID string) (count int, ttl time.Duration, err error) {
	key := usagePrefix + clientID
	c, err := s.rdb.Get(ctx, key).Int()
	if errors.Is(err, redis.Nil) {
		return 0, 0, nil
	}
	if err != nil {
		return 0, 0, err
	}
	t, err := s.rdb.TTL(ctx, key).Result()
	if err != nil || t < 0 {
		return c, 0, nil
	}
	return c, t, nil
}

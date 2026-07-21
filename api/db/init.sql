CREATE TABLE IF NOT EXISTS partners (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    api_key VARCHAR(64) UNIQUE NOT NULL,
    allowed_origin VARCHAR(255) NOT NULL,
    daily_limit INT DEFAULT 20,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS tasks (
    id VARCHAR(32) PRIMARY KEY,
    partner_id UUID REFERENCES partners(id) ON DELETE CASCADE,
    status VARCHAR(32) NOT NULL,
    result_url TEXT,
    error TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS usage_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    partner_id UUID REFERENCES partners(id) ON DELETE CASCADE,
    task_id VARCHAR(32),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Insert a default demo partner if it doesn't exist
INSERT INTO partners (name, api_key, allowed_origin, daily_limit)
SELECT 'Demo Partner', 'sm_demo_key_123', '*', 50
WHERE NOT EXISTS (SELECT 1 FROM partners WHERE api_key = 'sm_demo_key_123');

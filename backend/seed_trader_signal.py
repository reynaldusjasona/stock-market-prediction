import os

from supabase import create_client

url = os.getenv("SUPABASE_URL")
key = os.getenv("SUPABASE_KEY")
supabase = create_client(url, key)

TABLES = {
    "signal_endorsements": """
CREATE TABLE signal_endorsements (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    trader_id UUID NOT NULL REFERENCES users(id),
    prediction_id UUID NOT NULL REFERENCES predictions(id),
    endorsement VARCHAR NOT NULL CHECK (endorsement IN ('agree', 'disagree')),
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE (trader_id, prediction_id)
);

GRANT ALL ON signal_endorsements TO authenticated;
""",
    "trader_clients": """
CREATE TABLE trader_clients (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    trader_id UUID NOT NULL REFERENCES users(id),
    investor_id UUID NOT NULL REFERENCES users(id),
    status VARCHAR NOT NULL DEFAULT 'active',
    created_at TIMESTAMPTZ DEFAULT now()
);

GRANT ALL ON trader_clients TO authenticated;
""",
    "trader_signal": """
CREATE TABLE trader_signal (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    trader_id UUID NOT NULL REFERENCES users(id),
    investor_id UUID NOT NULL REFERENCES users(id),
    ticker VARCHAR NOT NULL,
    signal VARCHAR NOT NULL CHECK (signal IN ('Buy', 'Hold', 'Sell')),
    confidence_score NUMERIC,
    reasoning TEXT,
    verdict VARCHAR CHECK (verdict IN ('agree', 'disagree')),
    note TEXT,
    endorsed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT now()
);

GRANT ALL ON trader_signal TO authenticated;
""",
}

for table_name, create_sql in TABLES.items():
    try:
        supabase.table(table_name).select("id").limit(1).execute()
        print(f"{table_name} table already exists")
    except Exception as e:
        print(f"{table_name}: table does not exist or error: {e}")
        print("Run this SQL in Supabase SQL Editor:")
        print(create_sql)

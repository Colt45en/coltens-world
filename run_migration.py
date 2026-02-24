import psycopg

conn = psycopg.connect('postgresql://postgres:postgres@127.0.0.1:5432/keeper')
with conn.cursor() as cur:
    with open('ops/servers/telemetry_migration.sql', 'r') as f:
        sql = f.read()
    cur.execute(sql)
conn.commit()
print('Migration applied')

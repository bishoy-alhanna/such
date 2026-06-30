ShepherdCare Backend (ShepherdCare.Api)

Requirements:
- .NET 8 SDK
- PostgreSQL (or update connection string to SQL Server)

Environment variables:
- CONNECTION_STRING
- JWT_SECRET
- ENCRYPTION_KEY (base64 or raw string of length 16/24/32)

Run locally:
1. cd backend/ShepherdCare.Api
2. dotnet restore
3. dotnet run

Default seeded user: admin / Admin123!

Docker (quick start):

1. From `backend/ShepherdCare.Api` set ENCRYPTION_KEY for docker-compose:

```bash
export ENCRYPTION_KEY=$(openssl rand -base64 32)
```

2. Start services:

```bash
docker compose up --build
```

This will start Postgres and the API bound to host port 5000.

If you prefer to create the DB schema yourself, run the SQL in `sql/init_schema.sql` against the Postgres instance before starting the API.

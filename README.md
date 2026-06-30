ShepherdCare / رعاية

This workspace contains the initial backend for ShepherdCare — a pastoral management system.

Backend: .NET 8 Web API using EF Core and PostgreSQL.

See backend/ShepherdCare.Api for the API project.

Environment variables required (example):

- CONNECTION_STRING=Host=localhost;Database=shepherdcare;Username=postgres;Password=secret
- JWT_SECRET=very_long_random_secret_here
- ENCRYPTION_KEY=32_byte_base64_or_hex_key_here

Run the API (dotnet 8 required):

1. cd backend/ShepherdCare.Api
2. dotnet restore
3. dotnet run

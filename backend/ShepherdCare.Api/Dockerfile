FROM mcr.microsoft.com/dotnet/aspnet:8.0 AS base
WORKDIR /app

FROM mcr.microsoft.com/dotnet/sdk:8.0 AS build
WORKDIR /src
COPY . ./
RUN dotnet restore "ShepherdCare.Api.csproj"
RUN dotnet publish "ShepherdCare.Api.csproj" -c Release -o /app/publish

FROM base AS final
WORKDIR /app
COPY --from=build /app/publish ./
# Expose HTTP only for container (dev). In production provide a certificate and use HTTPS.
ENV ASPNETCORE_URLS=http://+:80
ENTRYPOINT ["dotnet", "ShepherdCare.Api.dll"]

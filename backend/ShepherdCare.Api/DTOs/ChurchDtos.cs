namespace ShepherdCare.Api.DTOs
{
    public record ChurchDto(
        Guid   Id,
        string Name,
        string Slug,
        bool   IsActive,
        string? LogoUrl,
        string? ContactEmail,
        string? City,
        string? Country,
        DateTime CreatedAt,
        string? AdminUsername
    );

    public record RegisterChurchRequest(
        string Name,
        string Slug,
        string? ContactEmail,
        string? City,
        string? Country,
        // Church admin account — created immediately but locked until church is approved
        string AdminUsername,
        string AdminPassword,
        string? AdminDisplayName
    );

    public record UpdateChurchRequest(
        string? Name,
        bool?   IsActive,
        string? LogoUrl,
        string? ContactEmail,
        string? City,
        string? Country
    );

    public record ResetAdminPasswordRequest(string NewPassword);
    public record UpdateAdminStatusRequest(bool IsActive);

    public record ChurchAdminDto(
        Guid    Id,
        string  Username,
        string? DisplayName,
        bool    IsActive,
        bool    PendingApproval
    );
}

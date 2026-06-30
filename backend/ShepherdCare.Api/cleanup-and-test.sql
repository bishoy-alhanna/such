-- ========================================
-- Complete Cleanup and Verification Script
-- ========================================

-- 1. DELETE all links without labels (these are likely from old buggy code)
DELETE FROM "FamilyLinks" 
WHERE "RelationLabel" IS NULL OR TRIM("RelationLabel") = '';

-- 2. Show all families where the same person appears as Head multiple times (by NationalId)
SELECT 
    fm."NationalId",
    fm."FullName",
    COUNT(DISTINCT fm."FamilyId") as family_count,
    STRING_AGG(DISTINCT f."FamilyName", ' | ') as families
FROM "FamilyMembers" fm
JOIN "Families" f ON fm."FamilyId" = f."Id"
WHERE fm."Relation" = 'Head' 
  AND fm."NationalId" IS NOT NULL
GROUP BY fm."NationalId", fm."FullName"
HAVING COUNT(DISTINCT fm."FamilyId") > 1;

-- 3. Show duplicate family links (same pair of families linked multiple times)
SELECT 
    f1."FamilyName" as "FromFamily",
    f2."FamilyName" as "ToFamily",
    fl."RelationLabel",
    COUNT(*) as link_count
FROM "FamilyLinks" fl
JOIN "Families" f1 ON fl."FamilyId" = f1."Id"
JOIN "Families" f2 ON fl."LinkedFamilyId" = f2."Id"
GROUP BY f1."FamilyName", f2."FamilyName", fl."RelationLabel"
HAVING COUNT(*) > 1;

-- 4. Delete duplicate family links (keep only the first one for each unique pair)
DELETE FROM "FamilyLinks" fl
WHERE fl."Id" NOT IN (
    SELECT MIN("Id")
    FROM "FamilyLinks"
    GROUP BY "FamilyId", "LinkedFamilyId", "RelationLabel"
);

-- 5. View all family links with proper details
SELECT 
    f1."FamilyName" as "From",
    fl."RelationLabel" as "Label",
    f2."FamilyName" as "To"
FROM "FamilyLinks" fl
JOIN "Families" f1 ON fl."FamilyId" = f1."Id"
JOIN "Families" f2 ON fl."LinkedFamilyId" = f2."Id"
ORDER BY f1."FamilyName", f2."FamilyName";

-- 6. Find all members with the same National ID across different families
SELECT 
    fm."NationalId",
    STRING_AGG(DISTINCT f."FamilyName" || ' - ' || fm."FullName" || ' (' || fm."Relation" || ')', ' | ') as occurrences
FROM "FamilyMembers" fm
JOIN "Families" f ON fm."FamilyId" = f."Id"
WHERE fm."NationalId" IS NOT NULL
GROUP BY fm."NationalId"
HAVING COUNT(DISTINCT fm."FamilyId") > 1;

-- ========================================
-- Cleanup Script for Duplicate Family Links
-- ========================================
-- This script helps identify and remove duplicate family links
-- that may have been created during testing.

-- 1. View all duplicate links (same FamilyId + LinkedFamilyId pair)
SELECT 
    "FamilyId", 
    "LinkedFamilyId", 
    "RelationLabel",
    COUNT(*) as duplicate_count
FROM "FamilyLinks"
GROUP BY "FamilyId", "LinkedFamilyId", "RelationLabel"
HAVING COUNT(*) > 1;

-- 2. View all links without labels
SELECT 
    fl."Id",
    f1."FamilyName" as "FromFamily",
    f2."FamilyName" as "ToFamily",
    fl."RelationLabel"
FROM "FamilyLinks" fl
JOIN "Families" f1 ON fl."FamilyId" = f1."Id"
JOIN "Families" f2 ON fl."LinkedFamilyId" = f2."Id"
WHERE fl."RelationLabel" IS NULL OR TRIM(fl."RelationLabel") = '';

-- 3. Delete all links without labels (OPTIONAL - uncomment to execute)
-- DELETE FROM "FamilyLinks" 
-- WHERE "RelationLabel" IS NULL OR TRIM("RelationLabel") = '';

-- 4. Keep only the FIRST occurrence of each duplicate link pair and delete the rest
-- (OPTIONAL - uncomment to execute)
-- DELETE FROM "FamilyLinks"
-- WHERE "Id" NOT IN (
--     SELECT MIN("Id")
--     FROM "FamilyLinks"
--     GROUP BY "FamilyId", "LinkedFamilyId"
-- );

-- 5. View all families with multiple members having the same NationalId
SELECT 
    "FamilyId",
    "NationalId",
    COUNT(*) as member_count,
    STRING_AGG("FullName" || ' (' || "Relation" || ')', ', ') as members
FROM "FamilyMembers"
WHERE "NationalId" IS NOT NULL
GROUP BY "FamilyId", "NationalId"
HAVING COUNT(*) > 1;

-- 6. View all people who appear as Head in multiple families (should be unique)
SELECT 
    "NationalId",
    COUNT(DISTINCT "FamilyId") as family_count,
    STRING_AGG("FamilyName", ', ') as families
FROM "FamilyMembers" fm
JOIN "Families" f ON fm."FamilyId" = f."Id"
WHERE fm."Relation" = 'Head' 
  AND fm."NationalId" IS NOT NULL
GROUP BY "NationalId"
HAVING COUNT(DISTINCT "FamilyId") > 1;

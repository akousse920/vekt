-- Keep existing field IDs and answers. Historical answers contain only a year;
-- new submissions on these fields provide an exact ISO birth date.
UPDATE "ApplicationField"
SET "type" = 'BIRTH_DATE',
    "label" = REPLACE("label", 'Année de naissance', 'Date de naissance')
WHERE "type" = 'BIRTH_YEAR';

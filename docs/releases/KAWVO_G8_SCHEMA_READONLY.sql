-- KAW-G8-001: metadata only; no patient/profile/credential values or mutations.
-- Prepare for separately authorized read-only verification; NOT executed remotely by Codex.
SELECT name, type, sql FROM sqlite_master
WHERE type IN ('table','index') AND (
 name IN ('sponsor_sales_representatives','sponsor_sales_assignments','sponsor_commercial_resources',
 'artifact_display_identifiers','medical_display_identifiers',
 'kawmed_demo_invitations','kawmed_demo_live_access')
 OR name LIKE 'idx_sponsor_sales_%' OR name='idx_artifact_display_line')
ORDER BY type,name;
SELECT 'sponsor_sales_representatives' AS table_name,name,type,"notnull",pk FROM pragma_table_info('sponsor_sales_representatives');
SELECT 'sponsor_sales_assignments' AS table_name,name,type,"notnull",pk FROM pragma_table_info('sponsor_sales_assignments');
SELECT 'sponsor_commercial_resources' AS table_name,name,type,"notnull",pk FROM pragma_table_info('sponsor_commercial_resources');
SELECT 'artifact_display_identifiers' AS table_name,name,type,"notnull",pk FROM pragma_table_info('artifact_display_identifiers');
SELECT 'medical_display_identifiers' AS table_name,name,type,"notnull",pk FROM pragma_table_info('medical_display_identifiers');
SELECT 'kawmed_demo_invitations' AS table_name,name,type,"notnull",pk FROM pragma_table_info('kawmed_demo_invitations');
SELECT 'kawmed_demo_live_access' AS table_name,name,type,"notnull",pk FROM pragma_table_info('kawmed_demo_live_access');

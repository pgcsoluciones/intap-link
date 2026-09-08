-- Team Master sync unblock · Production (NOT applied without explicit approval)
-- The original D1 permission triggers were actor-blind: they blocked the Master/server
-- from propagating corporate presentation data to Team members. Team members do not
-- authenticate through the normal Free editor; delegated role writes are enforced by
-- Team-specific API routes. Remove the actor-blind triggers so Master inheritance works.

DROP TRIGGER IF EXISTS trg_team_profile_update_guard;
DROP TRIGGER IF EXISTS trg_team_contact_update_guard;
DROP TRIGGER IF EXISTS trg_team_gallery_insert_guard;
DROP TRIGGER IF EXISTS trg_team_gallery_update_guard;
DROP TRIGGER IF EXISTS trg_team_gallery_delete_guard;
DROP TRIGGER IF EXISTS trg_team_products_insert_guard;
DROP TRIGGER IF EXISTS trg_team_products_update_guard;
DROP TRIGGER IF EXISTS trg_team_products_delete_guard;
DROP TRIGGER IF EXISTS trg_team_links_insert_guard;
DROP TRIGGER IF EXISTS trg_team_links_update_guard;
DROP TRIGGER IF EXISTS trg_team_links_delete_guard;
DROP TRIGGER IF EXISTS trg_team_social_insert_guard;
DROP TRIGGER IF EXISTS trg_team_social_update_guard;
DROP TRIGGER IF EXISTS trg_team_social_delete_guard;

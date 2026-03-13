-- Migration 0024: add is_active column to modules table
-- Context: 0001 created modules without is_active; 0013 used CREATE TABLE IF NOT EXISTS
-- which was silently ignored since the table already existed.
-- This ALTER TABLE repairs production schema to match the intended design.

ALTER TABLE modules ADD COLUMN is_active INTEGER NOT NULL DEFAULT 1;

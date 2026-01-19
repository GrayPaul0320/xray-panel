-- +migrate Up
ALTER TABLE slaves ADD COLUMN ip VARCHAR(45) DEFAULT '';

-- +migrate Down
ALTER TABLE slaves DROP COLUMN ip;

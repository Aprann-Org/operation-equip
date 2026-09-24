-- =============================================================
-- In Country stage
--
-- Shipped devices often sit in storage in-country while waiting
-- for a recipient. Until now they had to be marked Distributed
-- (which implies someone has them) or left at Ready to Ship
-- (which implies they're still here). in_country sits between
-- the two. It is optional: a device handed out on arrival still
-- moves straight from ready_for_distribution to distributed.
--
-- Entering in_country stamps date_sent (app layer), same as
-- distributed does when it's reached directly.
-- =============================================================

alter type equipment_stage add value if not exists 'in_country' after 'ready_for_distribution';

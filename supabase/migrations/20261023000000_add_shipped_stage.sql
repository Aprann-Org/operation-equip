-- =============================================================
-- Shipped stage
--
-- There are usually a few weeks between a device leaving and it
-- arriving in country. Until now it stayed at Ready to Ship
-- (which implies it's still here) or was moved early to In
-- Country (which implies it has arrived). shipped covers the
-- time in transit, between ready_for_distribution and in_country.
--
-- Entering shipped stamps date_sent (app layer). in_country and
-- distributed still stamp it when date_sent is empty, so a device
-- moved past shipped by hand still gets a sent date.
-- =============================================================

alter type equipment_stage add value if not exists 'shipped' after 'ready_for_distribution';

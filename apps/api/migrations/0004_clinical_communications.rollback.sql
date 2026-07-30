DROP TRIGGER IF EXISTS communication_events_immutable ON communication_events;
DROP FUNCTION IF EXISTS prevent_communication_event_mutation();
DROP TABLE IF EXISTS communication_notifications;
DROP TABLE IF EXISTS communication_attachments;
DROP TABLE IF EXISTS communication_events;
DROP TABLE IF EXISTS communication_threads;
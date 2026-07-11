-- DropIndex
DROP INDEX "bookings_serviceId_bookingDate_bookingTime_key";

-- CreateIndex
CREATE INDEX "bookings_serviceId_bookingDate_bookingTime_idx" ON "bookings"("serviceId", "bookingDate", "bookingTime");

-- CreateIndex
-- Partial unique index: only one active (non-CANCELLED) booking may exist
-- per service/date/time slot. Cancelled bookings no longer occupy the slot,
-- and this is what actually prevents double-booking under concurrent
-- requests (Postgres enforces it atomically at insert time).
CREATE UNIQUE INDEX "bookings_active_slot_key" ON "bookings"("serviceId", "bookingDate", "bookingTime") WHERE "status" <> 'CANCELLED';

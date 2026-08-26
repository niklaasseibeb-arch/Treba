const eligibleDrivers = drivers
  .filter(driver => driver.is_active)
  .filter(driver => driver.is_verified)
  .filter(driver => driver.availability_status === "available")
  .filter(driver => driver.route_matches)
  .filter(driver => driver.vehicle_eligible)
  .sort((a, b) => b.priority_score - a.priority_score)
  .slice(0, 5);

 for (const driver of eligibleDrivers) {
  await base44.entities.TripOffer.create({
    trip_request_id: request.id,
    driver_id: driver.id,

    origin: request.origin,
    destination: request.destination,
    requested_date: request.requested_date,
    requested_time: request.requested_time,

    status: "offered",

    expires_at: calculateOfferExpiry(request),
  });
} 
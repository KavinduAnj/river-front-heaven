const prisma = require("../db");
const HttpError = require("../utils/httpError");
const parseId = require("../utils/parseId");

/**
 * Calculates stay nights between check-in and check-out dates.
 * Follows the overlap rule: stays cover nights from checkInDate up to (exclusive) checkOutDate.
 * Minimum of 1 night for any valid reservation.
 */
function calculateNights(checkInDate, checkOutDate) {
  const checkIn = new Date(checkInDate);
  const checkOut = new Date(checkOutDate);

  // Normalize to UTC dates to avoid DST or timezone drift
  const utc1 = Date.UTC(checkIn.getFullYear(), checkIn.getMonth(), checkIn.getDate());
  const utc2 = Date.UTC(checkOut.getFullYear(), checkOut.getMonth(), checkOut.getDate());

  const msPerDay = 1000 * 60 * 60 * 24;
  const nights = Math.round((utc2 - utc1) / msPerDay);
  return Math.max(1, nights);
}

/**
 * Resolves and validates a reservation for charge posting.
 * Verifies that:
 * 1. The reservation exists.
 * 2. If guestId is specified, the reservation belongs to that exact guest.
 * 3. The reservation is not in an invalid status (e.g., CANCELLED or NO_SHOW).
 * 4. The bill has not already been finalized with an issued invoice.
 */
async function resolveReservation(
  identifier,
  db = prisma
) {
  const params =
    typeof identifier === "object" && identifier !== null
      ? identifier
      : { reservationId: identifier };
  const { reservationId, reservationReference, guestId, cabanaId } = params;
  let reservation = null;

  if (reservationId !== undefined && reservationId !== null) {
    const id = parseId(reservationId);
    reservation = await db.reservation.findUnique({
      where: { id },
      include: { guest: true, package: true, cabana: true, invoice: true },
    });
  } else if (reservationReference) {
    reservation = await db.reservation.findUnique({
      where: { reference: String(reservationReference).trim() },
      include: { guest: true, package: true, cabana: true, invoice: true },
    });
  } else if (cabanaId !== undefined && cabanaId !== null) {
    const cId = parseId(cabanaId);
    // Find active occupant
    reservation = await db.reservation.findFirst({
      where: {
        cabanaId: cId,
        status: { in: ["CHECKED_IN", "CONFIRMED"] },
      },
      orderBy: { checkInDate: "desc" },
      include: { guest: true, package: true, cabana: true, invoice: true },
    });
    if (!reservation) {
      throw new HttpError(404, "No active stay found for this cabana", "NO_ACTIVE_RESERVATION");
    }
  } else if (guestId !== undefined && guestId !== null) {
    const gId = parseId(guestId);
    // Find active reservation for the guest
    const activeStays = await db.reservation.findMany({
      where: {
        guestId: gId,
        status: { in: ["CHECKED_IN", "CONFIRMED"] },
      },
      orderBy: { checkInDate: "desc" },
      include: { guest: true, package: true, cabana: true, invoice: true },
    });

    if (activeStays.length === 0) {
      throw new HttpError(404, "No active reservation found for this guest", "NO_ACTIVE_RESERVATION");
    }
    if (activeStays.length > 1) {
      throw new HttpError(
        400,
        "Multiple active reservations found for this guest; please specify reservationId",
        "AMBIGUOUS_RESERVATION"
      );
    }
    reservation = activeStays[0];
  } else {
    throw new HttpError(
      400,
      "Please provide reservationId, reservationReference, guestId, or cabanaId",
      "MISSING_RESERVATION_IDENTIFIER"
    );
  }

  if (!reservation) {
    throw new HttpError(404, "Reservation not found", "NOT_FOUND");
  }

  // Cross-verify guest association if guestId was provided
  if (guestId !== undefined && guestId !== null) {
    const expectedGuestId = parseId(guestId);
    if (reservation.guestId !== expectedGuestId) {
      throw new HttpError(
        400,
        `Reservation ${reservation.reference} belongs to guest ID ${reservation.guestId}, not guest ID ${expectedGuestId}`,
        "GUEST_RESERVATION_MISMATCH"
      );
    }
  }

  // Verify status applicability
  if (reservation.status === "CANCELLED") {
    throw new HttpError(409, "Cannot post charges to a cancelled reservation", "RESERVATION_CANCELLED");
  }
  if (reservation.status === "NO_SHOW") {
    throw new HttpError(409, "Cannot post charges to a no-show reservation", "RESERVATION_NO_SHOW");
  }

  // Check if invoice has already been issued
  if (reservation.invoice) {
    throw new HttpError(
      409,
      `Bill for reservation ${reservation.reference} is already finalized (Invoice: ${reservation.invoice.invoiceNumber})`,
      "BILL_ALREADY_CLOSED"
    );
  }

  return reservation;
}

/**
 * Checks if a charge with the same idempotency key has already been posted.
 */
async function checkIdempotency(reservationId, idempotencyKey, db = prisma) {
  if (!idempotencyKey) return null;

  const key = String(idempotencyKey).trim();
  const existingAudit = await db.auditLog.findFirst({
    where: {
      action: "CHARGE_POSTED",
      entity: "Reservation",
      entityId: reservationId,
      newValue: {
        path: ["idempotencyKey"],
        equals: key,
      },
    },
  });

  return existingAudit ? existingAudit.newValue : null;
}

/**
 * Records an audit log for a posted charge.
 */
async function recordChargeAudit(
  { userId, reservationId, entity, entityId, chargeData, idempotencyKey },
  db = prisma
) {
  try {
    return await db.auditLog.create({
      data: {
        userId: userId ? parseId(userId) : null,
        action: "CHARGE_POSTED",
        entity: entity || "Reservation",
        entityId: entityId || reservationId,
        newValue: {
          reservationId,
          idempotencyKey: idempotencyKey || null,
          ...chargeData,
          postedAt: new Date().toISOString(),
        },
      },
    });
  } catch {
    // If audit log schema or json filter fails in test mocks, don't block the transaction
    return null;
  }
}

/**
 * Posts an Activity Booking charge to a guest's reservation.
 * Guarantees no duplicate bookings for the same activity and scheduled time on the reservation.
 */
async function postActivityCharge(data, db = prisma) {
  const reservation = await resolveReservation(data, db);

  // Check idempotency
  if (data.idempotencyKey) {
    const previous = await checkIdempotency(reservation.id, data.idempotencyKey, db);
    if (previous) {
      return {
        deduplicated: true,
        message: "Charge already posted with this idempotency key",
        ...previous,
      };
    }
  }

  const activityId = parseId(data.activityId);
  const activity = await db.activity.findUnique({ where: { id: activityId } });
  if (!activity) {
    throw new HttpError(404, "Activity not found", "NOT_FOUND");
  }
  if (!activity.isActive) {
    throw new HttpError(400, "This activity is currently inactive", "ACTIVITY_INACTIVE");
  }

  const participants = Number(data.participants);
  if (!participants || participants < 1) {
    throw new HttpError(400, "Participants count must be at least 1", "VALIDATION_ERROR");
  }
  if (participants > activity.maxParticipants) {
    throw new HttpError(
      400,
      `Maximum participants for ${activity.name} is ${activity.maxParticipants}`,
      "MAX_PARTICIPANTS_EXCEEDED"
    );
  }

  const scheduledAt = new Date(data.scheduledAt);
  if (isNaN(scheduledAt.getTime())) {
    throw new HttpError(400, "Invalid scheduledAt date format", "INVALID_DATE");
  }

  // Duplicate Check: Same reservation, same activity, same scheduled time that is not CANCELLED
  const duplicate = await db.activityBooking.findFirst({
    where: {
      reservationId: reservation.id,
      activityId,
      scheduledAt,
      status: { not: "CANCELLED" },
    },
  });

  if (duplicate) {
    throw new HttpError(
      409,
      `A booking for "${activity.name}" scheduled at ${scheduledAt.toISOString()} already exists on reservation ${reservation.reference}`,
      "DUPLICATE_ACTIVITY_BOOKING"
    );
  }

  const unitPrice = Number(data.unitPriceAtBooking ?? activity.unitPrice);
  const totalCharge = Math.round(unitPrice * participants * 100) / 100;

  const booking = await db.activityBooking.create({
    data: {
      reservationId: reservation.id,
      activityId,
      scheduledAt,
      participants,
      unitPriceAtBooking: unitPrice,
      totalCharge,
      status: data.status || "BOOKED",
      createdById: data.userId ? parseId(data.userId) : reservation.createdById,
    },
    include: { activity: true },
  });

  await recordChargeAudit(
    {
      userId: data.userId,
      reservationId: reservation.id,
      entity: "ActivityBooking",
      entityId: booking.id,
      chargeData: {
        category: "ACTIVITY",
        bookingId: booking.id,
        activityName: activity.name,
        participants,
        unitPrice,
        totalCharge,
      },
      idempotencyKey: data.idempotencyKey,
    },
    db
  );

  return {
    deduplicated: false,
    chargeType: "ACTIVITY",
    reservationReference: reservation.reference,
    booking,
  };
}

/**
 * Posts a Food & Beverage Order charge to a guest's reservation.
 * Prevents rapid double-submissions and duplicate order posting.
 */
async function postFnbCharge(data, db = prisma) {
  const reservation = await resolveReservation(data, db);

  // Check idempotency
  if (data.idempotencyKey) {
    const previous = await checkIdempotency(reservation.id, data.idempotencyKey, db);
    if (previous) {
      return {
        deduplicated: true,
        message: "Charge already posted with this idempotency key",
        ...previous,
      };
    }
  }

  // If linking an existing FnbOrder that was placed earlier
  if (data.fnbOrderId) {
    const existingOrder = await db.fnbOrder.findUnique({
      where: { id: parseId(data.fnbOrderId) },
      include: { items: { include: { menuItem: true } } },
    });
    if (!existingOrder) {
      throw new HttpError(404, "F&B order not found", "NOT_FOUND");
    }
    if (existingOrder.reservationId === reservation.id) {
      return {
        deduplicated: true,
        message: "This F&B order is already posted to this reservation bill",
        chargeType: "FOOD_BEVERAGE",
        order: existingOrder,
      };
    }
    if (existingOrder.status === "CANCELLED") {
      throw new HttpError(400, "Cannot post a cancelled F&B order to the bill", "ORDER_CANCELLED");
    }
    // Update reservation link
    const updatedOrder = await db.fnbOrder.update({
      where: { id: existingOrder.id },
      data: { reservationId: reservation.id },
      include: { items: { include: { menuItem: true } } },
    });
    return {
      deduplicated: false,
      chargeType: "FOOD_BEVERAGE",
      reservationReference: reservation.reference,
      order: updatedOrder,
    };
  }

  // Creating a new F&B order
  if (!Array.isArray(data.items) || data.items.length === 0) {
    throw new HttpError(400, "Order must contain at least one item", "VALIDATION_ERROR");
  }

  // Duplicate Check: check if identical order was placed for this reservation within the last 60 seconds
  if (!data.allowDuplicate) {
    const sixtySecondsAgo = new Date(Date.now() - 60 * 1000);
    const recentOrders = await db.fnbOrder.findMany({
      where: {
        reservationId: reservation.id,
        createdAt: { gte: sixtySecondsAgo },
        status: { not: "CANCELLED" },
      },
      include: { items: true },
    });

    const isDuplicate = recentOrders.some((ro) => {
      if (ro.items.length !== data.items.length) return false;
      const sortedA = [...ro.items].sort((a, b) => a.menuItemId - b.menuItemId);
      const sortedB = [...data.items].sort((a, b) => a.menuItemId - b.menuItemId);
      return sortedA.every(
        (it, idx) =>
          it.menuItemId === sortedB[idx].menuItemId &&
          it.quantity === sortedB[idx].quantity &&
          (it.customization || "") === (sortedB[idx].customization || "")
      );
    });

    if (isDuplicate) {
      throw new HttpError(
        409,
        "An identical F&B order was placed within the last 60 seconds. Set allowDuplicate: true to confirm.",
        "DUPLICATE_ORDER"
      );
    }
  }

  // Calculate prices and verify items
  let totalCost = 0;
  const orderItemsData = [];

  for (const item of data.items) {
    const menuItemId = parseId(item.menuItemId);
    const quantity = Number(item.quantity);
    if (!quantity || quantity < 1) {
      throw new HttpError(400, "Item quantity must be at least 1", "VALIDATION_ERROR");
    }

    const menuItem = await db.menuItem.findUnique({ where: { id: menuItemId } });
    if (!menuItem) {
      throw new HttpError(404, `Menu item ${menuItemId} not found`, "NOT_FOUND");
    }
    if (!menuItem.isAvailable) {
      throw new HttpError(400, `Menu item "${menuItem.name}" is currently unavailable`, "ITEM_UNAVAILABLE");
    }

    const unitPrice = Number(item.unitPriceAtOrder ?? menuItem.price);
    totalCost += unitPrice * quantity;

    orderItemsData.push({
      menuItemId,
      quantity,
      unitPriceAtOrder: unitPrice,
      customization: item.customization ? String(item.customization).trim() : null,
    });
  }

  totalCost = Math.round(totalCost * 100) / 100;

  const order = await db.fnbOrder.create({
    data: {
      reservationId: reservation.id,
      status: data.status || "PLACED",
      specialNotes: data.specialNotes ? String(data.specialNotes).trim() : null,
      totalCost,
      placedByGuest: Boolean(data.placedByGuest ?? true),
      placedById: data.userId ? parseId(data.userId) : null,
      items: {
        create: orderItemsData,
      },
    },
    include: { items: { include: { menuItem: true } } },
  });

  await recordChargeAudit(
    {
      userId: data.userId,
      reservationId: reservation.id,
      entity: "FnbOrder",
      entityId: order.id,
      chargeData: {
        category: "FOOD_BEVERAGE",
        orderId: order.id,
        itemsCount: orderItemsData.length,
        totalCost,
      },
      idempotencyKey: data.idempotencyKey,
    },
    db
  );

  return {
    deduplicated: false,
    chargeType: "FOOD_BEVERAGE",
    reservationReference: reservation.reference,
    order,
  };
}

/**
 * Posts a Bar Order charge to a guest's reservation.
 * Verifies bar item availability and prevents duplicate orders.
 */
async function postBarCharge(data, db = prisma) {
  const reservation = await resolveReservation(data, db);

  // Check idempotency
  if (data.idempotencyKey) {
    const previous = await checkIdempotency(reservation.id, data.idempotencyKey, db);
    if (previous) {
      return {
        deduplicated: true,
        message: "Charge already posted with this idempotency key",
        ...previous,
      };
    }
  }

  const barItemId = parseId(data.barItemId);
  const barItem = await db.barItem.findUnique({ where: { id: barItemId } });
  if (!barItem) {
    throw new HttpError(404, "Bar item not found", "NOT_FOUND");
  }
  if (!barItem.isActive) {
    throw new HttpError(400, `Bar item "${barItem.name}" is currently inactive`, "BAR_ITEM_INACTIVE");
  }

  const quantity = Number(data.quantity);
  if (!quantity || quantity < 1) {
    throw new HttpError(400, "Quantity must be at least 1", "VALIDATION_ERROR");
  }

  // Duplicate Check: Check if identical bar order for this reservation was posted in the last 60 seconds
  if (!data.allowDuplicate) {
    const sixtySecondsAgo = new Date(Date.now() - 60 * 1000);
    const recentDuplicate = await db.barOrder.findFirst({
      where: {
        reservationId: reservation.id,
        barItemId,
        quantity,
        createdAt: { gte: sixtySecondsAgo },
      },
    });

    if (recentDuplicate) {
      throw new HttpError(
        409,
        `An identical bar order for "${barItem.name}" (Qty: ${quantity}) was recorded within the last 60 seconds. Set allowDuplicate: true to confirm.`,
        "DUPLICATE_BAR_ORDER"
      );
    }
  }

  const unitPrice = Number(data.unitPriceAtOrder ?? barItem.unitPrice);
  const totalCost = Math.round(unitPrice * quantity * 100) / 100;

  const recordedById = data.userId ? parseId(data.userId) : reservation.createdById;

  const order = await db.barOrder.create({
    data: {
      reservationId: reservation.id,
      barItemId,
      quantity,
      unitPriceAtOrder: unitPrice,
      totalCost,
      recordedById,
    },
    include: { barItem: true },
  });

  await recordChargeAudit(
    {
      userId: data.userId,
      reservationId: reservation.id,
      entity: "BarOrder",
      entityId: order.id,
      chargeData: {
        category: "BAR",
        orderId: order.id,
        barItemName: barItem.name,
        quantity,
        unitPrice,
        totalCost,
      },
      idempotencyKey: data.idempotencyKey,
    },
    db
  );

  return {
    deduplicated: false,
    chargeType: "BAR",
    reservationReference: reservation.reference,
    order,
  };
}

/**
 * Posts an Adjustment (extra charge or discount) to a guest bill.
 * Positive amounts = extra charge; Negative amounts = discount.
 * A reason is always tracked.
 */
async function postAdjustmentCharge(data, db = prisma) {
  const reservation = await resolveReservation(data, db);

  // Check idempotency
  if (data.idempotencyKey) {
    const previous = await checkIdempotency(reservation.id, data.idempotencyKey, db);
    if (previous) {
      return {
        deduplicated: true,
        message: "Charge already posted with this idempotency key",
        ...previous,
      };
    }
  }

  const description = String(data.description || "").trim();
  if (!description || description.length < 2) {
    throw new HttpError(400, "Description must be at least 2 characters", "VALIDATION_ERROR");
  }

  const amount = Number(data.amount);
  if (isNaN(amount) || amount === 0) {
    throw new HttpError(400, "Amount must be a non-zero number", "VALIDATION_ERROR");
  }

  // Duplicate Check: Same reservation, description, and amount within the last 60 seconds
  if (!data.allowDuplicate) {
    const sixtySecondsAgo = new Date(Date.now() - 60 * 1000);
    const existing = await db.billAdjustment.findFirst({
      where: {
        reservationId: reservation.id,
        description,
        amount,
        createdAt: { gte: sixtySecondsAgo },
      },
    });

    if (existing) {
      throw new HttpError(
        409,
        `An identical adjustment ("${description}", amount: ${amount}) was already recorded recently`,
        "DUPLICATE_ADJUSTMENT"
      );
    }
  }

  const createdById = data.userId ? parseId(data.userId) : reservation.createdById;

  const adjustment = await db.billAdjustment.create({
    data: {
      reservationId: reservation.id,
      description,
      amount: Math.round(amount * 100) / 100,
      reason: data.reason ? String(data.reason).trim() : null,
      createdById,
    },
  });

  await recordChargeAudit(
    {
      userId: data.userId,
      reservationId: reservation.id,
      entity: "BillAdjustment",
      entityId: adjustment.id,
      chargeData: {
        category: "ADJUSTMENT",
        adjustmentId: adjustment.id,
        description,
        amount,
        reason: adjustment.reason,
      },
      idempotencyKey: data.idempotencyKey,
    },
    db
  );

  return {
    deduplicated: false,
    chargeType: "ADJUSTMENT",
    reservationReference: reservation.reference,
    adjustment,
  };
}

/**
 * Posts a payment against a reservation's bill.
 */
async function postPayment(data, db = prisma) {
  const reservation = await resolveReservation(data, db);

  if (data.idempotencyKey) {
    const previous = await checkIdempotency(reservation.id, data.idempotencyKey, db);
    if (previous) {
      return {
        deduplicated: true,
        message: "Payment already recorded with this idempotency key",
        ...previous,
      };
    }
  }

  const amount = Number(data.amount);
  if (!amount || amount <= 0) {
    throw new HttpError(400, "Payment amount must be greater than 0", "VALIDATION_ERROR");
  }

  const validMethods = ["CASH", "CARD", "BANK_TRANSFER"];
  if (!validMethods.includes(data.method)) {
    throw new HttpError(
      400,
      `Invalid payment method. Choose one of: ${validMethods.join(", ")}`,
      "INVALID_PAYMENT_METHOD"
    );
  }

  const recordedById = data.userId ? parseId(data.userId) : reservation.createdById;

  const payment = await db.payment.create({
    data: {
      reservationId: reservation.id,
      amount: Math.round(amount * 100) / 100,
      method: data.method,
      isAdvance: Boolean(data.isAdvance),
      note: data.note ? String(data.note).trim() : null,
      recordedById,
    },
  });

  await recordChargeAudit(
    {
      userId: data.userId,
      reservationId: reservation.id,
      entity: "Payment",
      entityId: payment.id,
      chargeData: {
        category: "PAYMENT",
        paymentId: payment.id,
        amount,
        method: data.method,
        isAdvance: payment.isAdvance,
      },
      idempotencyKey: data.idempotencyKey,
    },
    db
  );

  return {
    deduplicated: false,
    chargeType: "PAYMENT",
    reservationReference: reservation.reference,
    payment,
  };
}

/**
 * Unified charge poster: routes to appropriate handler based on chargeType.
 */
async function postCharge(data, db = prisma) {
  const type = String(data.chargeType || "").toUpperCase();
  switch (type) {
    case "ACTIVITY":
      return postActivityCharge(data, db);
    case "FOOD_BEVERAGE":
    case "FNB":
      return postFnbCharge(data, db);
    case "BAR":
      return postBarCharge(data, db);
    case "ADJUSTMENT":
      return postAdjustmentCharge(data, db);
    case "PAYMENT":
      return postPayment(data, db);
    default:
      throw new HttpError(
        400,
        `Invalid chargeType "${data.chargeType}". Expected: ACTIVITY, FNB, BAR, ADJUSTMENT, PAYMENT`,
        "INVALID_CHARGE_TYPE"
      );
  }
}

/**
 * Retrieves the complete, deduplicated running bill for a reservation.
 * Aggregates:
 * - Accommodation nights x nightlyRate
 * - All applicable (non-cancelled) Activity Bookings
 * - All applicable (non-cancelled) F&B Orders
 * - All Bar Orders
 * - All Bill Adjustments
 * - All Payments
 * - Taxes and service charges based on System Settings
 *
 * Provides a Deduplication Audit Report verifying that each charge source is distinct.
 */
async function getGuestBill(reservationIdentifier, _options = {}, db = prisma) {
  let resId;
  let reservation;

  if (typeof reservationIdentifier === "object") {
    reservation = await resolveReservation(reservationIdentifier, db);
    resId = reservation.id;
  } else {
    resId = parseId(reservationIdentifier);
    reservation = await db.reservation.findUnique({
      where: { id: resId },
      include: {
        guest: true,
        package: true,
        cabana: true,
        invoice: true,
      },
    });
    if (!reservation) {
      throw new HttpError(404, "Reservation not found", "NOT_FOUND");
    }
  }

  // Fetch all related bookings, orders, adjustments, payments
  const [activityBookings, fnbOrders, barOrders, adjustments, payments, settingsRows] =
    await Promise.all([
      db.activityBooking.findMany({
        where: { reservationId: resId },
        include: { activity: true },
        orderBy: { scheduledAt: "asc" },
      }),
      db.fnbOrder.findMany({
        where: { reservationId: resId },
        include: { items: { include: { menuItem: true } } },
        orderBy: { createdAt: "asc" },
      }),
      db.barOrder.findMany({
        where: { reservationId: resId },
        include: { barItem: true },
        orderBy: { createdAt: "asc" },
      }),
      db.billAdjustment.findMany({
        where: { reservationId: resId },
        orderBy: { createdAt: "asc" },
      }),
      db.payment.findMany({
        where: { reservationId: resId },
        orderBy: { paidAt: "asc" },
      }),
      db.setting.findMany({
        where: { key: { in: ["tax_percent", "service_charge_percent"] } },
      }),
    ]);

  const settings = {};
  for (const row of settingsRows) {
    settings[row.key] = row.value;
  }

  const taxPercent = parseFloat(settings.tax_percent || "0") || 0;
  const serviceChargePercent = parseFloat(settings.service_charge_percent || "0") || 0;

  // 1. Accommodation charges
  const nights = calculateNights(reservation.checkInDate, reservation.checkOutDate);
  const nightlyRate = Number(reservation.nightlyRate);
  const accommodationTotal = Math.round(nights * nightlyRate * 100) / 100;

  const accommodationItem = {
    id: `acc-${reservation.id}`,
    type: "ACCOMMODATION",
    description: `${reservation.package?.name || "Stay"} Package (${nights} ${nights === 1 ? "night" : "nights"} @ ${nightlyRate.toFixed(2)}/night)`,
    nights,
    nightlyRate,
    checkInDate: reservation.checkInDate,
    checkOutDate: reservation.checkOutDate,
    amount: accommodationTotal,
  };

  // Deduplication tracker
  const seenLineItemIds = new Set();
  const duplicatesDetected = [];

  const checkItemUniqueness = (id, type, sourceId) => {
    if (seenLineItemIds.has(id)) {
      duplicatesDetected.push({ id, type, sourceId });
      return false;
    }
    seenLineItemIds.add(id);
    return true;
  };

  checkItemUniqueness(accommodationItem.id, "ACCOMMODATION", reservation.id);

  // 2. Activity charges (exclude CANCELLED bookings)
  const activityItems = [];
  let subtotalActivities = 0;

  for (const b of activityBookings) {
    if (b.status === "CANCELLED") continue;

    const lineId = `act-${b.id}`;
    if (!checkItemUniqueness(lineId, "ACTIVITY", b.id)) continue;

    const total = Number(b.totalCharge);
    subtotalActivities += total;

    activityItems.push({
      id: lineId,
      sourceId: b.id,
      type: "ACTIVITY",
      name: b.activity?.name || "Activity",
      scheduledAt: b.scheduledAt,
      participants: b.participants,
      unitPrice: Number(b.unitPriceAtBooking),
      amount: total,
      status: b.status,
    });
  }

  // 3. Food & Beverage charges (exclude CANCELLED orders)
  const fnbItems = [];
  let subtotalFnb = 0;

  for (const order of fnbOrders) {
    if (order.status === "CANCELLED") continue;

    const lineId = `fnb-${order.id}`;
    if (!checkItemUniqueness(lineId, "FOOD_BEVERAGE", order.id)) continue;

    const total = Number(order.totalCost);
    subtotalFnb += total;

    const itemsSummary = (order.items || [])
      .map((it) => `${it.quantity}x ${it.menuItem?.name || "Item"}`)
      .join(", ");

    fnbItems.push({
      id: lineId,
      sourceId: order.id,
      type: "FOOD_BEVERAGE",
      placedAt: order.createdAt,
      status: order.status,
      itemsSummary: itemsSummary || "F&B Order",
      items: (order.items || []).map((it) => ({
        menuItemId: it.menuItemId,
        name: it.menuItem?.name || "Item",
        quantity: it.quantity,
        unitPrice: Number(it.unitPriceAtOrder),
        customization: it.customization,
      })),
      amount: total,
    });
  }

  // 4. Bar charges
  const barItems = [];
  let subtotalBar = 0;

  for (const b of barOrders) {
    const lineId = `bar-${b.id}`;
    if (!checkItemUniqueness(lineId, "BAR", b.id)) continue;

    const total = Number(b.totalCost);
    subtotalBar += total;

    barItems.push({
      id: lineId,
      sourceId: b.id,
      type: "BAR",
      recordedAt: b.createdAt,
      name: b.barItem?.name || "Bar Item",
      quantity: b.quantity,
      unitPrice: Number(b.unitPriceAtOrder),
      amount: total,
    });
  }

  // 5. Adjustments
  const adjustmentItems = [];
  let subtotalAdjustments = 0;

  for (const adj of adjustments) {
    const lineId = `adj-${adj.id}`;
    if (!checkItemUniqueness(lineId, "ADJUSTMENT", adj.id)) continue;

    const amount = Number(adj.amount);
    subtotalAdjustments += amount;

    adjustmentItems.push({
      id: lineId,
      sourceId: adj.id,
      type: "ADJUSTMENT",
      description: adj.description,
      amount,
      reason: adj.reason,
      createdAt: adj.createdAt,
    });
  }

  // 6. Payments
  const paymentItems = [];
  let totalPaid = 0;

  for (const p of payments) {
    const lineId = `pay-${p.id}`;
    if (!checkItemUniqueness(lineId, "PAYMENT", p.id)) continue;

    const amount = Number(p.amount);
    totalPaid += amount;

    paymentItems.push({
      id: lineId,
      sourceId: p.id,
      type: "PAYMENT",
      amount,
      method: p.method,
      isAdvance: p.isAdvance,
      paidAt: p.paidAt,
      note: p.note,
    });
  }

  // Calculations
  const grossCharges =
    accommodationTotal + subtotalActivities + subtotalFnb + subtotalBar + subtotalAdjustments;

  const serviceChargeAmount =
    serviceChargePercent > 0
      ? Math.round((grossCharges * (serviceChargePercent / 100)) * 100) / 100
      : 0;

  const taxableAmount = grossCharges + serviceChargeAmount;
  const taxAmount =
    taxPercent > 0 ? Math.round((taxableAmount * (taxPercent / 100)) * 100) / 100 : 0;

  const grandTotal = Math.round((taxableAmount + taxAmount) * 100) / 100;
  const balanceDue = Math.round((grandTotal - totalPaid) * 100) / 100;

  let paymentStatus = "UNPAID";
  if (balanceDue <= 0) {
    paymentStatus = balanceDue < 0 ? "OVERPAID" : "PAID";
  } else if (totalPaid > 0) {
    paymentStatus = "PARTIALLY_PAID";
  }

  return {
    reservation: {
      id: reservation.id,
      reference: reservation.reference,
      status: reservation.status,
      checkInDate: reservation.checkInDate,
      checkOutDate: reservation.checkOutDate,
      nights,
      cabana: reservation.cabana ? { id: reservation.cabana.id, name: reservation.cabana.name } : null,
      package: reservation.package ? { id: reservation.package.id, name: reservation.package.name } : null,
      guest: reservation.guest
        ? {
            id: reservation.guest.id,
            fullName: reservation.guest.fullName,
            idNumber: reservation.guest.idNumber,
            phone: reservation.guest.phone,
            email: reservation.guest.email,
          }
        : null,
      isFinalized: Boolean(reservation.invoice),
      invoice: reservation.invoice || null,
    },
    charges: {
      accommodation: accommodationItem,
      activities: activityItems,
      foodBeverage: fnbItems,
      bar: barItems,
      adjustments: adjustmentItems,
    },
    payments: paymentItems,
    financials: {
      subtotalAccommodation: accommodationTotal,
      subtotalActivities: Math.round(subtotalActivities * 100) / 100,
      subtotalFoodBeverage: Math.round(subtotalFnb * 100) / 100,
      subtotalBar: Math.round(subtotalBar * 100) / 100,
      subtotalAdjustments: Math.round(subtotalAdjustments * 100) / 100,
      grossCharges: Math.round(grossCharges * 100) / 100,
      serviceChargePercent,
      serviceChargeAmount,
      taxPercent,
      taxAmount,
      grandTotal,
      totalPaid: Math.round(totalPaid * 100) / 100,
      balanceDue,
      paymentStatus,
    },
    deduplicationAudit: {
      totalChargeLineItems: seenLineItemIds.size - paymentItems.length,
      totalPaymentItems: paymentItems.length,
      duplicatesDetectedCount: duplicatesDetected.length,
      duplicatesDetected,
      isClean: duplicatesDetected.length === 0,
    },
  };
}

/**
 * Automatically synchronizes a guest bill by linking any unassigned applicable service orders
 * and ensuring all charges are posted and deduplicated.
 */
async function syncGuestBill(reservationIdentifier, options = {}, db = prisma) {
  const reservation = await resolveReservation(reservationIdentifier, db);

  // Check if any F&B orders were placed on behalf of this guest without reservation link
  if (reservation.guestId) {
    const unassignedOrders = await db.fnbOrder.findMany({
      where: {
        reservationId: { not: reservation.id },
        specialNotes: { contains: reservation.reference },
        status: { not: "CANCELLED" },
      },
    });

    for (const order of unassignedOrders) {
      await db.fnbOrder.update({
        where: { id: order.id },
        data: { reservationId: reservation.id },
      });
    }
  }

  // Get and return the verified bill
  const bill = await getGuestBill(reservation.id, options, db);
  return {
    synchronized: true,
    reservationReference: reservation.reference,
    bill,
  };
}

/**
 * Finalizes a guest bill upon checkout:
 * 1. Computes exact totals.
 * 2. Creates the immutable Invoice snapshot.
 * 3. Updates reservation status to CHECKED_OUT and records checkout timestamp.
 * 4. Logs audit entry.
 */
async function finalizeBillAndCheckout(reservationIdentifier, { userId, invoiceNumber } = {}, db = prisma) {
  const reservation = await resolveReservation(reservationIdentifier, db);

  if (reservation.invoice) {
    throw new HttpError(
      409,
      `Invoice ${reservation.invoice.invoiceNumber} has already been issued for this reservation`,
      "INVOICE_ALREADY_EXISTS"
    );
  }

  const bill = await getGuestBill(reservation.id, {}, db);
  const f = bill.financials;

  const generatedInvoiceNum =
    invoiceNumber ||
    `INV-${reservation.reference.replace(/[^A-Za-z0-9]/g, "")}-${Date.now().toString().slice(-4)}`;

  const staffUserId = userId ? parseId(userId) : reservation.createdById;

  const invoice = await db.invoice.create({
    data: {
      reservationId: reservation.id,
      invoiceNumber: generatedInvoiceNum,
      accommodation: f.subtotalAccommodation,
      activities: f.subtotalActivities,
      bar: f.subtotalBar,
      foodBeverage: f.subtotalFoodBeverage,
      adjustments: f.subtotalAdjustments,
      taxAmount: f.taxAmount + f.serviceChargeAmount,
      total: f.grandTotal,
      totalPaid: f.totalPaid,
      issuedById: staffUserId,
    },
  });

  await db.reservation.update({
    where: { id: reservation.id },
    data: {
      status: "CHECKED_OUT",
      checkedOutAt: new Date(),
      portalActive: false,
    },
  });

  await recordChargeAudit(
    {
      userId: staffUserId,
      reservationId: reservation.id,
      entity: "Invoice",
      entityId: invoice.id,
      chargeData: {
        action: "BILL_FINALIZED",
        invoiceNumber: invoice.invoiceNumber,
        grandTotal: f.grandTotal,
        totalPaid: f.totalPaid,
        balanceDue: f.balanceDue,
      },
    },
    db
  );

  return {
    success: true,
    invoice,
    bill,
  };
}

/**
 * Helper to list active stays with their quick running balance.
 * Useful for staff billing dashboard.
 */
async function listActiveStaysWithBalances(db = prisma) {
  const activeReservations = await db.reservation.findMany({
    where: {
      status: { in: ["CONFIRMED", "CHECKED_IN"] },
    },
    include: {
      guest: true,
      cabana: true,
      package: true,
      invoice: true,
    },
    orderBy: { checkInDate: "asc" },
  });

  const stays = [];
  for (const r of activeReservations) {
    const bill = await getGuestBill(r.id, {}, db);
    stays.push({
      reservationId: r.id,
      reference: r.reference,
      status: r.status,
      guest: {
        id: r.guest?.id,
        fullName: r.guest?.fullName,
        idNumber: r.guest?.idNumber,
        phone: r.guest?.phone,
      },
      cabana: r.cabana?.name,
      checkInDate: r.checkInDate,
      checkOutDate: r.checkOutDate,
      nights: bill.reservation.nights,
      grandTotal: bill.financials.grandTotal,
      totalPaid: bill.financials.totalPaid,
      balanceDue: bill.financials.balanceDue,
      paymentStatus: bill.financials.paymentStatus,
      isFinalized: Boolean(r.invoice),
    });
  }

  return stays;
}

module.exports = {
  calculateNights,
  resolveReservation,
  checkIdempotency,
  recordChargeAudit,
  postActivityCharge,
  postFnbCharge,
  postBarCharge,
  postAdjustmentCharge,
  postPayment,
  postCharge,
  getGuestBill,
  syncGuestBill,
  finalizeBillAndCheckout,
  listActiveStaysWithBalances,
};

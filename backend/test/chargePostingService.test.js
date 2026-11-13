const test = require("node:test");
const assert = require("node:assert");
const chargePostingService = require("../src/services/chargePostingService");

/**
 * Creates an in-memory mock database conforming to Prisma's API
 * for comprehensive testing of charge posting logic, duplicate prevention,
 * and bill calculations.
 */
function createMockDb(initialData = {}) {
  const db = {
    reservations: [...(initialData.reservations || [])],
    guests: [...(initialData.guests || [])],
    cabanas: [...(initialData.cabanas || [{ id: 1, name: "The River Cabana", maxGuests: 6 }])],
    packages: [...(initialData.packages || [{ id: 1, name: "Couple", pricePerNight: 15000, maxAdults: 2 }])],
    activities: [
      ...(initialData.activities || [
        { id: 1, name: "Safari River Tour", unitPrice: 5000, maxParticipants: 8, isActive: true },
        { id: 2, name: "Inactive Kayak", unitPrice: 3000, maxParticipants: 4, isActive: false },
      ]),
    ],
    activityBookings: [...(initialData.activityBookings || [])],
    menuItems: [
      ...(initialData.menuItems || [
        { id: 1, name: "Rice & Curry", price: 2200, isAvailable: true },
        { id: 2, name: "Grilled Fish", price: 3500, isAvailable: true },
        { id: 3, name: "Unavailable Dish", price: 1800, isAvailable: false },
      ]),
    ],
    fnbOrders: [...(initialData.fnbOrders || [])],
    fnbOrderItems: [...(initialData.fnbOrderItems || [])],
    barItems: [
      ...(initialData.barItems || [
        { id: 1, name: "Lion Beer", unitPrice: 900, isActive: true },
        { id: 2, name: "Cocktail", unitPrice: 1800, isActive: true },
        { id: 3, name: "Inactive Wine", unitPrice: 4000, isActive: false },
      ]),
    ],
    barOrders: [...(initialData.barOrders || [])],
    adjustments: [...(initialData.adjustments || [])],
    payments: [...(initialData.payments || [])],
    invoices: [...(initialData.invoices || [])],
    settings: [
      ...(initialData.settings || [
        { key: "tax_percent", value: "10" },
        { key: "service_charge_percent", value: "5" },
      ]),
    ],
    auditLogs: [...(initialData.auditLogs || [])],
  };

  let autoId = 100;

  return {
    reservation: {
      findUnique: async ({ where }) => {
        const r = db.reservations.find(
          (x) => (where.id && x.id === where.id) || (where.reference && x.reference === where.reference)
        );
        if (!r) return null;
        return {
          ...r,
          guest: db.guests.find((g) => g.id === r.guestId) || null,
          package: db.packages.find((p) => p.id === r.packageId) || null,
          cabana: db.cabanas.find((c) => c.id === r.cabanaId) || null,
          invoice: db.invoices.find((i) => i.reservationId === r.id) || null,
        };
      },
      findFirst: async ({ where }) => {
        const matches = db.reservations.filter((r) => {
          if (where.cabanaId && r.cabanaId !== where.cabanaId) return false;
          if (where.guestId && r.guestId !== where.guestId) return false;
          if (where.status?.in && !where.status.in.includes(r.status)) return false;
          return true;
        });
        const r = matches[0];
        if (!r) return null;
        return {
          ...r,
          guest: db.guests.find((g) => g.id === r.guestId) || null,
          package: db.packages.find((p) => p.id === r.packageId) || null,
          cabana: db.cabanas.find((c) => c.id === r.cabanaId) || null,
          invoice: db.invoices.find((i) => i.reservationId === r.id) || null,
        };
      },
      findMany: async ({ where }) => {
        return db.reservations
          .filter((r) => {
            if (where?.status?.in && !where.status.in.includes(r.status)) return false;
            if (where?.guestId && r.guestId !== where.guestId) return false;
            return true;
          })
          .map((r) => ({
            ...r,
            guest: db.guests.find((g) => g.id === r.guestId) || null,
            package: db.packages.find((p) => p.id === r.packageId) || null,
            cabana: db.cabanas.find((c) => c.id === r.cabanaId) || null,
            invoice: db.invoices.find((i) => i.reservationId === r.id) || null,
          }));
      },
      update: async ({ where, data }) => {
        const idx = db.reservations.findIndex((r) => r.id === where.id);
        if (idx === -1) throw new Error("Reservation not found");
        db.reservations[idx] = { ...db.reservations[idx], ...data };
        return db.reservations[idx];
      },
    },
    activity: {
      findUnique: async ({ where }) => db.activities.find((a) => a.id === where.id) || null,
    },
    activityBooking: {
      findFirst: async ({ where }) => {
        return (
          db.activityBookings.find((b) => {
            if (where.reservationId && b.reservationId !== where.reservationId) return false;
            if (where.activityId && b.activityId !== where.activityId) return false;
            if (where.scheduledAt && new Date(b.scheduledAt).getTime() !== new Date(where.scheduledAt).getTime())
              return false;
            if (where.status?.not && b.status === where.status.not) return false;
            return true;
          }) || null
        );
      },
      findMany: async ({ where }) => {
        return db.activityBookings
          .filter((b) => b.reservationId === where.reservationId)
          .map((b) => ({
            ...b,
            activity: db.activities.find((a) => a.id === b.activityId) || null,
          }));
      },
      create: async ({ data }) => {
        const newRecord = { id: ++autoId, ...data, createdAt: new Date() };
        db.activityBookings.push(newRecord);
        return {
          ...newRecord,
          activity: db.activities.find((a) => a.id === newRecord.activityId) || null,
        };
      },
    },
    menuItem: {
      findUnique: async ({ where }) => db.menuItems.find((m) => m.id === where.id) || null,
    },
    fnbOrder: {
      findUnique: async ({ where }) => {
        const order = db.fnbOrders.find((o) => o.id === where.id);
        if (!order) return null;
        return {
          ...order,
          items: db.fnbOrderItems
            .filter((it) => it.orderId === order.id)
            .map((it) => ({
              ...it,
              menuItem: db.menuItems.find((m) => m.id === it.menuItemId) || null,
            })),
        };
      },
      findMany: async ({ where }) => {
        return db.fnbOrders
          .filter((o) => {
            if (where.reservationId && o.reservationId !== where.reservationId) return false;
            if (where.status?.not && o.status === where.status.not) return false;
            if (where.createdAt?.gte && new Date(o.createdAt) < new Date(where.createdAt.gte)) return false;
            return true;
          })
          .map((o) => ({
            ...o,
            items: db.fnbOrderItems
              .filter((it) => it.orderId === o.id)
              .map((it) => ({
                ...it,
                menuItem: db.menuItems.find((m) => m.id === it.menuItemId) || null,
              })),
          }));
      },
      create: async ({ data }) => {
        const orderId = ++autoId;
        const newOrder = {
          id: orderId,
          reservationId: data.reservationId,
          status: data.status || "PLACED",
          specialNotes: data.specialNotes || null,
          totalCost: data.totalCost,
          placedByGuest: data.placedByGuest,
          placedById: data.placedById || null,
          createdAt: new Date(),
        };
        db.fnbOrders.push(newOrder);

        const items = [];
        if (data.items?.create) {
          for (const itemData of data.items.create) {
            const newItem = { id: ++autoId, orderId, ...itemData };
            db.fnbOrderItems.push(newItem);
            items.push({
              ...newItem,
              menuItem: db.menuItems.find((m) => m.id === newItem.menuItemId) || null,
            });
          }
        }
        return { ...newOrder, items };
      },
      update: async ({ where, data }) => {
        const idx = db.fnbOrders.findIndex((o) => o.id === where.id);
        if (idx === -1) throw new Error("Order not found");
        db.fnbOrders[idx] = { ...db.fnbOrders[idx], ...data };
        return {
          ...db.fnbOrders[idx],
          items: db.fnbOrderItems
            .filter((it) => it.orderId === db.fnbOrders[idx].id)
            .map((it) => ({
              ...it,
              menuItem: db.menuItems.find((m) => m.id === it.menuItemId) || null,
            })),
        };
      },
    },
    barItem: {
      findUnique: async ({ where }) => db.barItems.find((b) => b.id === where.id) || null,
    },
    barOrder: {
      findFirst: async ({ where }) => {
        return (
          db.barOrders.find((b) => {
            if (where.reservationId && b.reservationId !== where.reservationId) return false;
            if (where.barItemId && b.barItemId !== where.barItemId) return false;
            if (where.quantity && b.quantity !== where.quantity) return false;
            if (where.createdAt?.gte && new Date(b.createdAt) < new Date(where.createdAt.gte)) return false;
            return true;
          }) || null
        );
      },
      findMany: async ({ where }) => {
        return db.barOrders
          .filter((b) => b.reservationId === where.reservationId)
          .map((b) => ({
            ...b,
            barItem: db.barItems.find((bi) => bi.id === b.barItemId) || null,
          }));
      },
      create: async ({ data }) => {
        const newRecord = { id: ++autoId, ...data, createdAt: new Date() };
        db.barOrders.push(newRecord);
        return {
          ...newRecord,
          barItem: db.barItems.find((bi) => bi.id === newRecord.barItemId) || null,
        };
      },
    },
    billAdjustment: {
      findFirst: async ({ where }) => {
        return (
          db.adjustments.find((a) => {
            if (where.reservationId && a.reservationId !== where.reservationId) return false;
            if (where.description && a.description !== where.description) return false;
            if (where.amount && a.amount !== where.amount) return false;
            if (where.createdAt?.gte && new Date(a.createdAt) < new Date(where.createdAt.gte)) return false;
            return true;
          }) || null
        );
      },
      findMany: async ({ where }) => {
        return db.adjustments.filter((a) => a.reservationId === where.reservationId);
      },
      create: async ({ data }) => {
        const newRecord = { id: ++autoId, ...data, createdAt: new Date() };
        db.adjustments.push(newRecord);
        return newRecord;
      },
    },
    payment: {
      findMany: async ({ where }) => {
        return db.payments.filter((p) => p.reservationId === where.reservationId);
      },
      create: async ({ data }) => {
        const newRecord = { id: ++autoId, ...data, paidAt: new Date() };
        db.payments.push(newRecord);
        return newRecord;
      },
    },
    invoice: {
      create: async ({ data }) => {
        const newRecord = { id: ++autoId, ...data, issuedAt: new Date() };
        db.invoices.push(newRecord);
        return newRecord;
      },
    },
    setting: {
      findMany: async ({ where }) => {
        if (!where?.key?.in) return db.settings;
        return db.settings.filter((s) => where.key.in.includes(s.key));
      },
    },
    auditLog: {
      findFirst: async ({ where }) => {
        return (
          db.auditLogs.find((l) => {
            if (where.action && l.action !== where.action) return false;
            if (where.entity && l.entity !== where.entity) return false;
            if (where.entityId && l.entityId !== where.entityId) return false;
            if (where.newValue?.equals && l.newValue?.idempotencyKey !== where.newValue.equals) return false;
            return true;
          }) || null
        );
      },
      create: async ({ data }) => {
        const newRecord = { id: ++autoId, ...data, createdAt: new Date() };
        db.auditLogs.push(newRecord);
        return newRecord;
      },
    },
  };
}

// ----------------- TEST SUITE -----------------

test("calculateNights correctly computes stay length", () => {
  assert.strictEqual(chargePostingService.calculateNights("2026-11-10", "2026-11-11"), 1);
  assert.strictEqual(chargePostingService.calculateNights("2026-11-10", "2026-11-15"), 5);
  // Same day or zero difference defaults to minimum 1 night
  assert.strictEqual(chargePostingService.calculateNights("2026-11-10", "2026-11-10"), 1);
});

test("resolveReservation resolves by reservationId, reference, guestId, and cabanaId", async () => {
  const mockDb = createMockDb({
    guests: [{ id: 10, fullName: "John Doe", idNumber: "NIC100" }],
    reservations: [
      {
        id: 1,
        reference: "RFH-1001",
        guestId: 10,
        cabanaId: 1,
        packageId: 1,
        status: "CHECKED_IN",
        checkInDate: new Date("2026-11-10"),
        checkOutDate: new Date("2026-11-13"),
        nightlyRate: 15000,
        createdById: 1,
      },
    ],
  });

  // By ID
  const r1 = await chargePostingService.resolveReservation({ reservationId: 1 }, mockDb);
  assert.strictEqual(r1.id, 1);
  assert.strictEqual(r1.reference, "RFH-1001");

  // By Reference
  const r2 = await chargePostingService.resolveReservation({ reservationReference: "RFH-1001" }, mockDb);
  assert.strictEqual(r2.id, 1);

  // By Guest ID
  const r3 = await chargePostingService.resolveReservation({ guestId: 10 }, mockDb);
  assert.strictEqual(r3.id, 1);

  // By Cabana ID
  const r4 = await chargePostingService.resolveReservation({ cabanaId: 1 }, mockDb);
  assert.strictEqual(r4.id, 1);
});

test("resolveReservation enforces guest association and rejects mismatches", async () => {
  const mockDb = createMockDb({
    guests: [
      { id: 10, fullName: "John Doe", idNumber: "NIC100" },
      { id: 20, fullName: "Jane Smith", idNumber: "NIC200" },
    ],
    reservations: [
      {
        id: 1,
        reference: "RFH-1001",
        guestId: 10,
        cabanaId: 1,
        packageId: 1,
        status: "CONFIRMED",
        checkInDate: new Date("2026-11-10"),
        checkOutDate: new Date("2026-11-12"),
        nightlyRate: 15000,
        createdById: 1,
      },
    ],
  });

  // Valid match
  const r = await chargePostingService.resolveReservation({ reservationId: 1, guestId: 10 }, mockDb);
  assert.strictEqual(r.id, 1);

  // Mismatch: trying to charge reservation 1 to guest 20
  await assert.rejects(
    async () => {
      await chargePostingService.resolveReservation({ reservationId: 1, guestId: 20 }, mockDb);
    },
    {
      code: "GUEST_RESERVATION_MISMATCH",
    }
  );
});

test("resolveReservation rejects charges on CANCELLED, NO_SHOW, or closed bills", async () => {
  const mockDb = createMockDb({
    guests: [{ id: 10, fullName: "Guest" }],
    reservations: [
      {
        id: 2,
        reference: "RFH-CANCELLED",
        guestId: 10,
        status: "CANCELLED",
        checkInDate: new Date(),
        checkOutDate: new Date(),
        nightlyRate: 10000,
      },
      {
        id: 3,
        reference: "RFH-NOSHOW",
        guestId: 10,
        status: "NO_SHOW",
        checkInDate: new Date(),
        checkOutDate: new Date(),
        nightlyRate: 10000,
      },
      {
        id: 4,
        reference: "RFH-CLOSED",
        guestId: 10,
        status: "CHECKED_OUT",
        checkInDate: new Date(),
        checkOutDate: new Date(),
        nightlyRate: 10000,
      },
    ],
    invoices: [{ id: 50, reservationId: 4, invoiceNumber: "INV-RFH-CLOSED-001" }],
  });

  await assert.rejects(
    async () => chargePostingService.resolveReservation({ reservationId: 2 }, mockDb),
    { code: "RESERVATION_CANCELLED" }
  );

  await assert.rejects(
    async () => chargePostingService.resolveReservation({ reservationId: 3 }, mockDb),
    { code: "RESERVATION_NO_SHOW" }
  );

  await assert.rejects(
    async () => chargePostingService.resolveReservation({ reservationId: 4 }, mockDb),
    { code: "BILL_ALREADY_CLOSED" }
  );
});

test("postActivityCharge adds activity charge and prevents duplicates", async () => {
  const mockDb = createMockDb({
    guests: [{ id: 10, fullName: "Guest" }],
    reservations: [
      {
        id: 1,
        reference: "RFH-1001",
        guestId: 10,
        cabanaId: 1,
        packageId: 1,
        status: "CHECKED_IN",
        checkInDate: new Date("2026-11-10"),
        checkOutDate: new Date("2026-11-13"),
        nightlyRate: 15000,
      },
    ],
  });

  const scheduled = "2026-11-11T09:00:00Z";

  // 1. Successful posting
  const res1 = await chargePostingService.postActivityCharge(
    {
      reservationId: 1,
      activityId: 1,
      scheduledAt: scheduled,
      participants: 2,
    },
    mockDb
  );

  assert.strictEqual(res1.deduplicated, false);
  assert.strictEqual(res1.chargeType, "ACTIVITY");
  assert.strictEqual(res1.booking.totalCharge, 10000); // 2 * 5000

  // 2. Duplicate posting attempt for same activity and same scheduled time
  await assert.rejects(
    async () => {
      await chargePostingService.postActivityCharge(
        {
          reservationId: 1,
          activityId: 1,
          scheduledAt: scheduled,
          participants: 2,
        },
        mockDb
      );
    },
    {
      code: "DUPLICATE_ACTIVITY_BOOKING",
    }
  );

  // 3. Inactive activity rejection
  await assert.rejects(
    async () => {
      await chargePostingService.postActivityCharge(
        {
          reservationId: 1,
          activityId: 2, // inactive
          scheduledAt: "2026-11-12T09:00:00Z",
          participants: 2,
        },
        mockDb
      );
    },
    {
      code: "ACTIVITY_INACTIVE",
    }
  );

  // 4. Exceed max participants
  await assert.rejects(
    async () => {
      await chargePostingService.postActivityCharge(
        {
          reservationId: 1,
          activityId: 1,
          scheduledAt: "2026-11-12T09:00:00Z",
          participants: 20, // max is 8
        },
        mockDb
      );
    },
    {
      code: "MAX_PARTICIPANTS_EXCEEDED",
    }
  );
});

test("postFnbCharge adds food & beverage order and prevents duplicates", async () => {
  const mockDb = createMockDb({
    guests: [{ id: 10, fullName: "Guest" }],
    reservations: [
      {
        id: 1,
        reference: "RFH-1001",
        guestId: 10,
        cabanaId: 1,
        packageId: 1,
        status: "CHECKED_IN",
        checkInDate: new Date("2026-11-10"),
        checkOutDate: new Date("2026-11-13"),
        nightlyRate: 15000,
      },
    ],
  });

  const orderItems = [
    { menuItemId: 1, quantity: 2 }, // 2 * 2200 = 4400
    { menuItemId: 2, quantity: 1, customization: "Medium spicy" }, // 1 * 3500 = 3500
  ];

  // 1. Post new order
  const res1 = await chargePostingService.postFnbCharge(
    {
      reservationId: 1,
      items: orderItems,
      specialNotes: "Serve at cabana terrace",
    },
    mockDb
  );

  assert.strictEqual(res1.deduplicated, false);
  assert.strictEqual(res1.chargeType, "FOOD_BEVERAGE");
  assert.strictEqual(res1.order.totalCost, 7900); // 4400 + 3500

  // 2. Immediate duplicate order within 60s
  await assert.rejects(
    async () => {
      await chargePostingService.postFnbCharge(
        {
          reservationId: 1,
          items: orderItems,
        },
        mockDb
      );
    },
    {
      code: "DUPLICATE_ORDER",
    }
  );

  // 3. If allowDuplicate: true, allowed
  const res2 = await chargePostingService.postFnbCharge(
    {
      reservationId: 1,
      items: orderItems,
      allowDuplicate: true,
    },
    mockDb
  );
  assert.strictEqual(res2.order.totalCost, 7900);

  // 4. Reject unavailable dish
  await assert.rejects(
    async () => {
      await chargePostingService.postFnbCharge(
        {
          reservationId: 1,
          items: [{ menuItemId: 3, quantity: 1 }],
        },
        mockDb
      );
    },
    {
      code: "ITEM_UNAVAILABLE",
    }
  );
});

test("postBarCharge adds bar orders and prevents rapid duplicate orders", async () => {
  const mockDb = createMockDb({
    guests: [{ id: 10, fullName: "Guest" }],
    reservations: [
      {
        id: 1,
        reference: "RFH-1001",
        guestId: 10,
        cabanaId: 1,
        packageId: 1,
        status: "CHECKED_IN",
        checkInDate: new Date("2026-11-10"),
        checkOutDate: new Date("2026-11-13"),
        nightlyRate: 15000,
      },
    ],
  });

  // 1. Post bar charge
  const res1 = await chargePostingService.postBarCharge(
    {
      reservationId: 1,
      barItemId: 1, // 900
      quantity: 3, // 2700
    },
    mockDb
  );

  assert.strictEqual(res1.deduplicated, false);
  assert.strictEqual(res1.chargeType, "BAR");
  assert.strictEqual(res1.order.totalCost, 2700);

  // 2. Reject duplicate within 60 seconds
  await assert.rejects(
    async () => {
      await chargePostingService.postBarCharge(
        {
          reservationId: 1,
          barItemId: 1,
          quantity: 3,
        },
        mockDb
      );
    },
    {
      code: "DUPLICATE_BAR_ORDER",
    }
  );

  // 3. Reject inactive bar item
  await assert.rejects(
    async () => {
      await chargePostingService.postBarCharge(
        {
          reservationId: 1,
          barItemId: 3, // inactive
          quantity: 1,
        },
        mockDb
      );
    },
    {
      code: "BAR_ITEM_INACTIVE",
    }
  );
});

test("postAdjustmentCharge supports surcharges, discounts, and deduplication", async () => {
  const mockDb = createMockDb({
    guests: [{ id: 10, fullName: "Guest" }],
    reservations: [
      {
        id: 1,
        reference: "RFH-1001",
        guestId: 10,
        status: "CHECKED_IN",
        checkInDate: new Date("2026-11-10"),
        checkOutDate: new Date("2026-11-13"),
        nightlyRate: 15000,
      },
    ],
  });

  // 1. Extra charge (surcharge)
  const adj1 = await chargePostingService.postAdjustmentCharge(
    {
      reservationId: 1,
      description: "Late checkout fee",
      amount: 2500,
      reason: "Departing at 16:00",
    },
    mockDb
  );
  assert.strictEqual(adj1.adjustment.amount, 2500);

  // 2. Discount
  const adj2 = await chargePostingService.postAdjustmentCharge(
    {
      reservationId: 1,
      description: "VIP Courtesy Discount",
      amount: -1000,
      reason: "Loyalty guest",
    },
    mockDb
  );
  assert.strictEqual(adj2.adjustment.amount, -1000);

  // 3. Deduplication rejection
  await assert.rejects(
    async () => {
      await chargePostingService.postAdjustmentCharge(
        {
          reservationId: 1,
          description: "Late checkout fee",
          amount: 2500,
        },
        mockDb
      );
    },
    {
      code: "DUPLICATE_ADJUSTMENT",
    }
  );
});

test("postCharge routes all charge types correctly", async () => {
  const mockDb = createMockDb({
    guests: [{ id: 10, fullName: "Guest" }],
    reservations: [
      {
        id: 1,
        reference: "RFH-1001",
        guestId: 10,
        status: "CHECKED_IN",
        checkInDate: new Date("2026-11-10"),
        checkOutDate: new Date("2026-11-13"),
        nightlyRate: 15000,
      },
    ],
  });

  const res = await chargePostingService.postCharge(
    {
      chargeType: "PAYMENT",
      reservationId: 1,
      amount: 10000,
      method: "CARD",
      isAdvance: true,
      note: "Booking deposit",
    },
    mockDb
  );

  assert.strictEqual(res.chargeType, "PAYMENT");
  assert.strictEqual(res.payment.amount, 10000);
});

test("getGuestBill aggregates all applicable charges, excludes cancelled orders, and calculates financials", async () => {
  const mockDb = createMockDb({
    guests: [{ id: 10, fullName: "Alice Smith", idNumber: "NIC-12345" }],
    reservations: [
      {
        id: 1,
        reference: "RFH-1001",
        guestId: 10,
        cabanaId: 1,
        packageId: 1,
        status: "CHECKED_IN",
        checkInDate: new Date("2026-11-10"),
        checkOutDate: new Date("2026-11-12"), // 2 nights
        nightlyRate: 15000, // 2 * 15000 = 30000
      },
    ],
    activityBookings: [
      {
        id: 1,
        reservationId: 1,
        activityId: 1,
        scheduledAt: new Date("2026-11-11"),
        participants: 2,
        unitPriceAtBooking: 5000,
        totalCharge: 10000,
        status: "BOOKED",
      },
      {
        id: 2,
        reservationId: 1,
        activityId: 1,
        scheduledAt: new Date("2026-11-12"),
        participants: 1,
        unitPriceAtBooking: 5000,
        totalCharge: 5000,
        status: "CANCELLED", // MUST BE EXCLUDED!
      },
    ],
    fnbOrders: [
      {
        id: 1,
        reservationId: 1,
        status: "DELIVERED",
        totalCost: 4000,
        createdAt: new Date(),
      },
      {
        id: 2,
        reservationId: 1,
        status: "CANCELLED", // MUST BE EXCLUDED!
        totalCost: 1500,
        createdAt: new Date(),
      },
    ],
    barOrders: [
      {
        id: 1,
        reservationId: 1,
        barItemId: 1,
        quantity: 2,
        unitPriceAtOrder: 900,
        totalCost: 1800,
        createdAt: new Date(),
      },
    ],
    adjustments: [
      {
        id: 1,
        reservationId: 1,
        description: "Welcome discount",
        amount: -800,
        createdAt: new Date(),
      },
    ],
    payments: [
      {
        id: 1,
        reservationId: 1,
        amount: 15000,
        method: "BANK_TRANSFER",
        isAdvance: true,
        paidAt: new Date(),
      },
    ],
    settings: [
      { key: "service_charge_percent", value: "10" },
      { key: "tax_percent", value: "5" },
    ],
  });

  const bill = await chargePostingService.getGuestBill(1, {}, mockDb);

  // Check accommodation
  assert.strictEqual(bill.charges.accommodation.nights, 2);
  assert.strictEqual(bill.charges.accommodation.amount, 30000);

  // Check activity charges (only 1 non-cancelled)
  assert.strictEqual(bill.charges.activities.length, 1);
  assert.strictEqual(bill.financials.subtotalActivities, 10000);

  // Check F&B (only 1 non-cancelled)
  assert.strictEqual(bill.charges.foodBeverage.length, 1);
  assert.strictEqual(bill.financials.subtotalFoodBeverage, 4000);

  // Check Bar
  assert.strictEqual(bill.charges.bar.length, 1);
  assert.strictEqual(bill.financials.subtotalBar, 1800);

  // Check Adjustments
  assert.strictEqual(bill.charges.adjustments.length, 1);
  assert.strictEqual(bill.financials.subtotalAdjustments, -800);

  // Gross charges = 30000 + 10000 + 4000 + 1800 - 800 = 45000
  assert.strictEqual(bill.financials.grossCharges, 45000);

  // Service charge 10% = 4500
  assert.strictEqual(bill.financials.serviceChargeAmount, 4500);

  // Tax 5% on (45000 + 4500) = 5% of 49500 = 2475
  assert.strictEqual(bill.financials.taxAmount, 2475);

  // Grand total = 49500 + 2475 = 51975
  assert.strictEqual(bill.financials.grandTotal, 51975);

  // Total paid = 15000
  assert.strictEqual(bill.financials.totalPaid, 15000);

  // Balance due = 51975 - 15000 = 36975
  assert.strictEqual(bill.financials.balanceDue, 36975);
  assert.strictEqual(bill.financials.paymentStatus, "PARTIALLY_PAID");

  // Deduplication report
  assert.strictEqual(bill.deduplicationAudit.isClean, true);
  assert.strictEqual(bill.deduplicationAudit.duplicatesDetectedCount, 0);
});

test("finalizeBillAndCheckout creates Invoice snapshot and marks CHECKED_OUT", async () => {
  const mockDb = createMockDb({
    guests: [{ id: 10, fullName: "Guest" }],
    reservations: [
      {
        id: 1,
        reference: "RFH-1001",
        guestId: 10,
        cabanaId: 1,
        packageId: 1,
        status: "CHECKED_IN",
        checkInDate: new Date("2026-11-10"),
        checkOutDate: new Date("2026-11-11"), // 1 night @ 15000
        nightlyRate: 15000,
        createdById: 1,
      },
    ],
  });

  const res = await chargePostingService.finalizeBillAndCheckout(1, { userId: 1 }, mockDb);
  assert.strictEqual(res.success, true);
  assert.ok(res.invoice.invoiceNumber.startsWith("INV-RFH1001-"));
  assert.strictEqual(Number(res.invoice.accommodation), 15000);

  // Reservation is updated to CHECKED_OUT
  const updatedReservation = await mockDb.reservation.findUnique({ where: { id: 1 } });
  assert.strictEqual(updatedReservation.status, "CHECKED_OUT");
  assert.strictEqual(updatedReservation.portalActive, false);
});

// Fills a LOCAL (or test) database with FAKE data. Never run against real hotel data.
// Safe to run more than once. Usage: npm run db:seed
require("dotenv").config();
const { PrismaClient } = require("@prisma/client");
const bcrypt = require("bcryptjs");

const prisma = new PrismaClient();

// Dates relative to today, at midnight UTC (the database stores plain dates)
const day = (offset) => {
    const d = new Date();
    d.setUTCHours(0, 0, 0, 0);
    d.setUTCDate(d.getUTCDate() + offset);
    return d;
};

async function findOrCreate(model, where, data) {
    const found = await model.findFirst({ where });
    return found || model.create({ data });
}

async function main() {
    if (process.env.NODE_ENV === "production") {
        throw new Error("Refusing to seed fake data when NODE_ENV=production.");
    }

    const adminPassword = process.env.SEED_ADMIN_PASSWORD || "Admin@12345";
    const staffPassword = "Staff@12345";

    // Staff accounts
    const admin = await prisma.user.upsert({
        where: { username: "admin" },
        update: {},
        create: {
            username: "admin",
            fullName: "Test Admin",
            passwordHash: await bcrypt.hash(adminPassword, 10),
            role: "ADMIN",
        },
    });
    await prisma.user.upsert({
        where: { username: "staff" },
        update: {},
        create: {
            username: "staff",
            fullName: "Test Staff",
            passwordHash: await bcrypt.hash(staffPassword, 10),
            role: "STAFF",
        },
    });

    // Hotel settings (replace placeholders with real values once the owner confirms them)
    const settings = {
        hotel_phone: "[hotel phone]",
        whatsapp_number: "[whatsapp number]",
        check_in_time: "14:00",
        check_out_time: "11:00",
        tax_percent: "0",
        service_charge_percent: "0",
    };
    for (const [key, value] of Object.entries(settings)) {
        await prisma.setting.upsert({ where: { key }, update: {}, create: { key, value } });
    }

    // The cabana and two stay packages (PLACEHOLDER prices)
    const cabana = await findOrCreate(prisma.cabana, { name: "The River Cabana" }, {
        name: "The River Cabana",
        description: "Private riverside cabana.",
        maxGuests: 6,
        facilities: ["AC", "Hot water", "River view", "Wi-Fi"],
        photoUrls: [],
    });
    const couple = await prisma.stayPackage.upsert({
        where: { name: "Couple" },
        update: {},
        create: { name: "Couple", description: "For two guests.", pricePerNight: 15000, maxAdults: 2, maxChildren: 0, inclusions: ["Breakfast"] },
    });
    await prisma.stayPackage.upsert({
        where: { name: "Family" },
        update: {},
        create: { name: "Family", description: "For a family.", pricePerNight: 22000, maxAdults: 4, maxChildren: 2, inclusions: ["Breakfast", "Dinner"] },
    });

    // Activities
    await findOrCreate(prisma.activity, { name: "Sample jeep safari" }, {
        name: "Sample jeep safari", type: "SAFARI", description: "Placeholder safari.",
        durationMinutes: 180, unitPrice: 8000, maxParticipants: 6, photoUrls: [],
    });
    await findOrCreate(prisma.activity, { name: "Sample river walk" }, {
        name: "Sample river walk", type: "OUTDOOR_ACTIVITY", description: "Placeholder activity.",
        durationMinutes: 90, unitPrice: 2500, maxParticipants: 8, photoUrls: [],
    });

    // Menu
    const menu = {
        Breakfast: [["Sample breakfast set", 1800]],
        Mains: [["Sample rice and curry", 2200], ["Sample grilled fish", 3200]],
        Drinks: [["Sample fresh juice", 800]],
    };
    let order = 0;
    for (const [categoryName, items] of Object.entries(menu)) {
        const category = await prisma.menuCategory.upsert({
            where: { name: categoryName }, update: {}, create: { name: categoryName, sortOrder: order++ },
        });
        for (const [name, price] of items) {
            await findOrCreate(prisma.menuItem, { name }, {
                name, price, categoryId: category.id,
                options: [{ name: "Spice level", choices: ["Mild", "Medium", "Hot"] }],
            });
        }
    }

    // A fake guest with one confirmed reservation next week
    const guest = await prisma.guest.upsert({
        where: { idNumber: "TEST-000001" },
        update: {},
        create: { idNumber: "TEST-000001", fullName: "Test Guest", address: "Test Address, Colombo" },
    });
    await prisma.reservation.upsert({
        where: { reference: "RFH-1001" },
        update: {},
        create: {
            reference: "RFH-1001",
            guestId: guest.id, cabanaId: cabana.id, packageId: couple.id,
            checkInDate: day(7), checkOutDate: day(9),
            adults: 2, nightlyRate: couple.pricePerNight,
            status: "CONFIRMED", source: "PHONE", createdById: admin.id,
        },
    });

    console.log("Seed finished.");
    console.log("Staff logins:  admin /", adminPassword, "   staff /", staffPassword);
    console.log("Sample reservation reference: RFH-1001 (no portal password yet)");
}

main()
    .catch((e) => {
        console.error(e);
        process.exitCode = 1;
    })
    .finally(() => prisma.$disconnect());
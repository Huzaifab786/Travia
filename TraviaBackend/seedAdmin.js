const { PrismaClient } = require("@prisma/client");
const bcrypt = require("bcryptjs");

const prisma = new PrismaClient();

async function main() {
  const email = "admin@travia.app";
  const password = "admin123";
  const role = "admin";
  const name = "Super Admin";

  const passwordHash = await bcrypt.hash(password, 12);

  const existing = await prisma.user.findUnique({
    where: { email },
  });

  if (existing) {
    console.log(`User ${email} already exists. Updating password and role...`);
    await prisma.user.update({
      where: { email },
      data: { passwordHash, role },
    });
    console.log("Admin updated successfully!");
  } else {
    console.log(`Creating new admin user ${email}...`);
    await prisma.user.create({
      data: {
        email,
        name,
        passwordHash,
        role,
      },
    });
    console.log("Admin created successfully!");
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

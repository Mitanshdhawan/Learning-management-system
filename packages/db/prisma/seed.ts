import bcrypt from 'bcryptjs'
import { prisma } from '../src/index'

async function main() {
  const adminEmail = 'admin@toplms.local'
  const adminPassword = 'admin1234' // dev bootstrap — change in production

  const passwordHash = await bcrypt.hash(adminPassword, 12)

  const admin = await prisma.user.upsert({
    where: { email: adminEmail },
    update: { passwordHash, status: 'active', role: 'admin' },
    create: {
      email: adminEmail,
      fullName: 'Platform Admin',
      role: 'admin',
      status: 'active',
      passwordHash,
    },
  })

  console.log(`Seeded admin: ${admin.email} (password: ${adminPassword}) [${admin.id}]`)
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    console.error(e)
    await prisma.$disconnect()
    process.exit(1)
  })

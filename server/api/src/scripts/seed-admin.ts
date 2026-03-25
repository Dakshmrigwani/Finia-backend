import readline from 'node:readline';
import { hashPassword } from '../src/utils/password-hash';
import { UserRole } from '@/generated/prisma/enums';
import prisma from '@/lib/prisma';

const adminDetails: Partial<{ email: string; password: string; name: string; role: UserRole }> = {
  name: 'Admin',
  role: 'ADMIN',
};

async function seedDatabase() {
  try {
    console.log('\nSeeding database...');

    await prisma.user.deleteMany({
      where: { role: 'ADMIN' },
    });
    console.log('All existing admins removed.');

    const hashedPassword = await hashPassword(adminDetails.password!);

    await prisma.user.create({
      data: {
        name: adminDetails.name!,
        role: adminDetails.role!,
        email: adminDetails.email!,
        password: hashedPassword,
      },
    });

    console.log('Admin user created successfully!');
  } catch (err) {
    console.error('Error seeding database:', err);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
    process.exit(0);
  }
}

function promptHidden(question: string): Promise<string> {
  return new Promise((resolve) => {
    const stdin = process.stdin;
    const stdout = process.stdout;

    stdin.resume();
    stdin.setRawMode(true);
    stdin.setEncoding('utf8');

    stdout.write(question);
    let input = '';

    const onData = (char: string) => {
      if (char === '\n' || char === '\r' || char === '\u0004') {
        stdin.setRawMode(false);
        stdout.write('\n');
        stdin.removeListener('data', onData);
        resolve(input);
      } else if (char === '\u0003') {
        process.exit();
      } else if (char === '\u007f') {
        if (input.length > 0) {
          input = input.slice(0, -1);
          stdout.write('\b \b');
        }
      } else {
        input += char;
        stdout.write('*');
      }
    };

    stdin.on('data', onData);
  });
}

async function promptForAdminDetails() {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  rl.question('Enter admin email: ', async (email) => {
    rl.close();
    adminDetails.email = email;

    const password = await promptHidden('Enter admin password: ');
    adminDetails.password = password;

    await seedDatabase();
  });
}

promptForAdminDetails();

import { Client } from 'pg';

const passwords = ['', 'postgres', 'root', 'admin', 'password', '123456'];

async function testPasswords() {
  for (const pw of passwords) {
    const client = new Client({
      host: 'localhost',
      port: 5432,
      user: 'postgres',
      password: pw,
      database: 'postgres',
    });

    try {
      console.log(`Testing password: "${pw}"...`);
      await client.connect();
      console.log(`SUCCESS! The correct password is: "${pw}"`);
      await client.end();
      return pw;
    } catch (err: any) {
      console.log(`Failed for "${pw}": ${err.message}`);
    }
  }
  console.log('None of the default passwords worked.');
  return null;
}

testPasswords();

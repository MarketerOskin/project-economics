#!/usr/bin/env node
/**
 * Print an OPERATOR_PASSWORD_HASH value for .env.
 * Usage: node scripts/hash-operator-password.mjs 'my-strong-password'
 */
import { randomBytes, scryptSync } from 'node:crypto';

const password = process.argv[2];
if (!password) {
  console.error("Usage: node scripts/hash-operator-password.mjs '<password>'");
  process.exit(1);
}

const salt = randomBytes(16);
const hash = scryptSync(password, salt, 64);
console.log(`OPERATOR_PASSWORD_HASH="scrypt:${salt.toString('hex')}:${hash.toString('hex')}"`);

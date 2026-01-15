#!/usr/bin/env node
import { program } from './cli/args';
import { registerCommands } from './cli/commands';
import { logger } from './logging/logger';

async function main() {
  registerCommands();
  
  try {
    await program.parseAsync(process.argv);
  } catch (error) {
    logger.error('CLI execution failed', { error });
    process.exit(1);
  }
}

main();

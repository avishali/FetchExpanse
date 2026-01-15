import { Command } from 'commander';

export const program = new Command();

program
  .name('expense')
  .description('FetchExpanse CLI')
  .version('1.0.0');

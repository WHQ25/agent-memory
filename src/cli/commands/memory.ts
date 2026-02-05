import { Command } from 'commander';
import { resolveSource, injectMetadata, readStdin } from '../middleware.js';
import { resolveFormat, output } from '../output.js';

export function registerMemoryCommands(program: Command): void {
  program
    .command('add [content]')
    .description('Store a new memory')
    .option('--tags <tags>', 'Comma-separated tags')
    .option('--digest <text>', 'Short summary for search results')
    .action(async (content: string | undefined, opts: { tags?: string; digest?: string }) => {
      const globalOpts = program.opts();
      const source = await resolveSource(globalOpts.source);
      const format = resolveFormat(globalOpts);

      // Read from stdin if no content argument and stdin is piped
      if (!content && !process.stdin.isTTY) {
        content = await readStdin();
      }
      if (!content) {
        console.error('Error: content is required (provide as argument or pipe via stdin)');
        process.exit(1);
      }

      const tags = opts.tags ? opts.tags.split(',').map(t => t.trim()) : undefined;
      const metadata = injectMetadata(globalOpts.source ?? 'local');
      const memory = await source.add({ content, digest: opts.digest, tags, metadata });
      output(memory, format);
    });

  program
    .command('get <ids...>')
    .description('Retrieve memories by ID')
    .option('--full', 'Include all metadata')
    .action(async (ids: string[], opts: { full?: boolean }) => {
      const globalOpts = program.opts();
      const source = await resolveSource(globalOpts.source);
      const format = resolveFormat(globalOpts);
      const memories = await source.get(ids);
      if (memories.length === 0) {
        console.error('No memories found');
        process.exit(1);
      }
      if (opts.full) {
        output(memories.length === 1 ? memories[0] : memories, format);
      } else {
        // Default: content only
        const contents = memories.map(m => ({ id: m.id, content: m.content }));
        output(contents.length === 1 ? contents[0] : contents, format);
      }
    });

  program
    .command('update <id>')
    .description('Update a memory')
    .option('--content <text>', 'New content')
    .option('--digest <text>', 'New digest')
    .option('--tags <tags>', 'New comma-separated tags')
    .action(async (id: string, opts: { content?: string; digest?: string; tags?: string }) => {
      const globalOpts = program.opts();
      const source = await resolveSource(globalOpts.source);
      const format = resolveFormat(globalOpts);

      let content = opts.content;
      // Read from stdin if no --content and stdin is piped
      if (!content && !opts.digest && !opts.tags && !process.stdin.isTTY) {
        content = await readStdin();
      }

      const tags = opts.tags ? opts.tags.split(',').map(t => t.trim()) : undefined;
      const metadata = injectMetadata(globalOpts.source ?? 'local');
      const memory = await source.update(id, { content, digest: opts.digest, tags, metadata });
      output(memory, format);
    });

  program
    .command('delete <ids...>')
    .description('Delete memories by ID')
    .action(async (ids: string[]) => {
      const globalOpts = program.opts();
      const source = await resolveSource(globalOpts.source);
      const format = resolveFormat(globalOpts);
      await source.delete(ids);
      output({ deleted: ids }, format);
    });
}

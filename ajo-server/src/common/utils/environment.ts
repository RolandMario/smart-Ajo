/**
 * Whether @nestjs/schedule should keep running the in-process cron jobs.
 *
 * The jobs (savings auto-debit, group auto-collect, reminders, defaulter
 * flagging) run in-process whenever the NestJS process is alive, which is
 * right for local dev and an always-on host. When the same jobs are also
 * driven externally by Vercel Cron via the guarded /cron/* endpoints (see
 * vercel.json), set `DISABLE_IN_PROCESS_CRONS=true` in the server
 * environment so a job never fires twice on a serverless deployment.
 */
export function inProcessCronsEnabled(): boolean {
  return (
    String(process.env.DISABLE_IN_PROCESS_CRONS ?? 'false').toLowerCase() !==
    'true'
  );
}
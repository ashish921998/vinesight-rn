# Vinesight Context

## Activity stack

An Activity stack is the set of pending log drafts a user reviews and saves together from the entry form. It can target one farm, or all farms when the stack contains only expense logs. Saving an Activity stack is intended to be atomic: if any draft fails, created records from that save attempt should be rolled back before the user retries. Rollback failures are tracked as `EntryLogRollbackFailure` objects (see `save-entry-log-session.ts`) so failures are traceable rather than silent no-ops.

# Supabase migrations

SQL migrations in this folder are applied with the [Supabase CLI](https://supabase.com/docs/guides/cli):

```bash
supabase link --project-ref <your-project-ref>
supabase db push
```

During local development you can also run SQL in the Supabase Dashboard SQL editor. Add new files as `YYYYMMDDHHMM_description.sql`.

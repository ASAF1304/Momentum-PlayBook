-- Migration 005: Asaf's Thoughts public board
-- Run in Supabase Dashboard → SQL Editor

CREATE TABLE IF NOT EXISTS public.asaf_thoughts (
  id         uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  ticker     text        NOT NULL,
  notes      text,
  image_url  text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.asaf_thoughts ENABLE ROW LEVEL SECURITY;

-- All authenticated users can read
CREATE POLICY "asaf_thoughts_public_read"
  ON public.asaf_thoughts FOR SELECT USING (true);

-- Only Asaf can write
CREATE POLICY "asaf_thoughts_admin_insert"
  ON public.asaf_thoughts FOR INSERT
  WITH CHECK ((auth.jwt() ->> 'email') = 'asaf.abllin@gmail.com');

CREATE POLICY "asaf_thoughts_admin_update"
  ON public.asaf_thoughts FOR UPDATE
  USING ((auth.jwt() ->> 'email') = 'asaf.abllin@gmail.com');

CREATE POLICY "asaf_thoughts_admin_delete"
  ON public.asaf_thoughts FOR DELETE
  USING ((auth.jwt() ->> 'email') = 'asaf.abllin@gmail.com');

-- Auto-update updated_at
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER asaf_thoughts_updated_at
  BEFORE UPDATE ON public.asaf_thoughts
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Storage bucket: create manually in Supabase Dashboard → Storage
-- Bucket name: thoughts-images, Public: true


CREATE OR REPLACE FUNCTION public.generate_ref_code()
RETURNS TEXT LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  code TEXT;
  done BOOLEAN := false;
BEGIN
  WHILE NOT done LOOP
    code := upper(substr(md5(random()::text || clock_timestamp()::text), 1, 8));
    PERFORM 1 FROM public.profiles WHERE ref_code = code;
    IF NOT FOUND THEN done := true; END IF;
  END LOOP;
  RETURN code;
END;
$$;

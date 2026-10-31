ALTER TABLE app."User"
  ADD COLUMN "mobileNumber" text,
  ADD COLUMN "salonRegistrationName" text,
  ADD CONSTRAINT user_mobile_format CHECK ("mobileNumber" IS NULL OR "mobileNumber" ~ '^\+[1-9][0-9]{7,14}$'),
  ADD CONSTRAINT registration_salon_name_length CHECK ("salonRegistrationName" IS NULL OR length(trim("salonRegistrationName")) BETWEEN 2 AND 100);

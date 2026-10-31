-- Hosted Supabase reserves ownership of the Auth schema. Expose exactly one
-- boolean lookup to the backend instead of granting Auth table access.
CREATE FUNCTION app.registered_email_exists(candidate text) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT EXISTS(SELECT 1 FROM auth.users WHERE lower(email)=lower(candidate) AND deleted_at IS NULL)
$$;
REVOKE ALL ON FUNCTION app.registered_email_exists(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION app.registered_email_exists(text) TO saloonsync_runtime;
REVOKE SELECT(email, deleted_at) ON auth.users FROM saloonsync_runtime;
REVOKE USAGE ON SCHEMA auth FROM saloonsync_runtime;

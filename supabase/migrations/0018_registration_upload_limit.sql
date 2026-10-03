-- Registration photos may be up to 15MB (was 5MB). Most are downscaled in the
-- browser first; this covers the ones it can't decode (e.g. HEIC on some
-- devices), which are uploaded as-is.
update storage.buckets
   set file_size_limit = 15728640
 where id = 'pickleball-registrations';

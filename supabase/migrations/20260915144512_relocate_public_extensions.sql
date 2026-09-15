SET lock_timeout = '5s';
-- Dependencies retain their OIDs. Search functions already resolve operators via extensions.
ALTER EXTENSION btree_gist SET SCHEMA extensions;
ALTER EXTENSION vector SET SCHEMA extensions;

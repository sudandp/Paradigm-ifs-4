-- Allow public (anon) read access to organization_groups and entities
-- This is required for the public GMC enrollment form to show dropdown lists

-- organization_groups
DROP POLICY IF EXISTS "public_read_org_groups" ON organization_groups;
CREATE POLICY "public_read_org_groups" ON organization_groups
    FOR SELECT TO anon USING (true);

-- entities (Sites/Projects)
DROP POLICY IF EXISTS "public_read_entities" ON entities;
CREATE POLICY "public_read_entities" ON entities
    FOR SELECT TO anon USING (true);
